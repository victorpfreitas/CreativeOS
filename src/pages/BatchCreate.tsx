import { useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, Sparkles, Check, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ContentDraft, Project } from '../lib/types';
import * as db from '../lib/database';
import { generateXContentBatch, type XBatchItem } from '../services/geminiService';

const inputCls = 'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

type Mode = 'pillars' | 'topic';
type FormatMix = 'x_post' | 'x_thread' | 'mixed';

function draftPreviewText(item: XBatchItem) {
  return item.format === 'x_thread'
    ? item.thread_items.map((text, index) => `${index + 1}/${item.thread_items.length}  ${text}`).join('\n\n')
    : item.body;
}

function approvedToExamples(drafts: ContentDraft[], projectId: string): string[] {
  return drafts
    .filter((draft) => draft.project_id === projectId && draft.status === 'approved')
    .slice(0, 6)
    .map((draft) => (draft.format === 'x_thread' ? draft.thread_items.join('\n') : draft.body))
    .filter(Boolean);
}

export default function BatchCreate() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [mode, setMode] = useState<Mode>('pillars');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(12);
  const [formatMix, setFormatMix] = useState<FormatMix>('mixed');

  const [items, setItems] = useState<XBatchItem[]>([]);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    db.getProjects()
      .then((data) => {
        setProjects(data);
        if (data[0]) setProjectId(data[0].id);
      })
      .catch(() => setError('Nao consegui carregar os experts.'));
  }, []);

  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projects, projectId]);

  async function handleGenerate() {
    if (!selectedProject) {
      setError('Escolha um expert.');
      return;
    }
    if (mode === 'topic' && !topic.trim()) {
      setError('Escreva um tema para gerar os angulos.');
      return;
    }
    setGenerating(true);
    setError('');
    setNotice('');
    setItems([]);
    setKept(new Set());
    setProgress({ done: 0, total: count });
    try {
      const approvedDrafts = await db.getContentDrafts();
      const result = await generateXContentBatch({
        mode,
        topic: topic.trim(),
        count,
        formatMix,
        brandDNA: selectedProject.brand_dna,
        knowledgeBase: selectedProject.knowledge_base,
        voiceSamples: selectedProject.voice_samples,
        approvedExamples: approvedToExamples(approvedDrafts, selectedProject.id),
        voiceLearningNotes: selectedProject.voice_learning_notes,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setItems(result.items);
      setKept(new Set(result.items.map((_, index) => index)));
      if (result.items.length === 0) {
        setError('A IA nao retornou nenhum draft. Tente novamente.');
      } else if (result.failedChunks > 0) {
        setNotice(`Geramos ${result.items.length} de ${result.requested}. Alguns lotes falharam — voce pode salvar estes e gerar o resto depois.`);
      } else {
        setNotice(`${result.items.length} drafts gerados. Revise e salve os que quiser.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui gerar o lote agora.');
    } finally {
      setGenerating(false);
    }
  }

  function toggleKeep(index: number) {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleSaveAll() {
    if (!selectedProject || kept.size === 0) return;
    setSaving(true);
    setError('');
    try {
      const batchId = (globalThis.crypto?.randomUUID?.() || `batch_${Date.now()}`);
      const inputs = items
        .filter((_, index) => kept.has(index))
        .map((item) => ({
          project_id: selectedProject.id,
          format: item.format,
          status: 'review' as const,
          title: item.title,
          topic: mode === 'topic' ? topic.trim() : item.angle || item.title,
          body: item.body,
          thread_items: item.thread_items,
          objective: item.objective,
          hook: item.hook,
          variants: item.variants,
          voice_notes_used: item.voice_notes_used,
          content_angle: item.angle,
          batch_id: batchId,
        }));
      await db.createContentDrafts(inputs);
      navigate('/queue');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui salvar os drafts.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <header className="flex items-start gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-indigo-300">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
            <Sparkles className="h-4 w-4" /> Content Machine
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Gerar posts para X em lote</h1>
          <p className="mt-1 text-sm text-slate-500">Gere vários drafts de uma vez, revise e aprove no board.</p>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</div>}

      <section className="premium-card p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="premium-label">Expert</label>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputCls}>
              {projects.length === 0 && <option value="">Nenhum expert cadastrado</option>}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            {selectedProject && !selectedProject.voice_samples?.length && (
              <p className="flex items-center gap-1.5 text-xs text-amber-300/80">
                <AlertTriangle className="h-3.5 w-3.5" /> Sem posts reais cadastrados — o tom fica mais genérico. Adicione amostras no Expert.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="premium-label">Origem do lote</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('pillars')} className={`rounded-xl border p-3 text-left text-sm font-bold transition ${mode === 'pillars' ? 'border-indigo-400 bg-indigo-500/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'}`}>
                Pilares + Brand DNA
              </button>
              <button type="button" onClick={() => setMode('topic')} className={`rounded-xl border p-3 text-left text-sm font-bold transition ${mode === 'topic' ? 'border-indigo-400 bg-indigo-500/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'}`}>
                Tema → N ângulos
              </button>
            </div>
          </div>
        </div>

        {mode === 'topic' && (
          <div className="space-y-2">
            <label className="premium-label">Tema</label>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex: por que a maioria dos experts não vende com conteúdo" className={inputCls} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="premium-label">Quantidade ({count})</label>
            <input type="range" min={1} max={30} value={count} onChange={(event) => setCount(Number(event.target.value))} className="w-full accent-indigo-500" />
          </div>
          <div className="space-y-2">
            <label className="premium-label">Formato</label>
            <select value={formatMix} onChange={(event) => setFormatMix(event.target.value as FormatMix)} className={inputCls}>
              <option value="mixed">Misto (posts + threads)</option>
              <option value="x_post">Só posts únicos</option>
              <option value="x_thread">Só threads</option>
            </select>
          </div>
        </div>

        <button onClick={handleGenerate} disabled={generating || !projectId} className="premium-button-primary flex items-center gap-2 disabled:opacity-50">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? `Gerando ${progress.done}/${progress.total}...` : 'Gerar lote'}
        </button>
      </section>

      {items.length > 0 && (
        <section className="premium-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="premium-label">Pré-visualização</p>
              <p className="mt-1 text-sm text-slate-500">{kept.size} de {items.length} selecionados para salvar.</p>
            </div>
            <button onClick={handleSaveAll} disabled={saving || kept.size === 0} className="premium-button-primary flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar selecionados
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <label key={index} className={`block cursor-pointer rounded-2xl border p-4 transition ${kept.has(index) ? 'border-indigo-400/40 bg-indigo-500/[0.06]' : 'border-white/10 bg-black/20 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={kept.has(index)} onChange={() => toggleKeep(index)} className="mt-1 h-4 w-4 accent-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
                      <span>{item.format === 'x_thread' ? 'Thread' : 'Post'}</span>
                      {item.angle && <span className="truncate text-slate-500 normal-case font-medium tracking-normal">· {item.angle}</span>}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{draftPreviewText(item)}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
