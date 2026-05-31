import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Clock3,
  FileText,
  Layers,
  Link2,
  Loader2,
  Minus,
  Plus,
  Save,
  Sparkles,
  Square,
  Wand2,
  Youtube,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ContentDraft, Project } from '../lib/types';
import * as db from '../lib/database';
import {
  generateXDraftsFromResearch,
  generateXResearchPlan,
  type XBatchItem,
  type XBatchSource,
  type XResearchItem,
} from '../services/geminiService';
import { fetchYouTubeSource } from '../services/sourceService';

const inputCls = 'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

type Mode = 'pillars' | 'topic';
type FormatMix = 'x_post' | 'x_thread' | 'mixed';
type CopyMode = 'voz' | 'provocativo' | 'direto' | 'didatico' | 'autoridade';
type SourceKind = XBatchSource['type'];
type PipelineStage = 'brief' | 'sources' | 'researcher' | 'copywriter' | 'reviewer' | 'board';

const sourceKindLabels: Record<SourceKind, string> = {
  manual: 'Tema livre',
  x_post: 'Post do X copiado',
  x_url: 'Link de post do X',
  youtube: 'YouTube',
  transcript: 'Transcricao / resumo',
  notes: 'Notas soltas',
};

function draftPreviewText(item: XBatchItem) {
  return item.format === 'x_thread'
    ? item.thread_items.map((text, index) => `${index + 1}/${item.thread_items.length}  ${text}`).join('\n\n')
    : item.body;
}

