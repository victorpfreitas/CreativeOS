import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Loader2, Image as ImageIcon, Download, Copy, Check, Plus, Trash2, RefreshCw, ChevronUp, ChevronDown, Type, Palette } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Slideshow, Slide, ImageCollection } from '../lib/types';
import { carouselTemplates, getCarouselTemplate } from '../lib/carouselTemplates';
import { carouselColorPalettes, carouselFontPresets, defaultColorPaletteId, defaultFontPresetId, getCarouselColorPalette } from '../lib/carouselVisuals';
import * as db from '../lib/database';
import Modal from '../components/ui/Modal';
import TemplateSlide, { getSlideReadabilityWarning } from '../components/carousel/TemplateSlide';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { regenerateCarousel, regenerateSlide } from '../services/geminiService';

const SLIDE_W = 1080;
const SLIDE_H = 1350;

type SlideTextField = keyof Pick<Slide, 'tagline' | 'title' | 'body' | 'cta' | 'accent_text'>;

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'carousel';
}

function composeSlideText(slide: Slide) {
  return [slide.tagline, slide.title, slide.body, slide.cta].filter(Boolean).join('\n\n') || slide.text || '';
}

function getEditableValue(slide: Slide, field: SlideTextField, slideIndex: number, totalSlides: number, watermark: string) {
  if (field === 'title') return slide.title ?? slide.text ?? '';
  if (field === 'tagline') return slide.tagline ?? (slideIndex === 0 || slide.type === 'hook' ? watermark || 'Creative OS' : '');
  if (field === 'accent_text') return slide.accent_text ?? '';
  if (field === 'cta') return slide.cta ?? '';
  if (field === 'body') return slide.body ?? '';
  return '';
}

