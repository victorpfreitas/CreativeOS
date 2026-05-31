import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Wand2,
  Youtube,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ContentIdea, ContentRun, ExpertVoicePost, Project } from '../lib/types';
import * as db from '../lib/database';
import {
  generateXDraftsFromResearch,
  generateXResearchPlan,
  type XBatchSource,
  type XResearchItem,
} from '../services/geminiService';
import { fetchYouTubeSource } from '../services/sourceService';

const inputCls = 'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
const softButtonCls = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50';

type SourceKind = XBatchSource['type'];
type FormatMix = 'x_post' | 'x_thread' | 'mixed';
type ColumnId = 'source' | 'ideas' | 'voice_matched' | 'draft' | 'approved';

const sourceLabels: Record<SourceKind, string> = {
  manual: 'Tema livre',
  x_post: 'Post do X copiado',
  x_url: 'Link de post do X',
  youtube: 'YouTube',
  transcript: 'Transcricao / resumo',
  notes: 'Notas soltas',
};

const columns: Array<{ id: ColumnId; title: string; hint: string }> = [
  { id: 'source', title: 'Fonte recebida', hint: 'Entrada salva e pronta para pesquisa' },
  { id: 'ideas', title: 'Ideias', hint: 'Teses extraidas pelo Researcher' },
  { id: 'voice_matched', title: 'Com voz', hint: 'Ideias conectadas a posts reais' },
  { id: 'draft', title: 'Rascunhos', hint: 'Copy gerada e revisada' },
  { id: 'approved', title: 'Aprovados', hint: 'Ja enviados para o board' },
];

