import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, FileText, Link2, Loader2, RefreshCw, Rss, Sparkles, Target, Wand2, Youtube } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ContentBrief, ContentStrategy, Project } from '../lib/types';
import * as db from '../lib/database';
import { carouselTemplates, getCarouselTemplate } from '../lib/carouselTemplates';
import { defaultColorPaletteId, defaultFontPresetId, getCarouselColorPalette } from '../lib/carouselVisuals';
import { expertContentPresets, getExpertContentPreset } from '../lib/contentPresets';
import { generateContentStrategy, generateSourceCarouselStrategy } from '../services/geminiService';
import { fetchRssSource, fetchYouTubeSource, getYouTubeThumbnail, getYouTubeThumbnailCandidates, resolveSourceImage, type SourcePreview } from '../services/sourceService';
import { assessQueueState } from '../lib/queueUtils';
import { getSourceCaptureStatusLabel, getSourceCaptureTypeLabel, pickResolvedSourceImageUrl } from '../lib/sourceCapture';
import { getTranscriptSourceLabel, getTranscriptStatusLabel } from '../lib/sourceTranscript';

const inputCls = 'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
type SourceType = NonNullable<ContentBrief['source_type']>;

const angleSuggestions = {
  manual: [
    'O erro silencioso que trava experts bons',
    'O que parece organizacao, mas mata a demanda',
    'Por que conteudo bonito nao vira venda',
  ],
  youtube: [
    'A leitura mais util desse video para quem vende servico premium',
    'O ponto que quase todo mundo perde nessa aula',
    'Como transformar esse conteudo em decisao pratica',
  ],
  rss: [
    'O que essa noticia muda na pratica para o mercado',
    'A tese por tras desse movimento',
    'Como usar esse gancho sem soar oportunista',
  ],
} satisfies Record<SourceType, string[]>;

const sourceNoteTemplates = {
  manual: 'Contexto rapido:\n- \n\nPonto principal:\n- \n\nExemplo ou bastidor:\n- ',
  youtube: 'Resumo do video:\n- \n\nPontos mais fortes:\n- \n- \n\nFrase ou argumento que merece virar carrossel:\n- ',
  rss: 'Resumo da materia:\n- \n\nDado, movimento ou noticia principal:\n- \n\nLeitura editorial que queremos fazer:\n- ',
} satisfies Record<SourceType, string>;

