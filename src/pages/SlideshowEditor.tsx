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
  const [logoUrl, setLogoUrl] = useState('');

  const [currentSlide, setCurrentSlide] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenSlide, setRegenSlide] = useState(false);

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
        setTheme(data.theme || 'dark');
        setWatermark(data.watermark || '');
        setLogoUrl(data.logo_url || '');
        slideRefs.current = new Array(data.slides?.length || 0).fill(null);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!slideshow) return;
    setSaving(true);
    try {
      await db.updateSlideshow(slideshow.id, { slides, caption, theme, watermark, logo_url: logoUrl });
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
    if (slides[index].type === 'hook' && direction === 'up') return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= slides.length) return;
    if (slides[target].type === 'hook') return;
    const updated = [...slides];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSlides(updated);
    scrollToSlide(target);
  }

  function getDynamicFontSize(text: string, type: 'hook' | 'body', isExport = false) {
    const lines = text.split('\n').length;
    const length = text.length;
    
    if (isExport) {
      let baseSize = type === 'hook' ? 95 : 72;
      
      // Granular scaling based on length
      if (length > 400) baseSize *= 0.35;
      else if (length > 300) baseSize *= 0.45;
      else if (length > 200) baseSize *= 0.55;
      else if (length > 150) baseSize *= 0.65;
      else if (length > 100) baseSize *= 0.75;
      else if (length > 60) baseSize *= 0.85;
      
      // Granular scaling based on lines
      if (lines > 12) baseSize *= 0.4;
      else if (lines > 9) baseSize *= 0.55;
      else if (lines > 6) baseSize *= 0.7;
      else if (lines > 4) baseSize *= 0.85;
      
      return `${Math.max(baseSize, 22)}px`;
    } else {
      let baseSize = type === 'hook' ? 2.8 : 2.0;
      
      if (length > 400) baseSize *= 0.35;
      else if (length > 300) baseSize *= 0.45;
      else if (length > 200) baseSize *= 0.55;
      else if (length > 150) baseSize *= 0.65;
      else if (length > 100) baseSize *= 0.75;
      else if (length > 60) baseSize *= 0.85;
      
      if (lines > 12) baseSize *= 0.4;
      else if (lines > 9) baseSize *= 0.55;
      else if (lines > 6) baseSize *= 0.7;
      else if (lines > 4) baseSize *= 0.85;
      
      return `${Math.max(baseSize, 0.7)}rem`;
    }
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
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4 overflow-hidden">
      {/* Header - Compact */}
      <header className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <Link to={slideshow.automation_id ? `/automations/${slideshow.automation_id}` : '/'} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Studio Pro</span>
            <h1 className="text-lg font-bold text-white truncate max-w-[200px]">{slideshow.automation?.name || 'Carousel'}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
            }`}
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

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden gap-4">
        
        {/* Left Sidebar: Filmstrip */}
        <aside className="w-64 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Slides ({slides.length})</h3>
            <button onClick={addSlide} className="p-1 hover:bg-white/5 rounded text-indigo-400 hover:text-indigo-300 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {slides.map((s, i) => (
              <div 
                key={i}
                onClick={() => scrollToSlide(i)}
                className={`group relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                  currentSlide === i ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/5 hover:border-white/20'
                }`}
              >
                <div className="absolute inset-0" style={{ background: s.image_url ? `url(${s.image_url}) center/cover` : currentTheme.gradient }} />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                
                {/* Mini Preview Text */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <p className="text-[6px] lg:text-[8px] font-bold text-white text-center line-clamp-4 uppercase opacity-80" style={{ fontFamily: s.type === 'hook' ? currentTheme.hookFont : currentTheme.bodyFont }}>
                    {s.text || 'Sem texto'}
                  </p>
                </div>
                
                {/* Badge */}
                <div className={`absolute top-2 left-2 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${currentSlide === i ? 'bg-indigo-500 text-white' : 'bg-black/60 text-slate-400'}`}>
                  {i + 1}
                </div>
                
                {/* Quick actions on hover */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {s.type !== 'hook' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); confirmDeleteSlide(i); }}
                      className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {i > 0 && s.type !== 'hook' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveSlide(i, 'up'); }}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {i < slides.length - 1 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveSlide(i, 'down'); }}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Main Preview (Large) */}
        <main className="flex-1 bg-[#111111] rounded-3xl border border-white/5 flex flex-col items-center justify-center relative group overflow-hidden">
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 z-20">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentSlide + 1} / {slides.length}</span>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-2">{slides[currentSlide].type}</span>
          </div>

          <div 
            className="relative w-full max-w-[450px] aspect-[4/5] rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500"
            style={{ background: slide.image_url ? `url(${slide.image_url}) center/cover` : currentTheme.gradient }}
          >
            <div className="absolute inset-0" style={{ backgroundColor: currentTheme.overlay }} />
            
            {/* Logo Slot */}
            {logoUrl && (
              <div className="absolute top-8 right-8 z-10">
                <img src={logoUrl} alt="Logo" className="h-8 w-auto opacity-80" />
              </div>
            )}

            {/* Watermark */}
            {watermark && (
              <div className="absolute top-8 left-0 right-0 text-center z-10">
                <span className="text-xs font-bold tracking-[0.2em] opacity-40 uppercase" style={{ color: currentTheme.textColor }}>{watermark}</span>
              </div>
            )}

            <div className="absolute inset-0 flex flex-col items-center justify-center p-16">
              <div className="w-full text-center group/text relative flex flex-col items-center justify-center min-h-[50%]">
                {/* Direct Editing Overlay */}
                <textarea
                  value={slide.text}
                  onChange={(e) => updateSlideText(currentSlide, e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-center p-0 resize-none overflow-hidden cursor-text placeholder:text-white/20 break-words flex items-center justify-center"
                  style={{ 
                    color: currentTheme.textColor, 
                    textShadow: currentTheme.textShadow, 
                    fontFamily: slide.type === 'hook' ? currentTheme.hookFont : currentTheme.bodyFont,
                    fontSize: getDynamicFontSize(slide.text, slide.type),
                    fontWeight: 'bold',
                    lineHeight: '1.2',
                    height: 'auto',
                    minHeight: '1em'
                  }}
                  rows={8}
                  placeholder="Clique para escrever..."
                />
              </div>
            </div>

            {/* Float Controls for Image */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
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

          {/* Navigation Arrows */}
          <button 
            onClick={() => scrollToSlide(currentSlide - 1)}
            disabled={currentSlide === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/5 hover:bg-white/10 rounded-full text-white disabled:opacity-10 transition-all border border-white/5"
          >
            <ChevronUp className="-rotate-90 w-6 h-6" />
          </button>
          <button 
            onClick={() => scrollToSlide(currentSlide + 1)}
            disabled={currentSlide === slides.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/5 hover:bg-white/10 rounded-full text-white disabled:opacity-10 transition-all border border-white/5"
          >
            <ChevronUp className="rotate-90 w-6 h-6" />
          </button>
        </main>

        {/* Right Sidebar: Settings */}
        <aside className="w-72 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Estilo & Tema</h4>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(themeStyles) as ThemeKey[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`group px-3 py-2.5 rounded-xl border text-left transition-all ${theme === t ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 hover:bg-white/5'}`}
                  >
                    <span className={`block font-bold text-sm mb-0.5 ${theme === t ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                      {themeStyles[t].name}
                    </span>
                    <div className="flex gap-1">
                      <div className="w-full h-1.5 rounded-full opacity-50" style={{ background: themeStyles[t].gradient }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Branding</h4>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">@Username / Arroba</label>
                  <input
                    value={watermark}
                    onChange={(e) => setWatermark(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500"
                    placeholder="@seu.perfil"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">URL do Logo</label>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500"
                    placeholder="https://suamarca.com/logo.png"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Legenda</h4>
              <div className="relative">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={6}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:ring-1 focus:ring-indigo-500 resize-none"
                  placeholder="Escreva sua legenda..."
                />
                <button
                  onClick={handleCopyCaption}
                  className="absolute bottom-2 right-2 p-1.5 bg-indigo-500/20 text-indigo-400 rounded-md hover:bg-indigo-500/30 transition-all"
                  title="Copiar Legenda"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <button
                onClick={handleRegenSlide}
                disabled={regenSlide}
                className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                {regenSlide ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerar Texto com IA
              </button>
            </div>
          </div>
        </aside>
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

            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '140px' }}>
              <div style={{ textAlign: 'center', width: '100%' }}>
                {logoUrl && (
                  <div style={{ position: 'absolute', top: '80px', right: '80px', zIndex: 10 }}>
                    <img src={logoUrl} alt="" style={{ height: '50px', width: 'auto', opacity: 0.8 }} />
                  </div>
                )}
                <p style={{
                  color: currentTheme.textColor,
                  fontSize: getDynamicFontSize(s.text, s.type, true),
                  fontWeight: 'bold',
                  lineHeight: '1.2',
                  textShadow: currentTheme.textShadow,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: s.type === 'hook' ? currentTheme.hookFont : currentTheme.bodyFont,
                }}>
                  {s.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
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
            <button onClick={() => setDeleteModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">
              Cancelar
            </button>
            <button onClick={deleteSlide} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-600/20">
              Remover
            </button>
          </div>
        </div>
      </Modal>

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
