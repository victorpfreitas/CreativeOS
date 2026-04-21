import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Loader2, Type, Image as ImageIcon, Download, Copy, Check, Palette, Plus, Trash2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Slideshow, Slide, ImageCollection } from '../lib/types';
import { themeStyles, type ThemeKey } from '../lib/themes';
import * as db from '../lib/database';
import Modal from '../components/ui/Modal';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { regenerateSlide } from '../services/geminiService';

const SLIDE_W = 1080;
const SLIDE_H = 1350;

export default function SlideshowEditor() {
  const { id } = useParams<{ id: string }>();
  const [slideshow, setSlideshow] = useState<Slideshow | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [caption, setCaption] = useState('');
  const [theme, setTheme] = useState<ThemeKey>('dark');
  const [watermark, setWatermark] = useState('');

  const [currentSlide, setCurrentSlide] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenSlide, setRegenSlide] = useState(false);

  const [bgModalOpen, setBgModalOpen] = useState(false);
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
        setTheme(data.theme || 'dark');
        setWatermark(data.watermark || '');
        slideRefs.current = new Array(data.slides?.length || 0).fill(null);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!slideshow) return;
    setSaving(true);
    try {
      await db.updateSlideshow(slideshow.id, { slides, caption, theme, watermark });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  function updateSlideText(index: number, text: string) {
    setSlides((prev) => prev.map((s, i) => i === index ? { ...s, text } : s));
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
    const newSlide: Slide = { type: 'body', text: '', image_url: '' };
    const updated = [...slides.slice(0, currentSlide + 1), newSlide, ...slides.slice(currentSlide + 1)];
    setSlides(updated);
    slideRefs.current = new Array(updated.length).fill(null);
    setTimeout(() => scrollToSlide(currentSlide + 1), 50);
  }

  function deleteSlide(index: number) {
    if (slides[index].type === 'hook') return;
    const updated = slides.filter((_, i) => i !== index);
    setSlides(updated);
    slideRefs.current = new Array(updated.length).fill(null);
    scrollToSlide(Math.min(index, updated.length - 1));
  }

  function moveSlide(index: number, direction: 'up' | 'down') {
    if (slides[index].type === 'hook' && direction === 'up') return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= slides.length) return;
    if (slides[target].type === 'hook') return;
    const updated = [...slides];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSlides(updated);
    scrollToSlide(target);
  }

  async function handleRegenSlide() {
    if (!slideshow) return;
    const automation = slideshow.automation;
    const hookSlide = slides.find((s) => s.type === 'hook');
    setRegenSlide(true);
    try {
      const newText = await regenerateSlide({
        slideIndex: currentSlide,
        currentText: slides[currentSlide].text,
        hookText: hookSlide?.text || '',
        niche: automation?.niche || '',
        narrativePrompt: automation?.narrative_prompt || '',
        knowledgeBase: automation?.project?.knowledge_base,
      });
      updateSlideText(currentSlide, newText);
    } catch (err) {
      console.error(err);
    } finally {
      setRegenSlide(false);
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
          const dataUrl = await toPng(node, { quality: 1, width: SLIDE_W, height: SLIDE_H });
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          zip.file(`slide_${i + 1}.png`, base64Data, { base64: true });
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slideshow.automation?.name || 'carousel'}_export.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
  const currentTheme = themeStyles[theme];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={slideshow.automation_id ? `/automations/${slideshow.automation_id}` : '/'} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white font-space tracking-tight">Studio Editor</h1>
            <p className="text-sm text-slate-400 truncate max-w-md">{slideshow.hook?.text || 'Carrossel standalone'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
          >
            {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {exporting ? 'Exportando...' : 'Download ZIP'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${
              saved
                ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-[0_0_15px_rgba(79,70,229,0.2)] hover:shadow-[0_0_25px_rgba(79,70,229,0.4)]'
            }`}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </header>

      {/* Slide counter */}
      <div className="flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToSlide(i)}
            className={`transition-all duration-200 rounded-full ${
              currentSlide === i
                ? 'w-6 h-2 bg-indigo-400'
                : 'w-2 h-2 bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
        <span className="ml-3 text-xs text-slate-500">
          {currentSlide + 1} / {slides.length}
        </span>
      </div>

      {/* HORIZONTAL CAROUSEL VIEWER */}
      <div className="relative -mx-8 px-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-transparent to-[#0a0a0a] pointer-events-none z-10" />
        <div
          ref={scrollContainerRef}
          className="flex flex-row overflow-x-auto gap-6 pb-8 pt-4 snap-x snap-mandatory items-center relative"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {slides.map((s, i) => {
            const isSelected = currentSlide === i;
            return (
              <div
                key={i}
                onClick={() => scrollToSlide(i)}
                className={`relative min-w-[300px] lg:min-w-[370px] aspect-[4/5] snap-center shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                  isSelected
                    ? 'ring-4 ring-indigo-500 shadow-2xl shadow-indigo-500/20 scale-100'
                    : 'opacity-50 hover:opacity-70 scale-95'
                }`}
                style={{ background: s.image_url ? `url(${s.image_url}) center/cover` : currentTheme.gradient }}
              >
                <div className="absolute inset-0" style={{ backgroundColor: currentTheme.overlay }} />

                {watermark && (
                  <div className="absolute top-6 left-0 right-0 text-center z-10">
                    <span className="text-xs font-bold tracking-widest opacity-60" style={{ color: currentTheme.textColor }}>{watermark}</span>
                  </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <div className="text-center w-full">
                    {s.type === 'hook' && (
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-4 opacity-80" style={{ color: theme === 'light' ? '#4f46e5' : '#818cf8' }}>
                        Slide 1 • Hook
                      </div>
                    )}
                    <p
                      className="text-2xl lg:text-3xl font-bold leading-tight whitespace-pre-line"
                      style={{ color: currentTheme.textColor, textShadow: currentTheme.textShadow, fontFamily: currentTheme.fontFamily }}
                    >
                      {s.text}
                    </p>
                  </div>
                </div>

                {/* Slide number badge */}
                <div className="absolute top-3 left-3 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {i + 1}
                </div>

                {isSelected && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                    <button
                      onClick={(e) => { e.stopPropagation(); setBgModalOpen(true); }}
                      className="bg-black/80 text-white px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 backdrop-blur-md border border-white/10 hover:bg-black transition-colors shadow-xl"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Trocar BG
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Slide Text Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2 text-lg">
                <Type className="w-5 h-5 text-indigo-400" />
                Editando Slide {currentSlide + 1}
              </h3>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${slide.type === 'hook' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 text-slate-400'}`}>
                  {slide.type}
                </span>
                {/* Slide order controls */}
                <button
                  onClick={() => moveSlide(currentSlide, 'up')}
                  disabled={currentSlide === 0 || slide.type === 'hook'}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white disabled:opacity-30"
                  title="Mover para cima"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveSlide(currentSlide, 'down')}
                  disabled={currentSlide === slides.length - 1}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white disabled:opacity-30"
                  title="Mover para baixo"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            <textarea
              value={slide.text}
              onChange={(e) => updateSlideText(currentSlide, e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white text-lg font-space resize-none"
              placeholder="Texto do slide..."
            />

            {/* Slide actions */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2">
                <button
                  onClick={addSlide}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar slide
                </button>
                {slide.type !== 'hook' && (
                  <button
                    onClick={() => deleteSlide(currentSlide)}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors border border-white/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover slide
                  </button>
                )}
              </div>
              <button
                onClick={handleRegenSlide}
                disabled={regenSlide}
                className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors border border-indigo-500/30"
              >
                {regenSlide ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {regenSlide ? 'Regenerando...' : 'Regenerar com IA'}
              </button>
            </div>
          </div>

          {/* Caption */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white text-lg">Legenda TikTok/Reels</h3>
              <button
                onClick={handleCopyCaption}
                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 bg-indigo-400/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Escreva sua legenda com hashtags..."
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-300 text-sm resize-none"
            />
          </div>
        </div>

        {/* Global Branding */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="font-semibold text-white flex items-center gap-2 text-lg mb-6">
              <Palette className="w-5 h-5 text-pink-400" /> Visual
            </h3>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Tema</label>
                <div className="grid grid-cols-1 gap-2">
                  {(['dark', 'light', 'vibrant'] as ThemeKey[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`px-4 py-3 rounded-xl border text-left transition-all ${theme === t ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:bg-white/5'}`}
                    >
                      {t === 'dark' && <><span className="block font-bold text-white mb-1 font-serif">Dark Premium</span><span className="text-xs text-slate-500">Serifs elegantes, sombras profundas</span></>}
                      {t === 'light' && <><span className="block font-bold text-white mb-1 font-space">Light Clean</span><span className="text-xs text-slate-500">Sans-serif moderno, alto contraste</span></>}
                      {t === 'vibrant' && <><span className="block font-bold text-pink-400 mb-1" style={{ textShadow: '0 0 10px rgba(236,72,153,0.5)' }}>Neon Vibrant</span><span className="text-xs text-slate-500">Bold, colorido, estilo TikTok</span></>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-slate-400">Watermark / @arroba</label>
                <input
                  value={watermark}
                  onChange={(e) => setWatermark(e.target.value)}
                  placeholder="@seuperfil"
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white font-space"
                />
              </div>

              <div className="pt-2 border-t border-white/10 text-xs text-slate-500 space-y-1">
                <p>{slides.length} slides • {SLIDE_W}×{SLIDE_H}px</p>
                <p>Formato: Instagram Feed (4:5)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Export Container */}
      <div className="fixed top-[-10000px] left-[-10000px]">
        {slides.map((s, i) => (
          <div
            key={i}
            ref={(el) => { slideRefs.current[i] = el; }}
            style={{
              width: `${SLIDE_W}px`,
              height: `${SLIDE_H}px`,
              background: s.image_url ? `url(${s.image_url}) center/cover` : currentTheme.gradient,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, backgroundColor: currentTheme.overlay }} />

            {watermark && (
              <div style={{ position: 'absolute', top: '60px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
                <span style={{ fontSize: '30px', fontWeight: 'bold', letterSpacing: '8px', color: currentTheme.textColor, opacity: 0.6 }}>
                  {watermark}
                </span>
              </div>
            )}

            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px' }}>
              <div style={{ textAlign: 'center', width: '100%' }}>
                <p style={{
                  color: currentTheme.textColor,
                  fontSize: '76px',
                  fontWeight: 'bold',
                  lineHeight: '1.3',
                  textShadow: currentTheme.textShadow,
                  whiteSpace: 'pre-line',
                  fontFamily: currentTheme.fontFamily,
                }}>
                  {s.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Background Selection Modal */}
      <Modal open={bgModalOpen} onClose={() => setBgModalOpen(false)} title="Selecionar Imagem de Fundo" maxWidth="max-w-5xl">
        <div className="space-y-8 p-2">
          {collections.filter((c) => c.images && c.images.length > 0).map((col) => (
            <div key={col.id} className="space-y-4">
              <h4 className="font-bold text-slate-800 text-lg border-b pb-2">{col.name}</h4>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {col.images?.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => changeBackgroundImage(img.url)}
                    className="aspect-[4/5] rounded-xl overflow-hidden hover:ring-4 ring-indigo-500 transition-all focus:outline-none shadow-md group relative"
                  >
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
              <Link to="/collections" className="text-indigo-600 font-bold hover:underline mt-2 inline-block">Ir para Collections</Link>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