export default function SlideshowEditor() {
  const { id } = useParams<{ id: string }>();
  const [slideshow, setSlideshow] = useState<Slideshow | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [caption, setCaption] = useState('');
  const [templateId, setTemplateId] = useState(carouselTemplates[0].id);
  const [fontPresetId, setFontPresetId] = useState(defaultFontPresetId);
  const [colorPaletteId, setColorPaletteId] = useState(defaultColorPaletteId);
  const [accentColor, setAccentColor] = useState('');
  const [watermark, setWatermark] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenSlide, setRegenSlide] = useState(false);
  const [regenAll, setRegenAll] = useState(false);

  const [bgModalOpen, setBgModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [slideToDelete, setSlideToDelete] = useState<number | null>(null);
  const [collections, setCollections] = useState<ImageCollection[]>([]);

  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      loadSlideshow();
      db.getCollections().then(setCollections).catch(console.error);
    }
  }, [id]);

  async function loadSlideshow() {
    try {
      const data = await db.getSlideshow(id!);
      if (data) {
        setSlideshow(data);
        setSlides(data.slides || []);
        setCaption(data.caption || '');
        setTemplateId(data.template_id || carouselTemplates[0].id);
        setFontPresetId(data.font_preset_id || defaultFontPresetId);
        setColorPaletteId(data.color_palette_id || defaultColorPaletteId);
        setAccentColor(data.accent_color || '');
        setWatermark(data.watermark || '');
        setLogoUrl(data.logo_url || '');
        slideRefs.current = new Array(data.slides?.length || 0).fill(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!slideshow) return;
    setSaving(true);
    try {
      const template = getCarouselTemplate(templateId);
      const palette = getCarouselColorPalette(colorPaletteId);
      await db.updateSlideshow(slideshow.id, {
        slides,
        caption,
        theme: template.theme,
        watermark,
        logo_url: logoUrl,
        template_id: template.id,
        font_preset_id: fontPresetId,
        color_palette_id: colorPaletteId,
        accent_color: accentColor || palette.accent,
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function updateSlideField(index: number, field: SlideTextField, value: string) {
    setSlides((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      const next = { ...s, [field]: value };
      return { ...next, text: composeSlideText(next) };
    }));
  }

  function updateSlideContent(index: number, patch: Partial<Slide>) {
    setSlides((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      const next = { ...s, ...patch };
      return { ...next, text: composeSlideText(next) };
    }));
  }

  function changeBackgroundImage(url: string) {
    setSlides((prev) => prev.map((s, i) => i === currentSlide ? { ...s, image_url: url } : s));
    setBgModalOpen(false);
  }

  function handleCopyCaption() {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function scrollToSlide(index: number) {
    const clamped = Math.max(0, Math.min(index, slides.length - 1));
    setCurrentSlide(clamped);
    if (scrollContainerRef.current) {
      const children = scrollContainerRef.current.children;
      if (children[clamped]) {
        children[clamped].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }

  function addSlide() {
    const newSlide: Slide = { type: 'body', text: 'Novo ponto', title: 'Novo ponto', body: '', image_url: '' };
    const updated = [...slides.slice(0, currentSlide + 1), newSlide, ...slides.slice(currentSlide + 1)];
    setSlides(updated);
    slideRefs.current = new Array(updated.length).fill(null);
    setTimeout(() => scrollToSlide(currentSlide + 1), 50);
  }

  function confirmDeleteSlide(index: number) {
    if (slides[index].type === 'hook') return;
    setSlideToDelete(index);
    setDeleteModalOpen(true);
  }

  function deleteSlide() {
    if (slideToDelete === null) return;
    const updated = slides.filter((_, i) => i !== slideToDelete);
    setSlides(updated);
    slideRefs.current = new Array(updated.length).fill(null);
    scrollToSlide(Math.min(slideToDelete, updated.length - 1));
    setDeleteModalOpen(false);
    setSlideToDelete(null);
  }

  function moveSlide(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= slides.length) return;

    const updated = [...slides];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSlides(updated);
    setCurrentSlide(target);
    window.setTimeout(() => scrollToSlide(target), 0);
  }

  async function handleRegenSlide() {
    if (!slideshow) return;
    const automation = slideshow.automation;
    setRegenSlide(true);
    try {
      const newText = await regenerateSlide({
        slideIndex: currentSlide,
        currentSlide: slides[currentSlide],
        slides,
        carouselTitle: slideshow.brief?.topic || slideshow.automation?.name || '',
        niche: automation?.niche || slideshow.brief?.topic || '',
        narrativePrompt: automation?.narrative_prompt || slideshow.content_angle || '',
        formatPrompt: automation?.format_prompt,
        softCta: automation?.soft_cta || slideshow.brief?.cta,
        knowledgeBase: automation?.project?.knowledge_base,
        brandDNA: automation?.project?.brand_dna,
        watermark,
      });
      updateSlideContent(currentSlide, newText);
    } catch (err) {
      console.error(err);
    } finally {
      setRegenSlide(false);
    }
  }

  async function handleRegenAllSlides() {
    if (!slideshow) return;
    const automation = slideshow.automation;
    setRegenAll(true);
    try {
      const result = await regenerateCarousel({
        slides,
        carouselTitle: slideshow.brief?.topic || slideshow.automation?.name || '',
        niche: automation?.niche || slideshow.brief?.topic || '',
        narrativePrompt: automation?.narrative_prompt || slideshow.content_angle || '',
        formatPrompt: automation?.format_prompt,
        softCta: automation?.soft_cta || slideshow.brief?.cta,
        knowledgeBase: automation?.project?.knowledge_base,
        brandDNA: automation?.project?.brand_dna,
        watermark,
        caption,
      });
      setSlides(result.slides);
      if (result.caption) setCaption(result.caption);
      slideRefs.current = new Array(result.slides.length).fill(null);
    } catch (err) {
      console.error(err);
    } finally {
      setRegenAll(false);
    }
  }

  async function handleExport() {
    if (!slideshow) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const node = slideRefs.current[i];
        if (node) {
          const dataUrl = await toPng(node, { quality: 1, width: SLIDE_W, height: SLIDE_H, pixelRatio: 1 });
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          zip.file(`slide_${String(i + 1).padStart(2, '0')}.png`, base64Data, { base64: true });
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFileName(slideshow.brief?.topic || slideshow.automation?.name || 'carousel')}_export.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      await db.updateSlideshow(slideshow.id, { status: 'exported', exported_at: new Date().toISOString() } as any);
    } catch (error) {
      console.error('Export failed', error);
      alert('Falha ao exportar. Tente novamente.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  if (!slideshow || slides.length === 0) return <div className="text-center py-12"><p className="text-slate-500">Carrossel não encontrado.</p><Link to="/gallery" className="text-indigo-600 hover:underline mt-2 inline-block">Voltar para galeria</Link></div>;

  const slide = slides[currentSlide];
  const selectedTemplate = getCarouselTemplate(templateId);
  const selectedPalette = getCarouselColorPalette(colorPaletteId);
  const currentWarning = getSlideReadabilityWarning(slide, currentSlide, slides.length);
  const isCTA = currentSlide === slides.length - 1 && currentSlide !== 0;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4 overflow-hidden">
      <header className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Link to={slideshow.automation_id ? `/automations/${slideshow.automation_id}` : '/gallery'} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-white/5 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Peça única</span>
            <h1 className="text-lg font-bold text-white truncate max-w-[320px]">{slideshow.brief?.topic || slideshow.automation?.name || 'Carousel'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${saved ? 'bg-emerald-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? '...' : saved ? 'Salvo' : 'Salvar'}
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? '...' : 'Exportar'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden gap-4">
        <aside className="w-64 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Slides ({slides.length})</h3>
            <button onClick={addSlide} className="p-1 hover:bg-white/5 rounded text-indigo-400 hover:text-indigo-300 transition-colors" title="Adicionar slide">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {slides.map((s, i) => (
              <div
                key={i}
                onClick={() => scrollToSlide(i)}
                className={`group relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${currentSlide === i ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/5 hover:border-white/20'}`}
              >
                <TemplateSlide slide={s} slideIndex={i} totalSlides={slides.length} templateId={templateId} watermark={watermark} logoUrl={logoUrl} fontPresetId={fontPresetId} colorPaletteId={colorPaletteId} accentColor={accentColor || selectedPalette.accent} compact />
                <div className={`absolute top-2 left-2 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${currentSlide === i ? 'bg-indigo-500 text-white' : 'bg-black/60 text-slate-300'}`}>
                  {i + 1}
                </div>
                <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {s.type !== 'hook' && (
                    <button onClick={(e) => { e.stopPropagation(); confirmDeleteSlide(i); }} className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg" title="Remover slide">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {i > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); moveSlide(i, 'up'); }} className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg" title="Mover para cima">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {i < slides.length - 1 && (
                    <button onClick={(e) => { e.stopPropagation(); moveSlide(i, 'down'); }} className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg" title="Mover para baixo">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 bg-[#111111] rounded-3xl border border-white/5 flex flex-col items-center justify-center relative group overflow-hidden">
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 z-20">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentSlide + 1} / {slides.length}</span>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-2">{selectedTemplate.name}</span>
          </div>

          <div className="relative w-full max-w-[450px] aspect-[4/5] rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500">
            <TemplateSlide
              slide={slide}
              slideIndex={currentSlide}
              totalSlides={slides.length}
              templateId={templateId}
              watermark={watermark}
              logoUrl={logoUrl}
              fontPresetId={fontPresetId}
              colorPaletteId={colorPaletteId}
              accentColor={accentColor || selectedPalette.accent}
            />

            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 z-30">
              <button
                onClick={() => setBgModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-2xl transition-all"
              >
                <ImageIcon className="w-4 h-4" /> Trocar Fundo
              </button>
              {slide.image_url && (
                <button
                  onClick={() => changeBackgroundImage('')}
                  className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-xl border border-red-500/20 text-red-200 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-2xl transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Remover Imagem
                </button>
              )}
            </div>
          </div>

          <button onClick={() => scrollToSlide(currentSlide - 1)} disabled={currentSlide === 0} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/5 hover:bg-white/10 rounded-full text-white disabled:opacity-10 transition-all border border-white/5">
            <ChevronUp className="-rotate-90 w-6 h-6" />
          </button>
          <button onClick={() => scrollToSlide(currentSlide + 1)} disabled={currentSlide === slides.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/5 hover:bg-white/10 rounded-full text-white disabled:opacity-10 transition-all border border-white/5">
            <ChevronUp className="rotate-90 w-6 h-6" />
          </button>
        </main>

        <aside className="w-72 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Direção de arte</h4>
              <div className="grid grid-cols-1 gap-2">
                {carouselTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setTemplateId(template.id)}
                    className={`group px-3 py-2.5 rounded-xl border text-left transition-all ${templateId === template.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 hover:bg-white/5'}`}
                  >
                    <span className={`block font-bold text-sm mb-0.5 ${templateId === template.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                      {template.name}
                    </span>
                    <span className="block text-[11px] text-slate-500 leading-snug">{template.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-indigo-300" />
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fontes</h4>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {carouselFontPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setFontPresetId(preset.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${fontPresetId === preset.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/5 hover:bg-white/5'}`}
                  >
                    <span className="block text-sm font-black text-white" style={{ fontFamily: preset.displayFont }}>{preset.name}</span>
                    <span className="block text-[11px] text-slate-500 mt-1 leading-snug">{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-300" />
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Paleta</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {carouselColorPalettes.map((palette) => (
                  <button
                    key={palette.id}
                    onClick={() => {
                      setColorPaletteId(palette.id);
                      setAccentColor(palette.accent);
                    }}
                    className={`rounded-xl border p-2 text-left transition-all ${colorPaletteId === palette.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/5 hover:bg-white/5'}`}
                    title={palette.description}
                  >
                    <div className="flex h-7 overflow-hidden rounded-lg border border-black/20">
                      <span className="flex-1" style={{ background: palette.background }} />
                      <span className="flex-1" style={{ background: palette.text }} />
                      <span className="flex-1" style={{ background: palette.accent }} />
                    </div>
                    <span className="block text-[11px] text-slate-300 font-bold mt-2 truncate">{palette.name}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Cor de destaque</label>
                <div className="flex gap-2">
                  <input type="color" value={accentColor || selectedPalette.accent} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-12 rounded-lg bg-black/40 border border-white/10 p-1" />
                  <input value={accentColor || selectedPalette.accent} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Texto do slide</h4>
              {currentWarning && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-bold leading-snug text-amber-100">
                  {currentWarning}
                </div>
              )}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tagline</label>
                  <input value={getEditableValue(slide, 'tagline', currentSlide, slides.length, watermark)} onChange={(e) => updateSlideField(currentSlide, 'tagline', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Título</label>
                  <textarea value={getEditableValue(slide, 'title', currentSlide, slides.length, watermark)} onChange={(e) => updateSlideField(currentSlide, 'title', e.target.value)} rows={3} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Corpo</label>
                  <textarea value={getEditableValue(slide, 'body', currentSlide, slides.length, watermark)} onChange={(e) => updateSlideField(currentSlide, 'body', e.target.value)} rows={4} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 resize-none" placeholder="Texto de apoio opcional" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Trecho em destaque</label>
                  <input value={getEditableValue(slide, 'accent_text', currentSlide, slides.length, watermark)} onChange={(e) => updateSlideField(currentSlide, 'accent_text', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500" placeholder="Ex: maioria" />
                </div>
                {isCTA && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">CTA visual</label>
                    <input value={getEditableValue(slide, 'cta', currentSlide, slides.length, watermark)} onChange={(e) => updateSlideField(currentSlide, 'cta', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500" placeholder="Arraste para salvar / me chama no direct" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Branding</h4>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">@Username / Assinatura</label>
                  <input value={watermark} onChange={(e) => setWatermark(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500" placeholder="@seu.perfil" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">URL do Logo</label>
                  <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500" placeholder="https://suamarca.com/logo.png" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Legenda</h4>
              <div className="relative">
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:ring-1 focus:ring-indigo-500 resize-none" placeholder="Escreva sua legenda..." />
                <button onClick={handleCopyCaption} className="absolute bottom-2 right-2 p-1.5 bg-indigo-500/20 text-indigo-400 rounded-md hover:bg-indigo-500/30 transition-all" title="Copiar Legenda">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <button onClick={handleRegenSlide} disabled={regenSlide || regenAll} className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all">
                {regenSlide ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerar Texto com IA
              </button>
              <button onClick={handleRegenAllSlides} disabled={regenSlide || regenAll} className="mt-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all">
                {regenAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Reescrever carrossel inteiro
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed top-[-10000px] left-[-10000px]">
        {slides.map((s, i) => (
          <div
            key={i}
            ref={(el) => { slideRefs.current[i] = el; }}
            style={{ width: `${SLIDE_W}px`, height: `${SLIDE_H}px`, position: 'relative', overflow: 'hidden' }}
          >
            <TemplateSlide slide={s} slideIndex={i} totalSlides={slides.length} templateId={templateId} watermark={watermark} logoUrl={logoUrl} fontPresetId={fontPresetId} colorPaletteId={colorPaletteId} accentColor={accentColor || selectedPalette.accent} exportMode />
          </div>
        ))}
      </div>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Remover Slide" maxWidth="max-w-md">
        <div className="p-6 text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <Trash2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900">Tem certeza?</h3>
            <p className="text-slate-500">Esta ação não pode ser desfeita. O slide será removido permanentemente.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDeleteModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">Cancelar</button>
            <button onClick={deleteSlide} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-600/20">Remover</button>
          </div>
        </div>
      </Modal>

      <Modal open={bgModalOpen} onClose={() => setBgModalOpen(false)} title="Selecionar Imagem de Fundo" maxWidth="max-w-5xl">
        <div className="space-y-8 p-2">
          {collections.filter((c) => c.images && c.images.length > 0).map((col) => (
            <div key={col.id} className="space-y-4">
              <h4 className="font-bold text-slate-800 text-lg border-b pb-2">{col.name}</h4>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {col.images?.map((img) => (
                  <button key={img.id} onClick={() => changeBackgroundImage(img.url)} className="aspect-[4/5] rounded-xl overflow-hidden hover:ring-4 ring-indigo-500 transition-all focus:outline-none shadow-md group relative">
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors z-10" />
                    <img src={img.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {collections.every((c) => !c.images || c.images.length === 0) && (
            <div className="text-center py-12 bg-slate-50 rounded-2xl">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhuma imagem disponível.</p>
              <Link to="/collections" className="text-indigo-600 font-bold hover:underline mt-2 inline-block">Ir para Assets</Link>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
