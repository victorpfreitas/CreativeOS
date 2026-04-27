import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, FileText, Link2, Loader2, RefreshCw, Rss, Sparkles, Target, Wand2, Youtube } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ContentBrief, ContentStrategy, Project } from '../lib/types';
import * as db from '../lib/database';
import { carouselTemplates, getCarouselTemplate } from '../lib/carouselTemplates';
import { defaultColorPaletteId, defaultFontPresetId, getCarouselColorPalette } from '../lib/carouselVisuals';
import { expertContentPresets, getExpertContentPreset } from '../lib/contentPresets';
import { generateContentStrategy, generateSourceCarouselStrategy } from '../services/geminiService';
import { fetchRssSource, getYouTubeThumbnail, type SourcePreview } from '../services/sourceService';

const inputCls = 'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

export default function CreateContent() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [error, setError] = useState('');
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
  });

  useEffect(() => {
    db.getProjects()
      .then(setProjects)
      .catch((err) => {
        console.error(err);
        setError('Não consegui carregar seus projetos. Tente recarregar a página.');
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  const selectedProject = projects.find((project) => project.id === brief.project_id);
  const selectedPreset = useMemo(() => getExpertContentPreset(brief.preset_id), [brief.preset_id]);
  const selectedTemplate = useMemo(() => getCarouselTemplate(brief.template_id), [brief.template_id]);

  function updateBrief<K extends keyof ContentBrief>(field: K, value: ContentBrief[K]) {
    setBrief((prev) => ({ ...prev, [field]: value }));
    setStrategy(null);
    if (field === 'source_type' || field === 'source_url') setSourcePreview(null);
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
      source_image_url: sourceType === 'manual' ? '' : prev.source_image_url,
      source_excerpt: sourceType === 'manual' ? '' : prev.source_excerpt,
      source_notes: sourceType === 'manual' ? '' : prev.source_notes,
    }));
    setStrategy(null);
    setSourcePreview(null);
  }

  async function handleLoadSource() {
    if (!brief.source_url?.trim()) {
      setError('Cole uma URL antes de buscar a fonte.');
      return;
    }

    setLoadingSource(true);
    setError('');
    setStrategy(null);
    try {
      if (brief.source_type === 'youtube') {
        const imageUrl = getYouTubeThumbnail(brief.source_url);
        const preview: SourcePreview = {
          title: brief.source_title || 'Video do YouTube',
          url: brief.source_url,
          imageUrl,
          excerpt: brief.source_notes?.slice(0, 700) || '',
          text: brief.source_notes || '',
        };
        setSourcePreview(preview);
        setBrief((prev) => ({
          ...prev,
          source_title: prev.source_title || preview.title,
          source_image_url: imageUrl,
          source_excerpt: preview.excerpt,
        }));
      } else if (brief.source_type === 'rss') {
        const preview = await fetchRssSource(brief.source_url);
        setSourcePreview(preview);
        setBrief((prev) => ({
          ...prev,
          topic: prev.topic || preview.title,
          source_title: preview.title,
          source_url: preview.url || prev.source_url,
          source_image_url: preview.imageUrl,
          source_excerpt: preview.excerpt,
          source_notes: prev.source_notes || preview.text,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui carregar essa fonte.');
    } finally {
      setLoadingSource(false);
    }
  }

  async function handleGenerate() {
    const isSourceFlow = brief.source_type === 'youtube' || brief.source_type === 'rss';
    if (!isSourceFlow && !brief.topic.trim()) {
      setError('Descreva a ideia central do carrossel antes de gerar.');
      return;
    }
    if (isSourceFlow && !brief.source_url?.trim()) {
      setError('Cole a URL da fonte antes de gerar.');
      return;
    }
    if (brief.source_type === 'youtube' && !brief.source_notes?.trim()) {
      setError('Cole a transcricao ou notas do video para gerar um carrossel fiel.');
      return;
    }
    if (brief.source_type === 'rss' && !brief.source_notes?.trim() && !brief.source_excerpt?.trim()) {
      setError('Busque a fonte RSS/portal antes de gerar, ou cole um trecho nas notas.');
      return;
    }

    const preparedBrief: ContentBrief = {
      ...brief,
      source_image_url: brief.source_type === 'youtube'
        ? brief.source_image_url || getYouTubeThumbnail(brief.source_url || '')
        : brief.source_image_url,
      source_title: brief.source_title || (brief.source_type === 'youtube' ? 'Video do YouTube' : brief.source_title),
      source_excerpt: brief.source_excerpt || brief.source_notes?.slice(0, 700) || '',
    };
    if (preparedBrief.source_image_url !== brief.source_image_url || preparedBrief.source_excerpt !== brief.source_excerpt || preparedBrief.source_title !== brief.source_title) {
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
      setError(err instanceof Error ? err.message : 'Não consegui gerar a estratégia agora. Tente novamente.');
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
      const slideshow = await db.createSlideshow({
        slides: strategy.slides.map((slide) => ({
          ...slide,
          image_url: slide.image_url || brief.source_image_url || '',
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
        scheduled_for: null,
      });
      navigate(`/editor/${slideshow.id}`);
    } catch (err) {
      console.error(err);
      setError('Não consegui salvar o carrossel. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 py-4">
      <header className="flex flex-col gap-3 max-w-3xl">
        <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
          <Sparkles className="w-4 h-4" /> Sistema de conteúdo para experts
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Criar carrossel pronto para publicar</h1>
        <p className="text-slate-400 text-lg leading-relaxed">
          Transforme uma ideia, tese ou bastidor em estratégia, roteiro e visual premium antes de abrir o editor.
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
                <h2 className="font-bold text-white text-xl">Brief estratégico</h2>
                <p className="text-sm text-slate-500">Poucos campos, mas suficientes para a IA sair do genérico.</p>
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
                <label className="premium-label">Tipo de conteúdo</label>
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

            <div className="space-y-3">
              <label className="premium-label">Fonte do carrossel</label>
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
            </div>

            {brief.source_type !== 'manual' && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <div className="space-y-2">
                    <label className="premium-label">{brief.source_type === 'youtube' ? 'URL do video' : 'URL do feed ou artigo'}</label>
                    <input
                      value={brief.source_url || ''}
                      onChange={(e) => updateBrief('source_url', e.target.value)}
                      placeholder={brief.source_type === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://portal.com/feed ou https://portal.com/artigo'}
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
                      Buscar fonte
                    </button>
                  </div>
                </div>

                {brief.source_type === 'youtube' && (
                  <div className="space-y-2">
                    <label className="premium-label">Titulo opcional do video</label>
                    <input
                      value={brief.source_title || ''}
                      onChange={(e) => updateBrief('source_title', e.target.value)}
                      placeholder="Ex: A verdade sobre conteudo que vende"
                      className={inputCls}
                    />
                  </div>
                )}

                {(sourcePreview || brief.source_image_url || brief.source_title) && (
                  <div className={`grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-black/20 p-3 ${(sourcePreview?.imageUrl || brief.source_image_url) ? 'md:grid-cols-[120px_1fr]' : ''}`}>
                    {(sourcePreview?.imageUrl || brief.source_image_url) && (
                      <img
                        src={sourcePreview?.imageUrl || brief.source_image_url}
                        alt=""
                        className="h-32 w-full md:h-full rounded-lg object-cover grayscale"
                      />
                    )}
                    <div className="min-w-0 space-y-2">
                      <p className="text-sm font-bold text-white line-clamp-2">{sourcePreview?.title || brief.source_title || 'Fonte carregada'}</p>
                      <p className="text-xs text-slate-500 truncate">{sourcePreview?.url || brief.source_url}</p>
                      {(sourcePreview?.excerpt || brief.source_excerpt) && (
                        <p className="text-sm text-slate-400 leading-relaxed line-clamp-4">{sourcePreview?.excerpt || brief.source_excerpt}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="premium-label">{brief.source_type === 'manual' ? 'Ideia central' : 'Angulo desejado'}</label>
              <input
                value={brief.topic}
                onChange={(e) => updateBrief('topic', e.target.value)}
                placeholder="Ex: Por que experts bons travam na hora de vender no conteúdo"
                className={inputCls}
              />
            </div>

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
                <label className="premium-label">Público específico</label>
                <textarea
                  rows={4}
                  value={brief.audience}
                  onChange={(e) => updateBrief('audience', e.target.value)}
                  placeholder="Ex: experts que já vendem, mas dependem de indicação e querem criar demanda pelo Instagram"
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
                <label className="premium-label">Notas, transcrição ou bastidor</label>
                <textarea
                  rows={3}
                  value={brief.source_notes}
                  onChange={(e) => updateBrief('source_notes', e.target.value)}
                  placeholder="Cole aqui um insight bruto, transcrição curta, história ou bullets do expert."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </div>

          <div className="premium-card p-6 space-y-4">
            <h2 className="font-bold text-white text-xl">Template visual</h2>
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
          </div>

          {error && (
            <div className="border border-red-500/20 bg-red-500/10 text-red-200 rounded-2xl p-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating || saving}
              className="premium-button-primary flex items-center gap-3"
            >
              {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : strategy ? <RefreshCw className="w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
              {generating ? 'Gerando estratégia...' : strategy ? 'Regenerar estratégia' : 'Gerar estratégia'}
            </button>
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
                <h3 className="font-bold text-white">Prévia estratégica</h3>
                {strategy && (
                  <span className="text-xs font-black text-emerald-300">{strategy.readiness_score}/100</span>
                )}
              </div>

              {!strategy ? (
                <div className="p-8 text-center text-slate-600">
                  <Sparkles className="w-10 h-10 mx-auto mb-4 text-slate-800" />
                  <p className="text-sm">Gere a estratégia para revisar promessa, ângulo, slides e CTA antes do editor.</p>
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
                    <PreviewRow label="Ângulo" value={strategy.angle} />
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

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="premium-label">{label}</p>
      <p className="text-sm text-slate-300 mt-1 leading-relaxed">{value}</p>
    </div>
  );
}