function draftCharCount(item: XBatchItem) {
  return item.format === 'x_thread'
    ? item.thread_items.map((text) => text.length).join(' / ')
    : String(item.body.length);
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
  const [copyMode, setCopyMode] = useState<CopyMode>('voz');
  const [copyIntensity, setCopyIntensity] = useState(3);
  const [styleReference, setStyleReference] = useState('');
  const [avoidList, setAvoidList] = useState('frases prontas, tom motivacional, promessas exageradas, hashtags, emojis');
  const [qualityBar, setQualityBar] = useState('Cada post precisa ter uma opiniao clara, um exemplo concreto e uma frase que eu realmente falaria.');
  const [savingVoiceRules, setSavingVoiceRules] = useState(false);
  const [sourceKind, setSourceKind] = useState<SourceKind>('manual');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceItems, setSourceItems] = useState<XBatchSource[]>([]);
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState('');

  const [researchItems, setResearchItems] = useState<XResearchItem[]>([]);
  const [selectedIdeas, setSelectedIdeas] = useState<Set<number>>(new Set());
  const [researchSummary, setResearchSummary] = useState('');
  const [items, setItems] = useState<XBatchItem[]>([]);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [writing, setWriting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [stage, setStage] = useState<PipelineStage>('brief');
  const [stageDetail, setStageDetail] = useState('Configure o lote e adicione fontes para a IA sair do generico.');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [learningIndex, setLearningIndex] = useState('');

  useEffect(() => {
    db.getProjects()
      .then((data) => {
        setProjects(data);
        if (data[0]) setProjectId(data[0].id);
      })
      .catch(() => setError('Nao consegui carregar os experts.'));
  }, []);

  useEffect(() => {
    if (!startedAt || (!generating && !writing && !saving)) return;
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [generating, saving, startedAt, writing]);

  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projects, projectId]);
  const sourceSummary = useMemo(() => sourceItems.map((source) => {
    const label = sourceKindLabels[source.type];
    const title = source.title || source.url || source.text?.slice(0, 80) || label;
    return `${label}: ${title}`;
  }), [sourceItems]);

  function buildStyleGuidance() {
    const modeLabel: Record<CopyMode, string> = {
      voz: 'Priorizar minha voz real acima de formulas de copy.',
      provocativo: 'Mais provocativo: tese forte, corte de senso comum, sem agressividade gratuita.',
      direto: 'Mais direto: frases curtas, sem introducao longa, ponto de vista logo na primeira linha.',
      didatico: 'Mais didatico: explicar o raciocinio com clareza, mas sem virar tutorial generico.',
      autoridade: 'Mais autoridade: mostrar criterio, experiencia e padroes de decisao, sem autoelogio.',
    };

    return [
      `Modo de copy: ${modeLabel[copyMode]}`,
      `Intensidade: ${copyIntensity}/5. 1 = sutil, 5 = bem afiado.`,
      styleReference ? `Escreva mais parecido com estes exemplos ou notas minhas:\n${styleReference}` : '',
      avoidList ? `Evite explicitamente:\n${avoidList}` : '',
      qualityBar ? `Criterio minimo para aprovar:\n${qualityBar}` : '',
      'Nao tente parecer viral a qualquer custo. Prefira texto que eu teria coragem de postar no meu perfil.',
      'Se a ideia ficar generica, reescreva com mais especificidade antes de responder.',
    ].filter(Boolean).join('\n\n');
  }

  function startTimedStage(nextStage: PipelineStage, detail: string) {
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    setStage(nextStage);
    setStageDetail(detail);
  }

  function addSourceItem(source?: XBatchSource) {
    const nextSource: XBatchSource = source || {
      type: sourceKind,
      title: sourceTitle.trim(),
      url: sourceUrl.trim(),
      text: sourceText.trim(),
    };
    if (!nextSource.text?.trim() && !nextSource.url?.trim() && !nextSource.title?.trim()) {
      setSourceError('Adicione texto, link ou titulo para registrar a fonte.');
      return;
    }
    setSourceItems((current) => [...current, nextSource]);
    setSourceTitle('');
    setSourceUrl('');
    setSourceText('');
    setSourceError('');
    setStage('sources');
    setStageDetail('Fonte adicionada. O Researcher vai usar esses insumos para criar teses melhores.');
  }

  function removeSourceItem(index: number) {
    setSourceItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleLoadYouTubeSource() {
    if (!sourceUrl.trim()) {
      setSourceError('Cole a URL do YouTube antes de buscar.');
      return;
    }
    setLoadingSource(true);
    setSourceError('');
    try {
      const source = await fetchYouTubeSource(sourceUrl);
      const transcript = source.text?.trim();
      if (!transcript) {
        setSourceTitle(source.title || sourceTitle);
        setSourceText(source.note || 'Nao consegui puxar a transcricao automaticamente. Cole aqui um resumo, bullets ou transcricao manual.');
        setSourceError('Nao veio transcricao automatica. Complete com resumo ou transcricao manual e adicione a fonte.');
        return;
      }
      addSourceItem({
        type: 'youtube',
        title: source.title || sourceTitle || 'Video do YouTube',
        url: source.url || sourceUrl.trim(),
        text: transcript,
      });
      setNotice('Transcricao do YouTube adicionada como fonte do lote.');
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Nao consegui carregar esse video. Cole a transcricao ou resumo manualmente.');
    } finally {
      setLoadingSource(false);
    }
  }

  async function handleSaveVoiceRules() {
    if (!selectedProject) return;
    const guidance = buildStyleGuidance();
    setSavingVoiceRules(true);
    setError('');
    try {
      const existing = selectedProject.voice_learning_notes?.trim();
      const nextNotes = [existing, `Diretrizes manuais para lotes de X:\n${guidance}`].filter(Boolean).join('\n\n').slice(0, 2400);
      await db.updateProjectVoiceLearningNotes(selectedProject.id, nextNotes);
      setProjects((current) => current.map((project) => (
        project.id === selectedProject.id ? { ...project, voice_learning_notes: nextNotes } : project
      )));
      setNotice('Diretrizes salvas na voz do expert. Os proximos lotes vao usar essa base.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui salvar as diretrizes de voz.');
    } finally {
      setSavingVoiceRules(false);
    }
  }

  async function handleLearnFromItem(index: number, kind: 'good' | 'bad') {
    if (!selectedProject || !items[index]) return;
    const item = items[index];
    const text = draftPreviewText(item).slice(0, 900);
    setLearningIndex(`${kind}:${index}`);
    setError('');
    try {
      if (kind === 'good') {
        const existing = selectedProject.voice_learning_notes?.trim();
        const nextNotes = [existing, `Exemplo aprovado como referencia de voz:\n${text}`].filter(Boolean).join('\n\n').slice(0, 2600);
        await db.updateProjectVoiceLearningNotes(selectedProject.id, nextNotes);
        setProjects((current) => current.map((project) => (
          project.id === selectedProject.id ? { ...project, voice_learning_notes: nextNotes } : project
        )));
      }
      await db.createVoiceLearningEvent({
        project_id: selectedProject.id,
        event_type: kind === 'good' ? 'used_as_reference' : 'rejected_voice',
        format: item.format,
        after_text: text,
        instruction: kind === 'good'
          ? 'O usuario marcou este post como referencia positiva no lote.'
          : 'O usuario marcou este post como fora da voz no lote. Nao consolidar como memoria permanente sem revisao.',
      });
      setNotice(kind === 'good'
        ? 'Salvei este post como referencia positiva de voz para os proximos lotes.'
        : 'Registrei este feedback como sinal de revisao, sem contaminar a memoria permanente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui atualizar a memoria de voz.');
    } finally {
      setLearningIndex('');
    }
  }

  async function handleGenerateIdeas() {
    if (!selectedProject) {
      setError('Escolha um expert.');
      return;
    }
    if (mode === 'topic' && !topic.trim() && sourceItems.length === 0) {
      setError('Escreva um tema ou adicione ao menos uma fonte para gerar os angulos.');
      return;
    }
    startTimedStage('researcher', 'Researcher analisando fontes, Brand DNA e voz para montar a mesa de ideias.');
    setGenerating(true);
    setError('');
    setNotice('');
    setResearchItems([]);
    setSelectedIdeas(new Set());
    setResearchSummary('');
    setItems([]);
    setKept(new Set());
    setProgress({ done: 0, total: count });
    try {
      const approvedDrafts = await db.getContentDrafts();
      const result = await generateXResearchPlan({
        mode,
        topic: topic.trim(),
        count,
        formatMix,
        styleGuidance: buildStyleGuidance(),
        brandDNA: selectedProject.brand_dna,
        knowledgeBase: selectedProject.knowledge_base,
        voiceSamples: selectedProject.voice_samples,
        approvedExamples: approvedToExamples(approvedDrafts, selectedProject.id),
        voiceLearningNotes: selectedProject.voice_learning_notes,
        sources: sourceItems,
      });
      setResearchItems(result.items);
      setSelectedIdeas(new Set(result.items.map((_, index) => index).filter((index) => result.items[index].quality_score >= 70)));
      setResearchSummary(result.topic_diagnosis);
      const fallbackIdeas = result.items.filter((item) => item.risk_flags.some((flag) => flag.toLowerCase().includes('fallback'))).length;
      setNotice(fallbackIdeas > 0
        ? `${result.items.length} ideias montadas em modo fallback porque a IA demorou. Revise as melhores antes de escrever.`
        : `${result.items.length} ideias encontradas. Aprove as melhores antes de escrever os posts.`);
      setStage('researcher');
      setStageDetail('Mesa de ideias pronta. Aprove apenas as teses que merecem virar post.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui gerar ideias agora.');
    } finally {
      setGenerating(false);
      setStartedAt(null);
    }
  }

  async function handleWriteSelectedIdeas() {
    if (!selectedProject || selectedIdeas.size === 0) return;
    setWriting(true);
    startTimedStage('copywriter', 'Copywriter escrevendo os posts aprovados. A revisao de voz vem junto para ganhar tempo.');
    setError('');
    setNotice('');
    setItems([]);
    setKept(new Set());
    const selectedResearch = researchItems.filter((_, index) => selectedIdeas.has(index));
    setProgress({ done: 0, total: selectedResearch.length });
    try {
      const approvedDrafts = await db.getContentDrafts();
      const result = await generateXDraftsFromResearch({
        mode,
        topic: topic.trim(),
        count: selectedResearch.length,
        formatMix,
        researchItems: selectedResearch,
        styleGuidance: buildStyleGuidance(),
        brandDNA: selectedProject.brand_dna,
        knowledgeBase: selectedProject.knowledge_base,
        voiceSamples: selectedProject.voice_samples,
        approvedExamples: approvedToExamples(approvedDrafts, selectedProject.id),
        voiceLearningNotes: selectedProject.voice_learning_notes,
        sources: sourceItems,
        onProgress: (done, total, progressStage) => {
          setProgress({ done, total });
          if (progressStage === 'copywriter') {
            setStage('copywriter');
            setStageDetail(`Copywriter gerou ${done} de ${total}. Revisor de voz embutido na mesma etapa.`);
          }
        },
      });
      setItems(result.items);
      setKept(new Set());
      const fallbackPosts = result.items.filter((item) => item.voice_review_notes?.toLowerCase().includes('fallback')).length;
      setNotice(fallbackPosts > 0
        ? `${result.items.length} posts prontos, sendo ${fallbackPosts} em modo fallback por timeout da IA. Selecione apenas os que valem revisar no board.`
        : `${result.items.length} posts escritos e revisados. Selecione os que devem ir para o board.`);
      setStage('copywriter');
      setStageDetail('Posts prontos para revisao humana. Nada sera salvo sem voce selecionar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui escrever os posts agora.');
    } finally {
      setWriting(false);
      setStartedAt(null);
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

  function selectAllItems() {
    setKept(new Set(items.map((_, index) => index)));
  }

  function clearSelection() {
    setKept(new Set());
  }

  function toggleIdea(index: number) {
    setSelectedIdeas((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectAllIdeas() {
    setSelectedIdeas(new Set(researchItems.map((_, index) => index)));
  }

  function clearIdeas() {
    setSelectedIdeas(new Set());
  }

  async function handleSaveAll() {
    if (!selectedProject || kept.size === 0) return;
    startTimedStage('board', 'Salvando os posts selecionados no Content Board.');
    setSaving(true);
    setError('');
    try {
      const batchId = (globalThis.crypto?.randomUUID?.() || `batch_${Date.now()}`);
      const primarySource = sourceItems[0];
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
          research_thesis: item.research_thesis,
          research_context: item.research_context,
          voice_review_score: item.voice_review_score,
          voice_review_verdict: item.voice_review_verdict,
          voice_review_notes: item.voice_review_notes,
          batch_id: batchId,
          source_type: primarySource?.type || ('manual' as const),
          source_url: primarySource?.url || '',
          source_title: primarySource?.title || topic.trim() || item.angle || item.title,
          source_excerpt: primarySource?.text?.slice(0, 700) || '',
          source_refs: sourceSummary,
        }));
      const created = await db.createContentDrafts(inputs);
      await Promise.all(created.map((draft) => db.createVoiceLearningEvent({
        project_id: draft.project_id,
        draft_id: draft.id,
        event_type: 'approved',
        format: draft.format,
        after_text: draft.format === 'x_thread' ? draft.thread_items.join('\n\n') : draft.body,
        instruction: 'Draft selecionado no lote e enviado para Para revisar no Content Board.',
      })));
      navigate('/queue');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui salvar os drafts.');
    } finally {
      setSaving(false);
      setStartedAt(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-28 pt-4">
      <header className="flex items-start gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-indigo-300">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
            <Sparkles className="h-4 w-4" /> Content Machine
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Gerar posts para X em lote</h1>
          <p className="mt-1 text-sm text-slate-500">Gere varios drafts de uma vez, revise e aprove no board.</p>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</div>}

      <PipelinePanel
        stage={stage}
        detail={stageDetail}
        progress={progress}
        elapsedSeconds={elapsedSeconds}
        active={generating || writing || saving}
        sourcesCount={sourceItems.length}
        ideasCount={researchItems.length}
        postsCount={items.length}
      />

      <section className="premium-card space-y-5 p-6">
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
                <AlertTriangle className="h-3.5 w-3.5" /> Sem posts reais cadastrados. O tom fica mais generico. Adicione amostras no Expert.
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
                Tema para N angulos
              </button>
            </div>
          </div>
        </div>

        {mode === 'topic' && (
          <div className="space-y-2">
            <label className="premium-label">Tema</label>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex: por que a maioria dos experts nao vende com conteudo" className={inputCls} />
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <label className="premium-label">Fontes do lote</label>
              <p className="mt-1 text-sm text-slate-500">Cole posts do X, links, transcricoes de YouTube ou notas. O Researcher usa isso para criar teses melhores.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-slate-300">
              {sourceItems.length} fonte{sourceItems.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <label className="premium-label">Tipo</label>
              <select value={sourceKind} onChange={(event) => setSourceKind(event.target.value as SourceKind)} className={inputCls}>
                {Object.entries(sourceKindLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Titulo opcional" className={inputCls} />
              <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Link opcional" className={inputCls} />
            </div>

            <div className="space-y-2">
              <label className="premium-label">Conteudo da fonte</label>
              <textarea
                rows={6}
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder={sourceKind === 'youtube'
                  ? 'Cole a transcricao/resumo ou busque pela URL do YouTube.'
                  : sourceKind === 'x_post'
                    ? 'Cole aqui o texto do post do X que voce encontrou.'
                    : 'Cole notas, contexto, bullets, exemplos ou transcricao.'}
                className={`${inputCls} resize-none`}
              />
              {sourceError && <p className="text-xs text-amber-200">{sourceError}</p>}
              <div className="flex flex-wrap gap-2">
                {sourceKind === 'youtube' && (
                  <button type="button" onClick={handleLoadYouTubeSource} disabled={loadingSource || !sourceUrl.trim()} className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-500/15 disabled:opacity-50">
                    {loadingSource ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
                    Buscar transcricao
                  </button>
                )}
                <button type="button" onClick={() => addSourceItem()} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/15">
                  <Plus className="h-4 w-4" /> Adicionar fonte
                </button>
              </div>
            </div>
          </div>

          {sourceItems.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {sourceItems.map((source, index) => (
                <div key={`${source.type}-${index}`} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
                        {source.type === 'youtube' ? <Youtube className="h-3.5 w-3.5" /> : source.type === 'x_url' ? <Link2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                        {sourceKindLabels[source.type]}
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-white">{source.title || source.url || 'Fonte sem titulo'}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{source.text || source.url}</p>
                    </div>
                    <button type="button" onClick={() => removeSourceItem(index)} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]">
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="premium-label">Quantidade ({count})</label>
            <input type="range" min={1} max={12} value={count} onChange={(event) => setCount(Number(event.target.value))} className="w-full accent-indigo-500" />
            <p className="text-xs text-slate-500">Para evitar espera longa, gere ate 12 por rodada e salve os melhores.</p>
          </div>
          <div className="space-y-2">
            <label className="premium-label">Formato</label>
            <select value={formatMix} onChange={(event) => setFormatMix(event.target.value as FormatMix)} className={inputCls}>
              <option value="mixed">Misto (posts + threads)</option>
              <option value="x_post">So posts unicos</option>
              <option value="x_thread">So threads</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.04] p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <label className="premium-label">Direcao de escrita</label>
              <p className="mt-1 text-sm text-slate-500">Use este bloco para calibrar copy, conteudo e voz antes de gerar o lote.</p>
            </div>
            <button type="button" onClick={handleSaveVoiceRules} disabled={!selectedProject || savingVoiceRules} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50">
              {savingVoiceRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar no expert
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="premium-label">Estilo de copy</label>
              <select value={copyMode} onChange={(event) => setCopyMode(event.target.value as CopyMode)} className={inputCls}>
                <option value="voz">Mais com minha voz</option>
                <option value="provocativo">Mais provocativo</option>
                <option value="direto">Mais direto</option>
                <option value="didatico">Mais didatico</option>
                <option value="autoridade">Mais autoridade</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="premium-label">Intensidade ({copyIntensity}/5)</label>
              <input type="range" min={1} max={5} value={copyIntensity} onChange={(event) => setCopyIntensity(Number(event.target.value))} className="w-full accent-indigo-500" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="premium-label">Parece comigo quando...</label>
              <textarea rows={5} value={styleReference} onChange={(event) => setStyleReference(event.target.value)} placeholder={'Cole 1-3 posts seus ou escreva regras curtas.\nEx: eu escrevo frases curtas, com tese logo no inicio, sem floreio.'} className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="premium-label">Nao escrever assim</label>
              <textarea rows={5} value={avoidList} onChange={(event) => setAvoidList(event.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="premium-label">Barra minima de qualidade</label>
            <textarea rows={3} value={qualityBar} onChange={(event) => setQualityBar(event.target.value)} className={inputCls} />
          </div>
        </div>

        <button onClick={handleGenerateIdeas} disabled={generating || writing || !projectId} className="premium-button-primary flex items-center gap-2 disabled:opacity-50">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {generating ? 'Pesquisando ideias...' : 'Gerar ideias'}
        </button>
      </section>

      {researchItems.length > 0 && (
        <section className="premium-card space-y-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="premium-label">Researcher</p>
              <h2 className="mt-1 text-xl font-bold text-white">Mesa de ideias</h2>
              <p className="mt-1 text-sm text-slate-500">{researchSummary || 'Aprove as teses que merecem virar post.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={selectAllIdeas} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]">
                <CheckSquare className="h-4 w-4" /> Aprovar todas
              </button>
              <button type="button" onClick={clearIdeas} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]">
                <Square className="h-4 w-4" /> Limpar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {['contrarian', 'framework', 'mistake', 'proof', 'story', 'tactical', 'diagnosis'].map((job) => {
              const total = researchItems.filter((item) => item.content_job === job).length;
              return (
                <div key={job} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{job}</p>
                  <p className="mt-1 text-lg font-black text-white">{total}</p>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            {researchItems.map((item, index) => {
              const selected = selectedIdeas.has(index);
              const isFallback = item.risk_flags.some((flag) => flag.toLowerCase().includes('recuperacao') || flag.toLowerCase().includes('fallback'));
              return (
                <div key={`${item.angle}-${index}`} className={`rounded-2xl border p-4 transition ${selected ? 'border-emerald-400/50 bg-emerald-500/[0.08]' : isFallback ? 'border-amber-400/25 bg-amber-500/[0.045]' : 'border-white/10 bg-black/20'}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
                        <span>{item.best_format === 'x_thread' ? 'Thread sugerida' : 'Post sugerido'}</span>
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-400 normal-case tracking-normal">{item.content_job}</span>
                        <span className={`rounded-full px-2 py-0.5 normal-case tracking-normal ${item.quality_score >= 80 ? 'bg-emerald-500/15 text-emerald-200' : item.quality_score >= 65 ? 'bg-amber-500/15 text-amber-200' : 'bg-red-500/15 text-red-200'}`}>Score {item.quality_score}</span>
                        {isFallback && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-100 normal-case tracking-normal">Recuperacao</span>}
                        {selected && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200 normal-case tracking-normal">Aprovada</span>}
                      </div>
                      <h3 className="mt-2 text-base font-bold leading-snug text-white">{item.angle}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-200">{item.thesis}</p>
                      {item.why_it_matters && <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.why_it_matters}</p>}
                      {item.conversation_trigger && <p className="mt-2 text-xs leading-relaxed text-indigo-200/80">Conversa: {item.conversation_trigger}</p>}
                      {item.risk_flags.length > 0 && <p className="mt-2 text-xs leading-relaxed text-amber-200/80">Risco: {item.risk_flags.join(', ')}</p>}
                    </div>
                    <button type="button" onClick={() => toggleIdea(index)} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${selected ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'}`}>
                      {selected ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {selected ? 'Remover' : 'Aprovar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {items.length === 0 && (
          <div className="sticky bottom-4 z-20 rounded-2xl border border-white/10 bg-[#101018]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-white">{selectedIdeas.size} de {researchItems.length} ideias aprovadas</p>
                <p className="mt-0.5 text-xs text-slate-500">A copy so sera escrita para as ideias aprovadas aqui.</p>
              </div>
              <button onClick={handleWriteSelectedIdeas} disabled={writing || generating || selectedIdeas.size === 0} className="premium-button-primary flex items-center justify-center gap-2 disabled:opacity-50">
                {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {writing ? `Escrevendo ${progress.done}/${progress.total}...` : 'Escrever ideias aprovadas'}
              </button>
            </div>
          </div>
          )}
        </section>
      )}

      {items.length > 0 && (
        <section className="premium-card space-y-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="premium-label">Revisao do lote</p>
              <p className="mt-1 text-sm text-slate-500">Escolha somente os posts que valem ir para o board.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={selectAllItems} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]">
                <CheckSquare className="h-4 w-4" /> Selecionar todos
              </button>
              <button type="button" onClick={clearSelection} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]">
                <Square className="h-4 w-4" /> Limpar
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const selected = kept.has(index);
              return (
                <div key={index} className={`rounded-2xl border p-4 transition ${selected ? 'border-emerald-400/50 bg-emerald-500/[0.08]' : 'border-white/10 bg-black/20'}`}>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
                          <span>{item.format === 'x_thread' ? 'Thread' : 'Post'}</span>
                          <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-400 normal-case tracking-normal">{draftCharCount(item)} caracteres</span>
                          {typeof item.voice_review_score === 'number' && item.voice_review_score > 0 && (
                            <span className={`rounded-full px-2 py-0.5 normal-case tracking-normal ${item.voice_review_verdict === 'pass' ? 'bg-emerald-500/15 text-emerald-200' : item.voice_review_verdict === 'reject' ? 'bg-red-500/15 text-red-200' : 'bg-amber-500/15 text-amber-200'}`}>
                              Voz {item.voice_review_score}
                            </span>
                          )}
                          {selected && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200 normal-case tracking-normal">Selecionado</span>}
                        </div>
                        {item.angle && <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{item.angle}</p>}
                      </div>
                      <button type="button" onClick={() => toggleKeep(index)} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${selected ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'}`}>
                        {selected ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {selected ? 'Remover' : 'Selecionar'}
                      </button>
                    </div>

                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">{draftPreviewText(item)}</p>
                    {item.voice_review_notes && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-300">
                        <span className="font-black uppercase tracking-widest text-slate-500">Revisor de voz: </span>
                        {item.voice_review_notes}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleLearnFromItem(index, 'good')} disabled={Boolean(learningIndex)} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-50">
                        {learningIndex === `good:${index}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Usar como referencia
                      </button>
                      <button type="button" onClick={() => handleLearnFromItem(index, 'bad')} disabled={Boolean(learningIndex)} className="inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-500/15 disabled:opacity-50">
                        {learningIndex === `bad:${index}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        Nao e minha voz
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <div className="sticky bottom-4 z-20 rounded-2xl border border-white/10 bg-[#101018]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-white">{kept.size} de {items.length} selecionados</p>
              <p className="mt-0.5 text-xs text-slate-500">Nada e salvo ate voce confirmar aqui.</p>
            </div>
            <button onClick={handleSaveAll} disabled={saving || kept.size === 0} className="premium-button-primary flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar selecionados no board
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PipelinePanel({
  stage,
  detail,
  progress,
  elapsedSeconds,
  active,
  sourcesCount,
  ideasCount,
  postsCount,
}: {
  stage: PipelineStage;
  detail: string;
  progress: { done: number; total: number };
  elapsedSeconds: number;
  active: boolean;
  sourcesCount: number;
  ideasCount: number;
  postsCount: number;
}) {
  const steps: Array<{ id: PipelineStage; label: string; metric: string }> = [
    { id: 'brief', label: 'Brief', metric: 'Expert e objetivo' },
    { id: 'sources', label: 'Fontes', metric: `${sourcesCount} adicionada${sourcesCount === 1 ? '' : 's'}` },
    { id: 'researcher', label: 'Mesa de ideias', metric: ideasCount ? `${ideasCount} ideias` : 'Aguardando' },
    { id: 'copywriter', label: 'Posts gerados', metric: postsCount ? `${postsCount} posts` : progress.total ? `${progress.done}/${progress.total}` : 'Aguardando' },
    { id: 'board', label: 'Board', metric: 'Para revisar' },
  ];
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === stage));

  return (
    <section className="premium-card overflow-hidden">
      <div className="grid grid-cols-1 border-b border-white/5 md:grid-cols-5">
        {steps.map((step, index) => {
          const done = index < currentIndex || (step.id === 'researcher' && ideasCount > 0) || (step.id === 'copywriter' && postsCount > 0);
          const current = index === currentIndex;
          return (
            <div key={step.id} className={`border-white/5 p-4 md:border-r ${current ? 'bg-indigo-500/10' : done ? 'bg-emerald-500/[0.05]' : 'bg-white/[0.01]'}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${done ? 'bg-emerald-400 text-slate-950' : current ? 'bg-indigo-300 text-slate-950' : 'bg-white/10 text-slate-400'}`}>
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <p className="text-sm font-black text-white">{step.label}</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">{step.metric}</p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-indigo-200">
              {active ? 'Em andamento' : 'Pronto'}
            </span>
            {active && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <Clock3 className="h-3.5 w-3.5" /> {elapsedSeconds}s
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{detail}</p>
        </div>
        {progress.total > 0 && active && (
          <div className="min-w-[180px]">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Progresso</span>
              <span>{progress.done}/{progress.total}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-300 to-emerald-300 transition-all" style={{ width: `${Math.max(8, Math.round((progress.done / progress.total) * 100))}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