export default function CreateContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedProjectId = searchParams.get('project') || '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showRefinement, setShowRefinement] = useState(false);
  const [error, setError] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [strategy, setStrategy] = useState<ContentStrategy | null>(null);
  const [sourcePreview, setSourcePreview] = useState<SourcePreview | null>(null);

  const [brief, setBrief] = useState<ContentBrief>({
    project_id: '',
    topic: '',
    goal: expertContentPresets[0].goal,
    audience: '',
    cta: expertContentPresets[0].defaultCta,
    preset_id: expertContentPresets[0].id,
    template_id: carouselTemplates[0].id,
    source_notes: '',
    source_type: 'manual',
    source_url: '',
    source_title: '',
    source_image_url: '',
    source_excerpt: '',
    source_capture_type: undefined,
    source_capture_url: '',
    source_capture_status: undefined,
    source_capture_note: '',
    source_transcript: '',
    source_transcript_language: '',
    source_transcript_source: undefined,
    source_transcript_status: undefined,
    source_transcript_note: '',
  });

  useEffect(() => {
    db.getProjects()
      .then(setProjects)
      .catch((err) => {
        console.error(err);
        setError('Nao consegui carregar seus projetos. Tente recarregar a pagina.');
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!preselectedProjectId || loadingProjects) return;
    setBrief((prev) => prev.project_id ? prev : { ...prev, project_id: preselectedProjectId });
  }, [loadingProjects, preselectedProjectId]);

  const selectedProject = projects.find((project) => project.id === brief.project_id);
  const selectedPreset = useMemo(() => getExpertContentPreset(brief.preset_id), [brief.preset_id]);
  const selectedTemplate = useMemo(() => getCarouselTemplate(brief.template_id), [brief.template_id]);
  const sourceType: SourceType = brief.source_type ?? 'manual';
  const sourceNotes = brief.source_notes ?? '';
  const sourceUrl = brief.source_url ?? '';
  const sourceExcerpt = brief.source_excerpt ?? '';
  const sourceTitle = brief.source_title ?? '';
  const sourceImageUrl = brief.source_image_url ?? '';
  const sourceCaptureType = brief.source_capture_type;
  const sourceCaptureUrl = brief.source_capture_url ?? '';
  const sourceCaptureStatus = brief.source_capture_status;
  const sourceCaptureNote = brief.source_capture_note ?? '';
  const sourceTranscript = brief.source_transcript ?? '';
  const sourceTranscriptLanguage = brief.source_transcript_language ?? '';
  const sourceTranscriptSource = brief.source_transcript_source;
  const sourceTranscriptStatus = brief.source_transcript_status;
  const sourceTranscriptNote = brief.source_transcript_note ?? '';
  const isSourceFlow = sourceType === 'youtube' || sourceType === 'rss';
  const selectedAngleSuggestions = angleSuggestions[sourceType];
  const selectedSourceTemplate = sourceNoteTemplates[sourceType];
  const angleReady = brief.topic.trim().length > 0;
  const hasRefinement = brief.audience.trim().length > 0 || brief.cta.trim().length > 0 || brief.goal.trim().length > 0;
  const resolvedSourceImageUrl = pickResolvedSourceImageUrl(sourceCaptureUrl, sourceImageUrl);

  const sourceStatus = useMemo(() => {
    if (sourceType === 'manual') {
      return {
        ready: brief.topic.trim().length > 0 || sourceNotes.trim().length > 0,
        title: 'Ideia em montagem',
        detail: brief.topic.trim() ? 'A ideia principal ja foi definida.' : 'Descreva a ideia central ou cole bastidores para a IA sair do generico.',
      };
    }

    if (!sourceUrl.trim()) {
      return {
        ready: false,
        title: 'URL pendente',
        detail: 'Cole a URL da fonte para iniciar o draft a partir de uma base clara.',
      };
    }

    if (sourceType === 'youtube' && !sourceNotes.trim() && !sourceTranscript.trim()) {
      return {
        ready: false,
        title: 'Falta contexto do video',
        detail: 'A URL ja esta aqui. Se a transcricao nao vier automaticamente, complemente com resumo ou bullets principais.',
      };
    }

    if (sourceType === 'rss' && !sourceExcerpt.trim() && !sourceNotes.trim()) {
      return {
        ready: false,
        title: 'Fonte nao confirmada',
        detail: 'Busque a fonte para puxar titulo, resumo e imagem antes de gerar.',
      };
    }

    return {
      ready: true,
      title: 'Fonte pronta',
      detail: 'A base ja foi entendida. Agora ajuste o angulo e gere o draft.',
    };
  }, [brief.topic, sourceExcerpt, sourceNotes, sourceType, sourceUrl]);

  const canGenerate = sourceStatus.ready && angleReady;
  const generateHint = !sourceStatus.ready
    ? sourceStatus.detail
    : !angleReady
      ? 'Defina o angulo desejado para a IA transformar a fonte em tese e narrativa.'
      : 'Tudo certo para gerar o draft estrategico.';
  const readinessItems = [
    {
      label: 'Fonte',
      done: sourceStatus.ready,
      detail: sourceStatus.detail,
    },
    {
      label: 'Angulo',
      done: angleReady,
      detail: angleReady ? 'A leitura editorial do draft ja foi definida.' : 'Falta dizer qual recorte ou tese queremos tirar dessa base.',
    },
    {
      label: 'Refino',
      done: brief.audience.trim().length > 0 || brief.cta.trim().length > 0 || brief.goal.trim().length > 0,
      detail: 'Objetivo, publico e CTA refinam o draft, mas nao precisam travar a geracao.',
    },
  ];
  const readinessCompleted = readinessItems.filter((item) => item.done).length;
  const readinessPercent = Math.round((readinessCompleted / readinessItems.length) * 100);

  function updateBrief<K extends keyof ContentBrief>(field: K, value: ContentBrief[K]) {
    setBrief((prev) => {
      if (field === 'source_url') {
        return {
          ...prev,
          [field]: value,
          source_title: sourceType === 'youtube' ? prev.source_title : '',
          source_image_url: '',
          source_excerpt: '',
          source_capture_type: undefined,
          source_capture_url: '',
          source_capture_status: undefined,
          source_capture_note: '',
          source_transcript: '',
          source_transcript_language: '',
          source_transcript_source: undefined,
          source_transcript_status: undefined,
          source_transcript_note: '',
        };
      }
      return { ...prev, [field]: value };
    });
    setStrategy(null);
    if (field === 'source_type' || field === 'source_url') setSourcePreview(null);
    if (field === 'source_type' || field === 'source_url' || field === 'source_notes') setSourceError('');
  }

  function choosePreset(id: string) {
    const preset = getExpertContentPreset(id);
    setBrief((prev) => ({
      ...prev,
      preset_id: preset.id,
      goal: preset.goal,
      cta: preset.defaultCta,
    }));
    setStrategy(null);
  }

  function chooseSourceType(sourceType: ContentBrief['source_type']) {
    setBrief((prev) => ({
      ...prev,
      source_type: sourceType,
      template_id: sourceType === 'manual' ? prev.template_id : 'paper-manifesto-image',
      source_url: sourceType === 'manual' ? '' : prev.source_url,
      source_title: sourceType === 'manual' ? '' : prev.source_title,
      source_image_url: '',
      source_excerpt: sourceType === 'manual' ? '' : prev.source_excerpt,
      source_notes: sourceType === 'manual' ? '' : prev.source_notes,
      source_capture_type: undefined,
      source_capture_url: '',
      source_capture_status: undefined,
      source_capture_note: '',
      source_transcript: '',
      source_transcript_language: '',
      source_transcript_source: undefined,
      source_transcript_status: undefined,
      source_transcript_note: '',
    }));
    setStrategy(null);
    setSourcePreview(null);
    setSourceError('');
  }

  function applySourceNotesTemplate() {
    if (sourceNotes.trim()) return;
    updateBrief('source_notes', selectedSourceTemplate);
    setShowRefinement(true);
  }

  function resetSourceFlow() {
    setBrief((prev) => ({
      ...prev,
      topic: '',
      source_url: '',
      source_title: '',
      source_image_url: '',
      source_excerpt: '',
      source_notes: '',
      source_capture_type: undefined,
      source_capture_url: '',
      source_capture_status: undefined,
      source_capture_note: '',
      source_transcript: '',
      source_transcript_language: '',
      source_transcript_source: undefined,
      source_transcript_status: undefined,
      source_transcript_note: '',
    }));
    setSourcePreview(null);
    setStrategy(null);
    setError('');
    setSourceError('');
  }

  async function handleLoadSource() {
    if (!sourceUrl.trim()) {
      setSourceError('Cole uma URL antes de confirmar a fonte.');
      return;
    }

    setLoadingSource(true);
    setError('');
    setSourceError('');
    setStrategy(null);
    try {
      if (sourceType === 'youtube') {
        const youtubeSource = await fetchYouTubeSource(sourceUrl);
        const imageUrl = youtubeSource.imageUrl || getYouTubeThumbnailCandidates(sourceUrl)[0] || getYouTubeThumbnail(sourceUrl);
        const resolvedImage = youtubeSource.sourceCaptureUrl
          ? {
              sourceCaptureType: youtubeSource.sourceCaptureType,
              sourceCaptureUrl: youtubeSource.sourceCaptureUrl,
              sourceCaptureStatus: youtubeSource.sourceCaptureStatus,
              sourceCaptureNote: youtubeSource.sourceCaptureNote,
            }
          : await resolveSourceImage({
              sourceType,
              sourceUrl,
              sourceImageUrl: imageUrl,
              projectId: brief.project_id,
            });
        const transcriptText = youtubeSource.text || '';
        const nextPreview: SourcePreview = {
          title: youtubeSource.title || sourceTitle || 'Video do YouTube',
          url: sourceUrl,
          imageUrl: pickResolvedSourceImageUrl(resolvedImage.sourceCaptureUrl, imageUrl),
          excerpt: transcriptText.slice(0, 700) || '',
          text: transcriptText,
        };
        setSourcePreview(nextPreview);
        setBrief((prev) => ({
          ...prev,
          topic: prev.topic || nextPreview.title,
          source_title: nextPreview.title || prev.source_title || 'Video do YouTube',
          source_image_url: pickResolvedSourceImageUrl(resolvedImage.sourceCaptureUrl, imageUrl),
          source_excerpt: nextPreview.excerpt,
          source_notes: transcriptText
            ? (prev.source_transcript?.trim() === transcriptText.trim()
                ? prev.source_notes
                : (prev.source_notes || '').trim()
                    ? `${transcriptText}\n\nNotas editoriais complementares:\n${(prev.source_notes || '').replace(prev.source_transcript || '', '').trim()}`
                    : transcriptText)
            : prev.source_notes,
          source_capture_type: resolvedImage.sourceCaptureType,
          source_capture_url: resolvedImage.sourceCaptureUrl || '',
          source_capture_status: resolvedImage.sourceCaptureStatus,
          source_capture_note: resolvedImage.sourceCaptureNote || youtubeSource.note || '',
          source_transcript: transcriptText,
          source_transcript_language: youtubeSource.language || '',
          source_transcript_source: youtubeSource.transcriptSource,
          source_transcript_status: transcriptText ? 'ready' : 'failed',
          source_transcript_note: youtubeSource.note || '',
        }));
      } else if (sourceType === 'rss') {
        const preview = await fetchRssSource(sourceUrl);
        const resolvedImage = await resolveSourceImage({
          sourceType,
          sourceUrl: preview.url || sourceUrl,
          sourceImageUrl: preview.imageUrl,
          projectId: brief.project_id,
        });
        const resolvedImageUrl = pickResolvedSourceImageUrl(resolvedImage.sourceCaptureUrl, preview.imageUrl);
        setSourcePreview(preview);
        setBrief((prev) => ({
          ...prev,
          topic: prev.topic || preview.title,
          source_title: preview.title,
          source_url: preview.url || prev.source_url,
          source_image_url: resolvedImageUrl,
          source_excerpt: preview.excerpt,
          source_notes: prev.source_notes || preview.text,
          source_capture_type: resolvedImage.sourceCaptureType,
          source_capture_url: resolvedImage.sourceCaptureUrl || '',
          source_capture_status: resolvedImage.sourceCaptureStatus,
          source_capture_note: resolvedImage.sourceCaptureNote || '',
        }));
        setSourcePreview({ ...preview, imageUrl: resolvedImageUrl });
      }
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Nao consegui carregar essa fonte.');
    } finally {
      setLoadingSource(false);
    }
  }

  async function handleGenerate() {
    if (!isSourceFlow && !brief.topic.trim()) {
      setError('Descreva a ideia central do carrossel antes de gerar.');
      return;
    }
    if (isSourceFlow && !sourceUrl.trim()) {
      setError('Cole a URL da fonte antes de gerar.');
      return;
    }
    if (sourceType === 'youtube' && !sourceNotes.trim() && !sourceTranscript.trim()) {
      setError('Nao veio transcricao automatica para este video. Cole um resumo, transcricao ou bullets para gerar com fidelidade.');
      return;
    }
    if (sourceType === 'rss' && !sourceNotes.trim() && !sourceExcerpt.trim()) {
      setError('Busque a fonte RSS/portal antes de gerar, ou cole um trecho nas notas.');
      return;
    }

    const preparedBrief: ContentBrief = {
      ...brief,
      source_image_url: sourceType === 'youtube'
        ? resolvedSourceImageUrl || getYouTubeThumbnail(sourceUrl)
        : resolvedSourceImageUrl,
      source_title: sourceTitle || (sourceType === 'youtube' ? 'Video do YouTube' : sourceTitle),
      source_excerpt: sourceExcerpt || sourceNotes.slice(0, 700) || '',
      source_capture_url: sourceCaptureUrl || resolvedSourceImageUrl,
    };
    if (
      preparedBrief.source_image_url !== brief.source_image_url ||
      preparedBrief.source_excerpt !== brief.source_excerpt ||
      preparedBrief.source_title !== brief.source_title
    ) {
      setBrief(preparedBrief);
    }

    setGenerating(true);
    setError('');
    try {
      const result = isSourceFlow
        ? await generateSourceCarouselStrategy({
            brief: preparedBrief,
            brandDNA: selectedProject?.brand_dna,
            knowledgeBase: selectedProject?.knowledge_base,
          })
        : await generateContentStrategy({
            brief: preparedBrief,
            brandDNA: selectedProject?.brand_dna,
            knowledgeBase: selectedProject?.knowledge_base,
          });
      setStrategy(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui gerar a estrategia agora. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateSlideshow() {
    if (!strategy) return;
    setSaving(true);
    setError('');
    try {
      const defaultPalette = getCarouselColorPalette(defaultColorPaletteId);
      const queue = assessQueueState({
        slides: strategy.slides,
        caption: strategy.caption,
        sourceTitle: sourceTitle || brief.topic,
        sourceNotes: sourceNotes,
        readinessScore: strategy.readiness_score,
      });
      const slideshow = await db.createSlideshow({
        slides: strategy.slides.map((slide) => ({
          ...slide,
          image_url: slide.image_url || resolvedSourceImageUrl || '',
        })),
        caption: strategy.caption,
        theme: selectedTemplate.theme,
        status: 'reviewing',
        brief,
        content_angle: strategy.angle,
        template_id: selectedTemplate.id,
        font_preset_id: defaultFontPresetId,
        color_palette_id: defaultColorPaletteId,
        accent_color: defaultPalette.accent,
        readiness_score: strategy.readiness_score,
        review_state: 'reviewing',
        generated_by: 'manual',
        queue_label: queue.queueLabel,
        queue_note: queue.queueNote,
        source_context: {
          trigger_label: 'create_content',
        },
        source_capture_type: brief.source_capture_type,
        source_capture_url: brief.source_capture_url || resolvedSourceImageUrl,
        source_capture_status: brief.source_capture_status,
        source_capture_note: brief.source_capture_note,
        source_transcript: brief.source_transcript,
        source_transcript_language: brief.source_transcript_language,
        source_transcript_source: brief.source_transcript_source,
        source_transcript_status: brief.source_transcript_status,
        source_transcript_note: brief.source_transcript_note,
        scheduled_for: null,
      });
      navigate(`/editor/${slideshow.id}`);
    } catch (err) {
      console.error(err);
      setError('Nao consegui salvar o carrossel. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 py-4">
      <header className="flex flex-col gap-3 max-w-3xl">
        <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
          <Sparkles className="w-4 h-4" /> Sistema de conteudo para experts
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Criar carrossel pronto para publicar</h1>
        <p className="text-slate-400 text-lg leading-relaxed">
          Transforme uma ideia, tese ou bastidor em estrategia, roteiro e visual premium antes de abrir o editor.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <section className="xl:col-span-7 space-y-6">
          <div className="premium-card p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h2 className="font-bold text-white text-xl">Brief estrategico</h2>
                <p className="text-sm text-slate-500">Primeiro clareza de fonte e angulo. O resto entra para refinar.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StepCard
                step="1"
                title="Escolha a fonte"
                description="Comece pela origem do conteudo. Manual, YouTube ou portal."
                active
              />
              <StepCard
                step="2"
                title="Defina o angulo"
                description="Mostre qual leitura, tese ou recorte queremos tirar dessa base."
                active={!!brief.topic.trim()}
              />
              <StepCard
                step="3"
                title="Gere o draft"
                description="Revise promessa, CTA e so depois abra o editor."
                active={canGenerate || !!strategy}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="premium-label">Resumo rapido</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <SummaryChip label={selectedProject?.name || 'Sem projeto'} tone={selectedProject ? 'filled' : 'muted'} />
                <SummaryChip label={selectedPreset.label} />
                <SummaryChip label={sourceType === 'manual' ? 'Ideia manual' : sourceType === 'youtube' ? 'Fonte: YouTube' : 'Fonte: RSS / Portal'} />
                <SummaryChip label={angleReady ? 'Angulo definido' : 'Falta angulo'} tone={angleReady ? 'filled' : 'muted'} />
                <SummaryChip label={selectedTemplate.name} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="premium-label">Expert / Projeto</label>
                <select
                  value={brief.project_id || ''}
                  onChange={(e) => updateBrief('project_id', e.target.value)}
                  className={`${inputCls} appearance-none cursor-pointer`}
                  disabled={loadingProjects}
                >
                  <option value="">Sem projeto conectado</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="premium-label">Tipo de conteudo</label>
                <select
                  value={brief.preset_id}
                  onChange={(e) => choosePreset(e.target.value)}
                  className={`${inputCls} appearance-none cursor-pointer`}
                >
                  {expertContentPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="premium-label">Etapa 1</p>
                  <h3 className="text-lg font-bold text-white">Escolha a fonte do carrossel</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    A melhor geracao comeca quando a origem do conteudo fica clara logo no inicio.
                  </p>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${sourceStatus.ready ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/20 bg-amber-500/10 text-amber-100'}`}>
                  <span className={`h-2 w-2 rounded-full ${sourceStatus.ready ? 'bg-emerald-300' : 'bg-amber-300'}`} />
                  {sourceStatus.title}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'manual', label: 'Ideia manual', icon: FileText },
                  { id: 'youtube', label: 'YouTube', icon: Youtube },
                  { id: 'rss', label: 'RSS / Portal', icon: Rss },
                ].map((option) => {
                  const Icon = option.icon;
                  const active = brief.source_type === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => chooseSourceType(option.id as ContentBrief['source_type'])}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${active ? 'border-indigo-400 bg-indigo-500/10 text-white' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-bold">{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                {sourceType === 'manual' && 'Descreva a ideia ou cole bastidores. A IA vai transformar isso em tese, estrutura e CTA.'}
                {sourceType === 'youtube' && 'Cole a URL do video e depois a transcricao, resumo ou bullets principais. Isso evita um carrossel bonito, mas pouco fiel.'}
                {sourceType === 'rss' && 'Cole a URL do feed ou artigo, confirme a fonte e use o angulo para dizer qual leitura editorial queremos fazer.'}
              </div>

              {sourceType !== 'manual' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={resetSourceFlow}
                    className="text-xs font-bold uppercase tracking-widest text-slate-500 transition hover:text-white"
                  >
                    Limpar fonte atual
                  </button>
                </div>
              )}

              {sourceType !== 'manual' && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <div className="space-y-2">
                      <label className="premium-label">{sourceType === 'youtube' ? 'URL do video' : 'URL do feed ou artigo'}</label>
                      <input
                        value={sourceUrl}
                        onChange={(e) => updateBrief('source_url', e.target.value)}
                        placeholder={sourceType === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://portal.com/feed ou https://portal.com/artigo'}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleLoadSource}
                        disabled={loadingSource}
                        className="premium-button-secondary h-[46px] flex items-center gap-2"
                      >
                        {loadingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                        {sourceType === 'youtube' ? 'Confirmar video' : 'Buscar fonte'}
                      </button>
                    </div>
                  </div>

                  {sourceError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {sourceError}
                    </div>
                  )}

                  {sourceType === 'youtube' && (
                    <div className="space-y-2">
                      <label className="premium-label">Titulo opcional do video</label>
                      <input
                        value={sourceTitle}
                        onChange={(e) => updateBrief('source_title', e.target.value)}
                        placeholder="Ex: A verdade sobre conteudo que vende"
                        className={inputCls}
                      />
                    </div>
                  )}

                  {(sourcePreview || resolvedSourceImageUrl || sourceTitle || sourceCaptureNote) && (
                    <div className={`grid grid-cols-1 gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 ${resolvedSourceImageUrl ? 'md:grid-cols-[120px_1fr]' : ''}`}>
                      {resolvedSourceImageUrl && (
                        <img
                          src={resolvedSourceImageUrl}
                          alt=""
                          className="h-32 w-full md:h-full rounded-lg object-cover grayscale"
                        />
                      )}
                      <div className="min-w-0 space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200">
                          <span className="h-2 w-2 rounded-full bg-emerald-300" />
                          Fonte pronta para gerar
                        </div>
                        {(sourceCaptureType || sourceCaptureStatus || sourceTranscriptSource) && (
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-200">
                              {getSourceCaptureTypeLabel(sourceCaptureType)}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                              sourceCaptureStatus === 'failed'
                                ? 'border-red-400/20 bg-red-500/10 text-red-200'
                                : sourceCaptureStatus === 'fallback_used'
                                  ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                                  : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                            }`}>
                              {getSourceCaptureStatusLabel(sourceCaptureStatus)}
                            </span>
                            {sourceTranscriptSource && (
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                                sourceTranscriptSource === 'official'
                                  ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                                  : sourceTranscriptSource === 'auto'
                                    ? 'border-sky-400/20 bg-sky-500/10 text-sky-200'
                                    : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                              }`}>
                                {getTranscriptSourceLabel(sourceTranscriptSource)}
                              </span>
                            )}
                            {sourceTranscriptStatus && (
                              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                                {getTranscriptStatusLabel(sourceTranscriptStatus)}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-sm font-bold text-white line-clamp-2">{sourcePreview?.title || sourceTitle || 'Fonte carregada'}</p>
                        <p className="text-xs text-slate-500 truncate">{sourcePreview?.url || sourceUrl}</p>
                        {(sourcePreview?.excerpt || sourceExcerpt) && (
                          <p className="text-sm text-slate-400 leading-relaxed line-clamp-4">{sourcePreview?.excerpt || sourceExcerpt}</p>
                        )}
                        {(sourceCaptureNote || sourceTranscriptNote || sourceTranscriptLanguage) && (
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {sourceTranscriptNote || sourceCaptureNote}
                            {sourceTranscriptLanguage ? ` Idioma: ${sourceTranscriptLanguage}.` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
              <div>
                <p className="premium-label">Etapa 2</p>
                <h3 className="text-lg font-bold text-white">Defina o angulo do draft</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Aqui voce diz qual leitura a IA deve fazer da fonte em vez de apenas resumir o material.
                </p>
              </div>

              <div className="space-y-2">
                <label className="premium-label">{sourceType === 'manual' ? 'Ideia central' : 'Angulo desejado'}</label>
                <input
                  value={brief.topic}
                  onChange={(e) => updateBrief('topic', e.target.value)}
                  placeholder="Ex: Por que experts bons travam na hora de vender no conteudo"
                  className={inputCls}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedAngleSuggestions.map((suggestion: string) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => updateBrief('topic', suggestion)}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="premium-label">Refinar estrategia</p>
                    <p className="text-sm text-slate-500 mt-1">Esses campos deixam o draft menos generico, mas entram depois da fonte e do angulo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRefinement((prev) => !prev)}
                    className="text-xs font-bold uppercase tracking-widest text-slate-400 transition hover:text-white"
                  >
                    {showRefinement || hasRefinement ? 'Ocultar refino' : 'Abrir refino'}
                  </button>
                </div>

                {(showRefinement || hasRefinement) && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="premium-label">Objetivo do post</label>
                        <textarea
                          rows={4}
                          value={brief.goal}
                          onChange={(e) => updateBrief('goal', e.target.value)}
                          className={`${inputCls} resize-none`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="premium-label">Publico especifico</label>
                        <textarea
                          rows={4}
                          value={brief.audience}
                          onChange={(e) => updateBrief('audience', e.target.value)}
                          placeholder="Ex: experts que ja vendem, mas dependem de indicacao e querem criar demanda pelo Instagram"
                          className={`${inputCls} resize-none`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="premium-label">CTA</label>
                        <textarea
                          rows={3}
                          value={brief.cta}
                          onChange={(e) => updateBrief('cta', e.target.value)}
                          className={`${inputCls} resize-none`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="premium-label">Notas, transcricao ou bastidor</label>
                        <textarea
                          rows={4}
                          value={brief.source_notes}
                          onChange={(e) => updateBrief('source_notes', e.target.value)}
                          placeholder="Cole aqui um insight bruto, transcricao curta, historia ou bullets do expert."
                          className={`${inputCls} resize-none`}
                        />
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {!sourceNotes.trim() && (
                            <button
                              type="button"
                              onClick={applySourceNotesTemplate}
                              className="text-xs font-bold uppercase tracking-widest text-indigo-300 transition hover:text-white"
                            >
                              Inserir modelo de notas
                            </button>
                          )}
                          <span className="text-xs text-slate-500">
                            {sourceType === 'manual' && 'Bom para bastidor, insight bruto ou historia curta.'}
                            {sourceType === 'youtube' && 'Ideal: resumo do video, bullets centrais e uma frase forte.'}
                            {sourceType === 'rss' && 'Ideal: resumo da materia, dado principal e leitura editorial.'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="premium-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="premium-label">Etapa 3</p>
                <h2 className="font-bold text-white text-xl">Visual do carrossel</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Escolha o template agora ou depois do primeiro draft. A decisao visual nao precisa travar a ideia.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-400">
                Opcional antes de gerar
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="grid gap-4 md:grid-cols-[160px_1fr_auto] md:items-center">
                <div className="aspect-[4/5] rounded-xl p-5 flex flex-col justify-between overflow-hidden" style={{ background: selectedTemplate.gradient, color: selectedTemplate.textColor }}>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: selectedTemplate.accentColor }}>{selectedTemplate.badge}</span>
                  <div>
                    <p className="text-2xl font-black leading-tight">{selectedTemplate.name}</p>
                    <div className="w-14 h-1 rounded-full mt-4" style={{ backgroundColor: selectedTemplate.accentColor }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-white">Template atual: {selectedTemplate.name}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{selectedTemplate.description}</p>
                  <p className="text-xs text-slate-500">Se preferir, gere primeiro e troque o visual depois de validar a promessa.</p>
                </div>
                <div className="flex md:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowTemplatePicker((prev) => !prev)}
                    className="premium-button-secondary"
                  >
                    {showTemplatePicker ? 'Ocultar templates' : 'Trocar template'}
                  </button>
                </div>
              </div>
            </div>

            {(showTemplatePicker || !!strategy) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {carouselTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => updateBrief('template_id', template.id)}
                    className={`text-left rounded-2xl border p-4 transition-all ${brief.template_id === template.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                  >
                    <div className="aspect-[4/5] rounded-xl p-5 flex flex-col justify-between overflow-hidden" style={{ background: template.gradient, color: template.textColor }}>
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: template.accentColor }}>{template.badge}</span>
                      <div>
                        <p className="text-2xl font-black leading-tight">{template.name}</p>
                        <div className="w-14 h-1 rounded-full mt-4" style={{ backgroundColor: template.accentColor }} />
                      </div>
                    </div>
                    <p className="font-bold text-white mt-3">{template.name}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{template.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="border border-red-500/20 bg-red-500/10 text-red-200 rounded-2xl p-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <div className="flex w-full flex-col items-end gap-2">
              <p className={`text-sm ${canGenerate ? 'text-emerald-300' : 'text-amber-200'}`}>{generateHint}</p>
              <button
                onClick={handleGenerate}
                disabled={generating || saving || !canGenerate}
                className="premium-button-primary flex items-center gap-3 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : strategy ? <RefreshCw className="w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
                {generating ? 'Gerando estrategia...' : strategy ? 'Regenerar estrategia' : 'Gerar estrategia'}
              </button>
            </div>
          </div>
        </section>

        <aside className="xl:col-span-5 space-y-6">
          <div className="sticky top-8 space-y-6">
            <div className="premium-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="premium-label">Preset</p>
                  <h3 className="text-xl font-bold text-white">{selectedPreset.label}</h3>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">{selectedTemplate.badge}</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{selectedPreset.description}</p>
              {selectedProject?.brand_dna?.core_promise && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="premium-label">Promessa do expert</p>
                  <p className="text-sm text-slate-300 mt-2">{selectedProject.brand_dna.core_promise}</p>
                </div>
              )}
            </div>

            <div className="premium-card overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">Previa estrategica</h3>
                  <p className="text-xs text-slate-500 mt-1">Acompanhe a qualidade do input antes de abrir o editor.</p>
                </div>
                {strategy && (
                  <span className="text-xs font-black text-emerald-300">{strategy.readiness_score}/100</span>
                )}
              </div>

              {!strategy ? (
                <div className="p-5 space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="premium-label">Estado atual</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${sourceStatus.ready ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/20 bg-amber-500/10 text-amber-100'}`}>
                        {sourceStatus.title}
                      </span>
                    </div>
                    <PreviewRow label="Fonte" value={sourceType === 'manual' ? 'Ideia manual' : sourceType === 'youtube' ? 'YouTube' : 'RSS / Portal'} />
                    <PreviewRow label="Proximo passo" value={sourceStatus.detail} />
                    <PreviewRow label="Angulo" value={brief.topic || 'Defina a leitura que queremos tirar dessa fonte.'} />
                    <PreviewRow label="Template" value={selectedTemplate.name} />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="premium-label">Checklist de prontidao</p>
                      <span className="text-xs font-black text-white">{readinessPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-300 via-indigo-400 to-emerald-300 transition-all"
                        style={{ width: `${readinessPercent}%` }}
                      />
                    </div>
                    <div className="space-y-3">
                      {readinessItems.map((item) => (
                        <ReadinessRow
                          key={item.label}
                          label={item.label}
                          done={item.done}
                          detail={item.detail}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-slate-500">
                    <Sparkles className="w-10 h-10 mx-auto mb-4 text-slate-700" />
                    <p className="text-sm">{generateHint}</p>
                  </div>
                </div>
              ) : (
                <div className="p-5 space-y-5">
                  <div className="aspect-[4/5] rounded-2xl p-7 flex flex-col justify-between shadow-2xl" style={{ background: selectedTemplate.gradient, color: selectedTemplate.textColor }}>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest" style={{ color: selectedTemplate.accentColor }}>
                      <span>{selectedTemplate.badge}</span>
                      <span>{selectedPreset.label}</span>
                    </div>
                    <div className="space-y-4">
                      <p className="text-3xl font-black leading-[0.95] tracking-tight">{strategy.slides[0]?.title || strategy.slides[0]?.text || strategy.promise}</p>
                      {strategy.slides[0]?.body && <p className="text-sm opacity-80 leading-snug">{strategy.slides[0].body}</p>}
                    </div>
                    <div className="space-y-2">
                      <div className="w-16 h-1 rounded-full" style={{ backgroundColor: selectedTemplate.accentColor }} />
                      <p className="text-xs opacity-80">{strategy.angle}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <PreviewRow label="Promessa" value={strategy.promise} />
                    <PreviewRow label="Angulo" value={strategy.angle} />
                    <PreviewRow label="CTA" value={strategy.cta} />
                  </div>

                  {strategy.improvement_notes.length > 0 && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                      <p className="premium-label !text-amber-300">Antes de publicar</p>
                      <ul className="mt-2 space-y-1 text-sm text-amber-100/80">
                        {strategy.improvement_notes.map((note) => <li key={note}>{note}</li>)}
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={handleCreateSlideshow}
                    disabled={saving}
                    className="premium-button-primary w-full flex items-center justify-center gap-3"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    {saving ? 'Criando carrossel...' : 'Aprovar e abrir editor'}
                    {!saving && <ArrowRight className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StepCard({ step, title, description, active }: { step: string; title: string; description: string; active?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${active ? 'border-indigo-400/30 bg-indigo-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-indigo-300 text-slate-950' : 'bg-white/10 text-slate-300'}`}>
          {step}
        </div>
        <p className="text-sm font-bold text-white">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

function SummaryChip({ label, tone = 'default' }: { label: string; tone?: 'default' | 'filled' | 'muted' }) {
  const cls = tone === 'filled'
    ? 'border-indigo-400/30 bg-indigo-500/10 text-white'
    : tone === 'muted'
      ? 'border-white/10 bg-white/[0.02] text-slate-400'
      : 'border-white/10 bg-black/20 text-slate-200';

  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="premium-label">{label}</p>
      <p className="text-sm text-slate-300 mt-1 leading-relaxed">{value}</p>
    </div>
  );
}

function ReadinessRow({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 h-5 w-5 rounded-full border ${done ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-amber-400/20 bg-amber-500/10'} flex items-center justify-center`}>
        <span className={`h-2 w-2 rounded-full ${done ? 'bg-emerald-300' : 'bg-amber-300'}`} />
      </div>
      <div>
        <p className={`text-sm font-bold ${done ? 'text-white' : 'text-slate-200'}`}>{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{detail}</p>
      </div>
    </div>
  );
}
