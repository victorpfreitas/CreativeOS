import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as db from '../lib/database';
import type { Project, Slide, Slideshow } from '../lib/types';
import { generateSlideshow } from '../services/geminiService';
import { assessQueueState, getQueueLabelText, getReviewStateLabel, getSlideshowProjectId, getSourceCaptureSummary } from '../lib/queueUtils';

type FilterState = 'all' | NonNullable<Slideshow['review_state']>;
type FilterSource = 'all' | NonNullable<Slideshow['generated_by']>;

function hydrateSlides(nextSlides: Array<{ type: 'hook' | 'body'; text: string }>, currentSlides: Slide[]) {
  return nextSlides.map((slide, index) => ({
    ...slide,
    image_url: currentSlides[index]?.image_url || '',
  }));
}

export default function DraftQueue() {
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState<FilterState>('all');
  const [sourceFilter, setSourceFilter] = useState<FilterSource>('all');
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [showData, projectData] = await Promise.all([
          db.getSlideshows(),
          db.getProjects(),
        ]);
        setSlideshows(showData);
        setProjects(projectData);
      } catch (error) {
        console.error('Error loading draft queue:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const filteredSlideshows = useMemo(() => {
    const items = slideshows.filter((slideshow) => {
      const slideshowProjectId = getSlideshowProjectId(slideshow);
      if (projectFilter !== 'all' && slideshowProjectId !== projectFilter) return false;
      if (stateFilter !== 'all' && slideshow.review_state !== stateFilter) return false;
      if (sourceFilter !== 'all' && slideshow.generated_by !== sourceFilter) return false;
      return true;
    });

    return items.sort((a, b) => {
      const compare = (b.created_at || '').localeCompare(a.created_at || '');
      return order === 'newest' ? compare : -compare;
    });
  }, [order, projectFilter, slideshows, sourceFilter, stateFilter]);

  const queuedCount = slideshows.filter((slideshow) => slideshow.review_state === 'queued').length;
  const reviewingCount = slideshows.filter((slideshow) => slideshow.review_state === 'reviewing').length;
  const approvedCount = slideshows.filter((slideshow) => slideshow.review_state === 'approved').length;

  async function updateReviewState(slideshowId: string, reviewState: NonNullable<Slideshow['review_state']>) {
    setActingId(slideshowId);
    try {
      await db.updateSlideshow(slideshowId, { review_state: reviewState });
      setSlideshows((prev) => prev.map((slideshow) => (
        slideshow.id === slideshowId
          ? { ...slideshow, review_state: reviewState }
          : slideshow
      )));
    } catch (error) {
      console.error('Error updating review state:', error);
    } finally {
      setActingId(null);
    }
  }

  async function regenerateDraft(slideshow: Slideshow) {
    if (!slideshow.automation_id || !slideshow.source_context?.hook_text) {
      await updateReviewState(slideshow.id, 'needs_regeneration');
      return;
    }

    setActingId(slideshow.id);
    try {
      const automation = slideshow.automation || await db.getAutomation(slideshow.automation_id);
      if (!automation) throw new Error('Automation not found');

      const result = await generateSlideshow({
        hookText: slideshow.source_context.hook_text,
        niche: automation.niche,
        narrativePrompt: automation.narrative_prompt,
        formatPrompt: automation.format_prompt,
        softCta: automation.soft_cta,
        knowledgeBase: automation.project?.knowledge_base,
      });
      const regeneratedSlides = hydrateSlides(result.slides, slideshow.slides);

      const queue = assessQueueState({
        slides: regeneratedSlides,
        caption: result.caption,
        sourceTitle: automation.name,
        sourceNotes: automation.narrative_prompt,
      });

      await db.updateSlideshow(slideshow.id, {
        slides: regeneratedSlides,
        caption: result.caption,
        review_state: 'queued',
        queue_label: queue.queueLabel,
        queue_note: queue.queueNote,
      });

      setSlideshows((prev) => prev.map((item) => (
        item.id === slideshow.id
          ? {
              ...item,
              automation,
              slides: regeneratedSlides,
              caption: result.caption,
              review_state: 'queued',
              queue_label: queue.queueLabel,
              queue_note: queue.queueNote,
            }
          : item
      )));
    } catch (error) {
      console.error('Error regenerating slideshow:', error);
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-56 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
          <Sparkles className="w-4 h-4" /> Fila operacional
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Draft queue por projeto</h1>
          <p className="text-slate-500 mt-1">Tudo o que foi gerado automaticamente ou entrou em revisao fica centralizado aqui com proxima acao clara.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QueueMetric label="Na fila" value={queuedCount} detail="Gerado e esperando revisao humana." />
        <QueueMetric label="Em revisao" value={reviewingCount} detail="Ja aberto ou assumido por alguem." />
        <QueueMetric label="Aprovados" value={approvedCount} detail="Prontos para export, publicacao ou entrega." />
      </div>

      <div className="premium-card p-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <label className="premium-label">Projeto</label>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="premium-input w-full appearance-none">
            <option value="all">Todos</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="premium-label">Estado</label>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as FilterState)} className="premium-input w-full appearance-none">
            <option value="all">Todos</option>
            <option value="queued">Na fila</option>
            <option value="reviewing">Em revisao</option>
            <option value="approved">Aprovado</option>
            <option value="needs_regeneration">Pedir nova versao</option>
            <option value="rejected">Descartado</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="premium-label">Origem</label>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as FilterSource)} className="premium-input w-full appearance-none">
            <option value="all">Todas</option>
            <option value="automation">Automacao</option>
            <option value="weekly_plan">Planning semanal</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="premium-label">Ordem</label>
          <select value={order} onChange={(event) => setOrder(event.target.value as 'newest' | 'oldest')} className="premium-input w-full appearance-none">
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
          </select>
        </div>
      </div>

      {filteredSlideshows.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <p className="text-lg font-bold text-white">Nenhum draft nesta visao</p>
          <p className="text-slate-500 mt-2">A fila ganha vida quando as automacoes geram novos carrosseis ou quando voce cria drafts manuais.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSlideshows.map((slideshow) => {
            const project = projectMap.get(getSlideshowProjectId(slideshow)) || slideshow.automation?.project;
            const promise = slideshow.hook?.text || slideshow.slides?.[0]?.title || slideshow.slides?.[0]?.text || 'Draft sem promessa definida';
            const queueLabel = getQueueLabelText(slideshow.queue_label);
            const reviewState = getReviewStateLabel(slideshow.review_state);
            const sourceCapture = getSourceCaptureSummary(slideshow);
            const isActing = actingId === slideshow.id;

            return (
              <div key={slideshow.id} className="premium-card p-5 space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-indigo-200">
                        {reviewState}
                      </span>
                      <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-300">
                        {queueLabel}
                      </span>
                      {slideshow.generated_by && (
                        <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-400">
                          {slideshow.generated_by === 'automation' ? 'Automacao' : slideshow.generated_by === 'weekly_plan' ? 'Planning' : 'Manual'}
                        </span>
                      )}
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
                        sourceCapture.failed
                          ? 'bg-red-500/10 text-red-200'
                          : sourceCapture.isFallback
                            ? 'bg-amber-500/10 text-amber-100'
                            : 'bg-emerald-500/10 text-emerald-200'
                      }`}>
                        {sourceCapture.typeLabel}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white leading-tight">{promise}</h2>
                      <p className="text-sm text-slate-400 mt-2 leading-relaxed">{slideshow.queue_note || 'Sem observacao de fila.'}</p>
                      <p className="text-xs text-slate-500 mt-2">{sourceCapture.note}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[260px]">
                    <QueueFact label="Projeto" value={project?.name || 'Sem projeto'} />
                    <QueueFact label="Sistema" value={slideshow.automation?.name || 'Manual'} />
                    <QueueFact label="Readiness" value={`${slideshow.readiness_score || 0}/100`} />
                    <QueueFact label="Imagem" value={sourceCapture.statusLabel} />
                    <QueueFact label="Criado em" value={new Date(slideshow.created_at).toLocaleDateString('pt-BR')} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => updateReviewState(slideshow.id, 'reviewing')}
                    disabled={isActing}
                    className="premium-button-secondary text-sm"
                  >
                    {isActing ? 'Atualizando...' : 'Assumir revisao'}
                  </button>
                  <button
                    onClick={() => updateReviewState(slideshow.id, 'approved')}
                    disabled={isActing}
                    className="premium-button-primary text-sm flex items-center gap-2"
                  >
                    {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Aprovar
                  </button>
                  <button
                    onClick={() => regenerateDraft(slideshow)}
                    disabled={isActing}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/20 transition-colors flex items-center gap-2"
                  >
                    {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Nova versao
                  </button>
                  <Link to={`/editor/${slideshow.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2">
                    Abrir editor <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => updateReviewState(slideshow.id, 'rejected')}
                    disabled={isActing}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Descartar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QueueMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="premium-card p-5">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-bold text-white font-space tracking-tighter">{value}</p>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed">{detail}</p>
    </div>
  );
}

function QueueFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-white leading-snug">{value}</p>
    </div>
  );
}