function compactText(value?: string) {
  return (value || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function limitText(value: string | undefined, max: number) {
  const text = compactText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function splitVoicePosts(text: string) {
  return text
    .split(/\n\s*\n/g)
    .map((item) => compactText(item))
    .filter((item) => item.length >= 30);
}

function buildSimpleVoiceProfile(samples: string[]) {
  if (!samples.length) return '';
  const avgLength = Math.round(samples.reduce((sum, sample) => sum + sample.length, 0) / samples.length);
  const hasShortLines = samples.filter((sample) => sample.split('\n').some((line) => line.trim().length > 0 && line.trim().length < 70)).length;
  const hasQuestions = samples.filter((sample) => sample.includes('?')).length;
  const hasFirstPerson = samples.filter((sample) => /\b(eu|meu|minha|pra mim|no meu)\b/i.test(sample)).length;

  return [
    `Perfil consolidado a partir de ${samples.length} posts reais.`,
    `Tamanho medio: ${avgLength} caracteres.`,
    hasShortLines >= samples.length / 2 ? 'Costuma usar linhas curtas e quebras para dar ritmo.' : 'Costuma desenvolver mais a ideia em paragrafos.',
    hasQuestions ? 'Usa perguntas como recurso, mas sem transformar tudo em chamada generica.' : 'Nao depende de perguntas para abrir os posts.',
    hasFirstPerson ? 'Tem marca de experiencia propria e bastidor em primeira pessoa.' : 'A voz tende a ser mais analitica do que confessional.',
    'Priorizar vocabulario, ritmo e cortes presentes nos posts reais. Evitar frases prontas, hype e tom de marca.',
  ].join('\n');
}

function ideaToResearchItem(idea: ContentIdea): XResearchItem {
  return {
    angle: idea.angle,
    thesis: idea.thesis,
    why_it_matters: idea.why_it_matters,
    conversation_trigger: idea.conversation_trigger,
    content_job: idea.content_job,
    best_format: idea.best_format,
    quality_score: idea.quality_score,
    risk_flags: idea.risk_flags || [],
    source_note: idea.source_note,
  };
}

function draftText(idea: ContentIdea) {
  if (idea.best_format === 'x_thread') {
    return (idea.draft_thread_items || []).map((item, index) => `${index + 1}/${idea.draft_thread_items?.length || 0} ${item}`).join('\n\n');
  }
  return idea.draft_body || '';
}

function tokenize(value: string) {
  return compactText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/g)
    .filter((word) => word.length >= 4);
}

function pickVoiceReferences(idea: ContentIdea, posts: ExpertVoicePost[]) {
  const terms = new Set(tokenize([idea.angle, idea.thesis, idea.source_note].join(' ')));
  const scored = posts
    .filter((post) => post.is_reference !== false)
    .map((post) => {
      const postTerms = tokenize(post.text);
      const overlap = postTerms.filter((term) => terms.has(term)).length;
      return { post, score: overlap * 8 + (post.quality || 70) };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((item) => item.post);
}

function memoryLevel(total: number) {
  if (total >= 16) return { label: 'forte', tone: 'emerald', text: 'Boa base para escrever com voz propria.' };
  if (total >= 6) return { label: 'utilizavel', tone: 'amber', text: 'Ja ajuda, mas mais posts reais deixam a IA mais precisa.' };
  return { label: 'fraca', tone: 'red', text: 'Pouco repertorio. A IA tende a cair no generico.' };
}

export default function BatchCreate() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [voicePosts, setVoicePosts] = useState<ExpertVoicePost[]>([]);
  const [runs, setRuns] = useState<ContentRun[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [activeRunId, setActiveRunId] = useState('');

  const [sourceType, setSourceType] = useState<SourceKind>('manual');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [objective, setObjective] = useState('gerar posts para X com ponto de vista forte e voz do expert');
  const [formatMix, setFormatMix] = useState<FormatMix>('mixed');
  const [count, setCount] = useState(6);
  const [voicePaste, setVoicePaste] = useState('');

  const [loading, setLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projects, projectId]);
  const activeRun = useMemo(() => runs.find((run) => run.id === activeRunId) || runs[0], [runs, activeRunId]);
  const activeIdeas = useMemo(() => ideas.filter((idea) => idea.run_id === activeRun?.id), [ideas, activeRun?.id]);
  const memory = memoryLevel(voicePosts.length + (selectedProject?.voice_samples?.length || 0));

  useEffect(() => {
    db.getProjects()
      .then((data) => {
        setProjects(data);
        if (data[0]) setProjectId(data[0].id);
      })
      .catch(() => setError('Nao consegui carregar os experts.'));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    Promise.all([
      db.getExpertVoicePosts(projectId),
      db.getContentRuns(projectId),
      db.getContentIdeas(projectId),
    ])
      .then(([nextVoicePosts, nextRuns, nextIdeas]) => {
        setVoicePosts(nextVoicePosts);
        setRuns(nextRuns);
        setIdeas(nextIdeas);
        setActiveRunId(nextRuns[0]?.id || '');
      })
      .catch(() => setError('Nao consegui carregar a Content Machine deste expert.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function refreshMachine(runId?: string) {
    if (!projectId) return;
    const [nextVoicePosts, nextRuns, nextIdeas] = await Promise.all([
      db.getExpertVoicePosts(projectId),
      db.getContentRuns(projectId),
      db.getContentIdeas(projectId),
    ]);
    setVoicePosts(nextVoicePosts);
    setRuns(nextRuns);
    setIdeas(nextIdeas);
    if (runId) setActiveRunId(runId);
    else if (!activeRunId && nextRuns[0]) setActiveRunId(nextRuns[0].id);
  }

  function setRunLocal(run: ContentRun) {
    setRuns((current) => current.map((item) => (item.id === run.id ? run : item)));
  }

  function setIdeaLocal(idea: ContentIdea) {
    setIdeas((current) => current.map((item) => (item.id === idea.id ? idea : item)));
  }

  async function handleLoadYouTube() {
    if (!sourceUrl.trim()) {
      setError('Cole a URL do YouTube antes de buscar.');
      return;
    }
    setSourceLoading(true);
    setError('');
    try {
      const source = await fetchYouTubeSource(sourceUrl);
      setSourceType('youtube');
      setSourceTitle(source.title || sourceTitle || 'Video do YouTube');
      setSourceUrl(source.url || sourceUrl);
      setSourceText(source.text || source.note || '');
      setNotice(source.text ? 'Transcricao adicionada. Revise a fonte antes de criar o card.' : 'Nao veio transcricao automatica. Cole um resumo ou transcricao manual.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui carregar esse video. Cole a transcricao manualmente.');
    } finally {
      setSourceLoading(false);
    }
  }

  async function handleAddVoicePosts() {
    if (!selectedProject) return;
    const samples = splitVoicePosts(voicePaste);
    if (!samples.length) {
      setError('Cole posts reais separados por uma linha em branco.');
      return;
    }
    setBusyKey('voice');
    setError('');
    try {
      await db.createExpertVoicePosts(samples.map((text) => ({
        project_id: selectedProject.id,
        text,
        source_type: 'manual',
        tags: [],
        quality: 80,
        is_reference: true,
      })));
      const mergedSamples = [...(selectedProject.voice_samples || []), ...samples].slice(-50);
      const nextProfile = buildSimpleVoiceProfile(mergedSamples);
      const updated = await db.updateProject(selectedProject.id, {
        voice_samples: mergedSamples,
        voice_profile: nextProfile,
      });
      setProjects((current) => current.map((project) => (project.id === updated.id ? updated : project)));
      setVoicePaste('');
      await refreshMachine();
      setNotice(`${samples.length} posts reais adicionados a memoria do expert.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui salvar a memoria de voz.');
    } finally {
      setBusyKey('');
    }
  }

  async function handleCreateRun() {
    if (!selectedProject) return;
    const cleanSource = compactText(sourceText);
    const cleanTitle = compactText(sourceTitle) || limitText(cleanSource, 70) || sourceLabels[sourceType];
    if (!cleanSource && !sourceUrl.trim() && !cleanTitle) {
      setError('Adicione uma fonte, tema, notas ou transcricao antes de criar o card.');
      return;
    }
    setBusyKey('run');
    setError('');
    try {
      const run = await db.createContentRun({
        project_id: selectedProject.id,
        title: cleanTitle,
        source_type: sourceType,
        source_url: sourceUrl.trim(),
        source_text: cleanSource || cleanTitle,
        objective: compactText(objective),
        format_mix: formatMix,
        requested_count: count,
      });
      setRuns((current) => [run, ...current]);
      setActiveRunId(run.id);
      setSourceTitle('');
      setSourceUrl('');
      setSourceText('');
      setNotice('Fonte salva no kanban. Agora rode o Researcher neste card.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui criar o run.');
    } finally {
      setBusyKey('');
    }
  }

  async function handleResearch(run: ContentRun) {
    if (!selectedProject) return;
    setBusyKey(`research:${run.id}`);
    setError('');
    try {
      const researching = await db.updateContentRun(run.id, { status: 'researching', current_stage: 'researcher', error: '' });
      setRunLocal(researching);
      const approvedDrafts = await db.getContentDrafts();
      const approvedExamples = approvedDrafts
        .filter((draft) => draft.project_id === selectedProject.id && draft.status === 'approved')
        .slice(0, 6)
        .map((draft) => (draft.format === 'x_thread' ? draft.thread_items.join('\n') : draft.body))
        .filter(Boolean);
      const result = await generateXResearchPlan({
        mode: 'topic',
        topic: run.title,
        count: run.requested_count,
        formatMix: run.format_mix,
        styleGuidance: run.objective,
        brandDNA: selectedProject.brand_dna,
        knowledgeBase: selectedProject.knowledge_base,
        voiceSamples: selectedProject.voice_samples,
        approvedExamples,
        voiceLearningNotes: selectedProject.voice_learning_notes,
        voiceProfile: selectedProject.voice_profile,
        sources: [{ type: run.source_type, title: run.title, url: run.source_url, text: run.source_text }],
      });
      const created = await db.createContentIdeas(result.items.map((item) => ({
        run_id: run.id,
        project_id: selectedProject.id,
        status: 'ideas',
        angle: item.angle,
        thesis: item.thesis,
        why_it_matters: item.why_it_matters,
        conversation_trigger: item.conversation_trigger,
        content_job: item.content_job,
        best_format: item.best_format,
        quality_score: item.quality_score,
        risk_flags: item.risk_flags,
        source_note: item.source_note,
        selected_voice_post_ids: [],
      })));
      setIdeas((current) => [...created, ...current.filter((idea) => idea.run_id !== run.id)]);
      const ready = await db.updateContentRun(run.id, { status: 'ideas_ready', current_stage: 'voice_matcher', error: '' });
      setRunLocal(ready);
      setNotice(`${created.length} ideias criadas. Aprove as que merecem receber voz.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'A IA falhou nesta etapa.';
      const failed = await db.updateContentRun(run.id, { status: 'error', current_stage: 'researcher', error: message });
      setRunLocal(failed);
      setError(message);
    } finally {
      setBusyKey('');
    }
  }

  async function handleMatchVoice(idea: ContentIdea) {
    setBusyKey(`voice:${idea.id}`);
    setError('');
    try {
      const refs = pickVoiceReferences(idea, voicePosts);
      if (!refs.length) {
        throw new Error('Este expert ainda nao tem posts reais suficientes na memoria de voz.');
      }
      const updated = await db.updateContentIdea(idea.id, {
        status: 'voice_matched',
        selected_voice_post_ids: refs.map((ref) => ref.id),
        voice_reference_excerpt: refs.map((ref, index) => `${index + 1}. ${limitText(ref.text, 220)}`).join('\n\n'),
        error: '',
      });
      setIdeaLocal(updated);
      await Promise.all(refs.map((ref) => db.createVoiceLearningEvent({
        project_id: idea.project_id,
        event_type: 'used_as_reference',
        instruction: `Referencia de voz usada na ideia: ${idea.angle}`,
        after_text: limitText(ref.text, 500),
      })));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao consegui conectar referencias de voz.';
      const updated = await db.updateContentIdea(idea.id, { status: 'error', error: message });
      setIdeaLocal(updated);
      setError(message);
    } finally {
      setBusyKey('');
    }
  }

  async function handleWriteDraft(idea: ContentIdea) {
    if (!selectedProject || !activeRun) return;
    setBusyKey(`draft:${idea.id}`);
    setError('');
    try {
      const refs = voicePosts.filter((post) => idea.selected_voice_post_ids.includes(post.id));
      const result = await generateXDraftsFromResearch({
        mode: 'topic',
        topic: activeRun.title,
        count: 1,
        formatMix: idea.best_format,
        researchItems: [ideaToResearchItem(idea)],
        styleGuidance: activeRun.objective,
        brandDNA: selectedProject.brand_dna,
        knowledgeBase: selectedProject.knowledge_base,
        voiceSamples: [...refs.map((ref) => ref.text), ...(selectedProject.voice_samples || [])].slice(0, 12),
        approvedExamples: [],
        voiceLearningNotes: selectedProject.voice_learning_notes,
        voiceProfile: selectedProject.voice_profile,
        sources: [{ type: activeRun.source_type, title: activeRun.title, url: activeRun.source_url, text: activeRun.source_text }],
      });
      const item = result.items[0];
      if (!item) throw new Error('A IA nao devolveu nenhum rascunho.');
      const updated = await db.updateContentIdea(idea.id, {
        status: 'draft',
        draft_title: item.title,
        draft_hook: item.hook,
        draft_body: item.body,
        draft_thread_items: item.thread_items,
        draft_objective: item.objective,
        draft_variants: item.variants,
        voice_notes_used: item.voice_notes_used,
        voice_review_score: item.voice_review_score,
        voice_review_verdict: item.voice_review_verdict,
        voice_review_notes: item.voice_review_notes,
        error: '',
      });
      setIdeaLocal(updated);
      const nextRun = await db.updateContentRun(activeRun.id, { status: 'ready', current_stage: 'voice_reviewer', error: '' });
      setRunLocal(nextRun);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao consegui escrever este draft.';
      const updated = await db.updateContentIdea(idea.id, { status: 'error', error: message });
      setIdeaLocal(updated);
      setError(message);
    } finally {
      setBusyKey('');
    }
  }

  async function handleRejectVoice(idea: ContentIdea) {
    setBusyKey(`reject:${idea.id}`);
    try {
      const text = draftText(idea);
      await db.createVoiceLearningEvent({
        project_id: idea.project_id,
        event_type: 'rejected_voice',
        format: idea.best_format,
        after_text: limitText(text, 900),
        instruction: 'O usuario marcou este rascunho como fora da voz. Nao consolidar como memoria permanente.',
      });
      const updated = await db.updateContentIdea(idea.id, {
        status: 'draft',
        voice_review_verdict: 'reject',
        voice_review_notes: 'Marcado manualmente como fora da voz. Regerar antes de aprovar.',
      });
      setIdeaLocal(updated);
      setNotice('Feedback registrado sem contaminar a memoria permanente.');
    } finally {
      setBusyKey('');
    }
  }

  async function handleApproveDraft(idea: ContentIdea) {
    if (!selectedProject || !activeRun) return;
    const text = draftText(idea);
    if (!text.trim()) return;
    setBusyKey(`approve:${idea.id}`);
    setError('');
    try {
      const draft = await db.createContentDraft({
        project_id: selectedProject.id,
        run_id: activeRun.id,
        idea_id: idea.id,
        format: idea.best_format,
        status: 'review',
        title: idea.draft_title || idea.angle,
        topic: activeRun.title,
        body: idea.best_format === 'x_thread' ? '' : idea.draft_body || '',
        thread_items: idea.best_format === 'x_thread' ? idea.draft_thread_items || [] : [],
        objective: idea.draft_objective || activeRun.objective,
        hook: idea.draft_hook || '',
        variants: idea.draft_variants || [],
        voice_notes_used: idea.voice_notes_used || '',
        content_angle: idea.angle,
        research_thesis: idea.thesis,
        research_context: [idea.why_it_matters, idea.conversation_trigger, idea.source_note].filter(Boolean).join('\n'),
        voice_review_score: idea.voice_review_score,
        voice_review_verdict: idea.voice_review_verdict,
        voice_review_notes: idea.voice_review_notes,
        batch_id: activeRun.id,
        source_type: activeRun.source_type,
        source_url: activeRun.source_url || '',
        source_title: activeRun.title,
        source_excerpt: limitText(activeRun.source_text, 700),
        source_refs: [activeRun.title, activeRun.source_url || ''].filter(Boolean),
        selected_voice_post_ids: idea.selected_voice_post_ids,
        generation_trace: `run:${activeRun.id}; idea:${idea.id}; stages: researcher -> voice_matcher -> copywriter -> voice_reviewer`,
      });
      await db.createVoiceLearningEvent({
        project_id: selectedProject.id,
        draft_id: draft.id,
        event_type: 'approved',
        format: draft.format,
        after_text: limitText(text, 900),
        instruction: 'Draft aprovado no Content Machine v3 e enviado para Para revisar.',
      });
      await db.createExpertVoicePost({
        project_id: selectedProject.id,
        text,
        source_type: activeRun.source_type,
        source_url: activeRun.source_url,
        tags: ['approved-draft'],
        quality: 85,
        is_reference: true,
      });
      const updated = await db.updateContentIdea(idea.id, { status: 'approved', draft_id: draft.id, error: '' });
      setIdeaLocal(updated);
      await refreshMachine(activeRun.id);
      setNotice('Draft aprovado, salvo no Content Board e adicionado como sinal forte de voz.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui aprovar este draft.');
    } finally {
      setBusyKey('');
    }
  }

  function ideasForColumn(column: ColumnId) {
    if (column === 'ideas') return activeIdeas.filter((idea) => idea.status === 'ideas' || idea.status === 'error');
    if (column === 'voice_matched') return activeIdeas.filter((idea) => idea.status === 'voice_matched');
    if (column === 'draft') return activeIdeas.filter((idea) => idea.status === 'draft');
    if (column === 'approved') return activeIdeas.filter((idea) => idea.status === 'approved');
    return [];
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16 pt-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-indigo-300">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
              <Sparkles className="h-4 w-4" /> Content Machine v3
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Memoria + Kanban de posts para X</h1>
            <p className="mt-1 text-sm text-slate-500">Fonte, ideias, voz, rascunho e aprovacao em etapas claras.</p>
          </div>
        </div>
        <button onClick={() => navigate('/queue')} className={softButtonCls}>
          <ClipboardList className="h-4 w-4" /> Abrir Content Board
        </button>
      </header>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">{notice}</div>}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="premium-card space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px_160px]">
            <div className="space-y-2">
              <label className="premium-label">Expert</label>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputCls}>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="premium-label">Formato</label>
              <select value={formatMix} onChange={(event) => setFormatMix(event.target.value as FormatMix)} className={inputCls}>
                <option value="mixed">Misto</option>
                <option value="x_post">Posts</option>
                <option value="x_thread">Threads</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="premium-label">Ideias ({count})</label>
              <input type="range" min={1} max={12} value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-4 w-full accent-indigo-500" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="premium-label">Objetivo do lote</label>
            <input value={objective} onChange={(event) => setObjective(event.target.value)} className={inputCls} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[190px_1fr]">
              <div className="space-y-2">
                <label className="premium-label">Tipo de fonte</label>
                <select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceKind)} className={inputCls}>
                  {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="premium-label">Titulo / tema</label>
                <input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Ex: erros comuns em videos de IA" className={inputCls} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
              <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="URL opcional, YouTube ou X" className={inputCls} />
              <button type="button" onClick={handleLoadYouTube} disabled={sourceLoading || !sourceUrl.trim()} className={softButtonCls}>
                {sourceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />} Buscar YouTube
              </button>
            </div>
            <textarea rows={7} value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Cole post do X, transcricao, resumo, notas soltas ou o tema com contexto." className={`${inputCls} mt-4`} />
            <button type="button" onClick={handleCreateRun} disabled={busyKey === 'run' || !selectedProject} className="premium-button-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50">
              {busyKey === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Criar card de fonte
            </button>
          </div>
        </div>

        <div className="premium-card space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="premium-label">Memoria de voz</p>
              <h2 className="mt-1 text-lg font-black text-white">Base {memory.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{memory.text}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 text-center ${memory.tone === 'emerald' ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100' : memory.tone === 'amber' ? 'border-amber-400/25 bg-amber-500/10 text-amber-100' : 'border-red-400/25 bg-red-500/10 text-red-100'}`}>
              <p className="text-2xl font-black">{voicePosts.length}</p>
              <p className="text-[10px] font-black uppercase tracking-widest">posts</p>
            </div>
          </div>
          <textarea rows={8} value={voicePaste} onChange={(event) => setVoicePaste(event.target.value)} placeholder={'Cole posts reais do expert separados por linha em branco.\n\nIsso vira a memoria que o Voice Matcher usa antes de escrever.'} className={inputCls} />
          <button type="button" onClick={handleAddVoicePosts} disabled={busyKey === 'voice' || !selectedProject} className={softButtonCls}>
            {busyKey === 'voice' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar posts na memoria
          </button>
          <div className="space-y-2">
            {voicePosts.slice(0, 3).map((post) => (
              <div key={post.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
                {limitText(post.text, 180)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="premium-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="premium-label">Run ativo</p>
            <h2 className="mt-1 text-lg font-black text-white">{activeRun?.title || 'Nenhum card de fonte ainda'}</h2>
            {activeRun && <p className="mt-1 text-sm text-slate-500">{sourceLabels[activeRun.source_type]} - {limitText(activeRun.source_text, 120)}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {runs.slice(0, 6).map((run) => (
              <button key={run.id} onClick={() => setActiveRunId(run.id)} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${activeRun?.id === run.id ? 'bg-indigo-500 text-white' : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}>
                {limitText(run.title, 28)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm font-bold text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando Content Machine...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-0 xl:grid-cols-5">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                run={activeRun}
                ideas={ideasForColumn(column.id)}
                voicePosts={voicePosts}
                busyKey={busyKey}
                onResearch={handleResearch}
                onMatchVoice={handleMatchVoice}
                onWriteDraft={handleWriteDraft}
                onRejectVoice={handleRejectVoice}
                onApproveDraft={handleApproveDraft}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function KanbanColumn({
  column,
  run,
  ideas,
  voicePosts,
  busyKey,
  onResearch,
  onMatchVoice,
  onWriteDraft,
  onRejectVoice,
  onApproveDraft,
}: {
  column: { id: ColumnId; title: string; hint: string };
  run?: ContentRun;
  ideas: ContentIdea[];
  voicePosts: ExpertVoicePost[];
  busyKey: string;
  onResearch: (run: ContentRun) => void;
  onMatchVoice: (idea: ContentIdea) => void;
  onWriteDraft: (idea: ContentIdea) => void;
  onRejectVoice: (idea: ContentIdea) => void;
  onApproveDraft: (idea: ContentIdea) => void;
}) {
  return (
    <div className="min-h-[520px] border-b border-white/10 p-3 xl:border-b-0 xl:border-r">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-white">{column.title}</h3>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-black text-slate-400">
            {column.id === 'source' && run ? 1 : ideas.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-600">{column.hint}</p>
      </div>

      <div className="space-y-3">
        {column.id === 'source' && run && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">{sourceLabels[run.source_type]}</p>
                <h4 className="mt-2 text-sm font-black leading-snug text-white">{run.title}</h4>
              </div>
              {run.status === 'error' && <AlertTriangle className="h-4 w-4 text-amber-300" />}
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-400">{limitText(run.source_text, 420)}</p>
            {run.error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold text-red-100">{run.error}</p>}
            <button onClick={() => onResearch(run)} disabled={busyKey === `research:${run.id}`} className="premium-button-primary mt-4 inline-flex w-full items-center justify-center gap-2 disabled:opacity-50">
              {busyKey === `research:${run.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : run.status === 'error' ? <RefreshCw className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
              {run.status === 'error' ? 'Tentar Researcher de novo' : 'Rodar Researcher'}
            </button>
          </div>
        )}

        {column.id !== 'source' && ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            voicePosts={voicePosts}
            busyKey={busyKey}
            onMatchVoice={onMatchVoice}
            onWriteDraft={onWriteDraft}
            onRejectVoice={onRejectVoice}
            onApproveDraft={onApproveDraft}
          />
        ))}
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  voicePosts,
  busyKey,
  onMatchVoice,
  onWriteDraft,
  onRejectVoice,
  onApproveDraft,
}: {
  idea: ContentIdea;
  voicePosts: ExpertVoicePost[];
  busyKey: string;
  onMatchVoice: (idea: ContentIdea) => void;
  onWriteDraft: (idea: ContentIdea) => void;
  onRejectVoice: (idea: ContentIdea) => void;
  onApproveDraft: (idea: ContentIdea) => void;
}) {
  const refs = voicePosts.filter((post) => idea.selected_voice_post_ids.includes(post.id));
  const text = draftText(idea);
  const isBusy = busyKey.endsWith(idea.id);

  return (
    <div className={`rounded-2xl border p-4 ${idea.status === 'error' ? 'border-red-400/30 bg-red-500/[0.06]' : idea.status === 'approved' ? 'border-emerald-400/30 bg-emerald-500/[0.07]' : 'border-white/10 bg-black/20'}`}>
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-300">
        <span>{idea.best_format === 'x_thread' ? 'Thread' : 'Post'}</span>
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-slate-400 normal-case tracking-normal">{idea.content_job}</span>
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-slate-400 normal-case tracking-normal">Score {idea.quality_score}</span>
      </div>
      <h4 className="mt-2 text-sm font-black leading-snug text-white">{idea.angle}</h4>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">{idea.thesis}</p>

      {idea.status === 'error' && idea.error && (
        <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold text-red-100">{idea.error}</p>
      )}

      {refs.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Referencias de voz</p>
          {refs.map((ref) => (
            <p key={ref.id} className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] p-2 text-xs leading-relaxed text-emerald-50/80">
              {limitText(ref.text, 170)}
            </p>
          ))}
        </div>
      )}

      {text && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">{text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
            <span>{idea.best_format === 'x_thread' ? `${idea.draft_thread_items?.length || 0} blocos` : `${text.length} caracteres`}</span>
            {typeof idea.voice_review_score === 'number' && (
              <span className={`rounded-full px-2 py-0.5 ${idea.voice_review_verdict === 'pass' ? 'bg-emerald-500/15 text-emerald-200' : idea.voice_review_verdict === 'reject' ? 'bg-red-500/15 text-red-200' : 'bg-amber-500/15 text-amber-100'}`}>
                Voz {idea.voice_review_score}
              </span>
            )}
          </div>
          {idea.voice_review_notes && <p className="mt-2 text-xs leading-relaxed text-slate-400">{idea.voice_review_notes}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {idea.status === 'ideas' || idea.status === 'error' ? (
          <button onClick={() => onMatchVoice(idea)} disabled={isBusy} className={softButtonCls}>
            {busyKey === `voice:${idea.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Aprovar ideia
          </button>
        ) : null}

        {idea.status === 'voice_matched' ? (
          <button onClick={() => onWriteDraft(idea)} disabled={isBusy} className={softButtonCls}>
            {busyKey === `draft:${idea.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Escrever
          </button>
        ) : null}

        {idea.status === 'draft' ? (
          <>
            <button onClick={() => onApproveDraft(idea)} disabled={isBusy || !text.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-400 disabled:opacity-50">
              {busyKey === `approve:${idea.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Aprovar
            </button>
            <button onClick={() => onRejectVoice(idea)} disabled={isBusy} className={softButtonCls}>
              <AlertTriangle className="h-4 w-4" /> Nao e minha voz
            </button>
            <button onClick={() => onWriteDraft(idea)} disabled={isBusy} className={softButtonCls}>
              <RefreshCw className="h-4 w-4" /> Regerar
            </button>
          </>
        ) : null}

        {idea.status === 'approved' ? (
          <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100">
            <Check className="h-4 w-4" /> No board
          </span>
        ) : null}
      </div>
    </div>
  );
}
