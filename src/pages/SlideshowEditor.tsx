import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Save, Loader2, Type, Image as ImageIcon, Download, Copy, Check, Palette } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Slideshow, Slide, ImageCollection } from '../lib/types';
import * as db from '../lib/database';
import Modal from '../components/ui/Modal';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';

export default function SlideshowEditor() {
  const { id } = useParams<{ id: string }>();
  const [slideshow, setSlideshow] = useState<Slideshow | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [caption, setCaption] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light' | 'vibrant'>('dark');
  const [watermark, setWatermark] = useState('');
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editingText, setEditingText] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Background Swap State
  const [bgModalOpen, setBgModalOpen] = useState(false);
  const [collections, setCollections] = useState<ImageCollection[]>([]);

  // Refs for rendering
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    try { await db.updateSlideshow(slideshow.id, { slides, caption, theme, watermark }); }
    catch (err) { console.error(err); }
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

  async function handleExport() {
    if (!slideshow) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < slides.length; i++) {
        const node = slideRefs.current[i];
        if (node) {
          const dataUrl = await toPng(node, {
            quality: 1,
            width: 1080,
            height: 1920,
          });
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
          zip.file(`slide_${i + 1}.png`, base64Data, { base64: true });
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
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
      alert('Failed to export carousel. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  if (!slideshow || slides.length === 0) return <div className="text-center py-12"><p className="text-slate-500">Slideshow not found.</p><Link to="/gallery" className="text-indigo-600 hover:underline mt-2 inline-block">Back to Gallery</Link></div>;

  const slide = slides[currentSlide];

  // Theme Styles config
  const themeStyles = {
    dark: {
      gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
      overlay: 'rgba(0,0,0,0.5)',
      textColor: 'white',
      textShadow: '0 4px 24px rgba(0,0,0,0.6)'
    },
    light: {
      gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      overlay: 'rgba(255,255,255,0.75)',
      textColor: '#0f172a',
      textShadow: 'none'
    },
    vibrant: {
      gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%)',
      overlay: 'rgba(0,0,0,0.2)',
      textColor: 'white',
      textShadow: '0 4px 20px rgba(236,72,153,0.8)'
    }
  };

  const currentTheme = themeStyles[theme];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={slideshow.automation_id ? `/automations/${slideshow.automation_id}` : "/"} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Slideshow Editor</h1>
            <p className="text-sm text-slate-500 truncate max-w-md">{slideshow.hook?.text || 'Standalone Carousel'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} disabled={exporting} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting Zip...' : 'Download Carousel'}
          </button>
          <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TikTok Preview Area */}
        <div className="flex flex-col items-center">
          <div className="relative w-[320px] h-[568px] rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-900 group" style={{ background: slide.image_url ? `url(${slide.image_url}) center/cover` : currentTheme.gradient }}>
            <div className="absolute inset-0" style={{ backgroundColor: currentTheme.overlay }} />
            
            {/* Watermark Top */}
            {watermark && (
              <div className="absolute top-6 left-0 right-0 text-center z-10">
                <span className="text-sm font-bold tracking-widest opacity-80" style={{ color: currentTheme.textColor }}>{watermark}</span>
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="text-center">
                {slide.type === 'hook' && <div className="text-xs font-bold uppercase tracking-wider mb-3 opacity-90" style={{ color: theme === 'light' ? '#4f46e5' : '#c7d2fe' }}>Hook</div>}
                <p className="text-xl font-bold leading-relaxed whitespace-pre-line" style={{ color: currentTheme.textColor, textShadow: currentTheme.textShadow }}>{slide.text}</p>
              </div>
            </div>
            
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-10">
              {slides.map((_, i) => <button key={i} onClick={() => setCurrentSlide(i)} className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? 'bg-indigo-500' : 'bg-indigo-500/30'}`} />)}
            </div>

            {/* Overlay to swap image */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <button onClick={() => setBgModalOpen(true)} className="bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 backdrop-blur-sm shadow-xl hover:scale-105 transition-transform">
                <ImageIcon className="w-4 h-4" /> Swap Background
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))} disabled={currentSlide === 0} className="p-2 hover:bg-slate-200 disabled:opacity-30 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
            <span className="text-sm font-medium text-slate-600">{currentSlide + 1} / {slides.length}</span>
            <button onClick={() => setCurrentSlide((p) => Math.min(slides.length - 1, p + 1))} disabled={currentSlide === slides.length - 1} className="p-2 hover:bg-slate-200 disabled:opacity-30 rounded-lg"><ArrowRight className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Edit Panel */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Palette className="w-4 h-4 text-indigo-500" /> Branding & Style</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Theme</label>
                <select value={theme} onChange={e => setTheme(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                  <option value="dark">Dark Premium</option>
                  <option value="light">Light Clean</option>
                  <option value="vibrant">Neon Vibrant</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Watermark / @arroba</label>
                <input value={watermark} onChange={e => setWatermark(e.target.value)} placeholder="@madebyhuman" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Type className="w-4 h-4 text-indigo-500" />Slide {currentSlide + 1} <span className="text-xs text-slate-400">({slide.type})</span></h3>
              <button onClick={() => setEditingText(!editingText)} className="text-sm text-indigo-600 font-medium">{editingText ? 'Done' : 'Edit Text'}</button>
            </div>
            {editingText ? <textarea value={slide.text} onChange={(e) => updateSlideText(currentSlide, e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /> : <p className="text-slate-700 text-sm whitespace-pre-line">{slide.text}</p>}
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">All Slides</h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {slides.map((s, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)} className={`w-full text-left p-3 rounded-lg border transition-colors ${i === currentSlide ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-slate-100" style={{ backgroundImage: s.image_url ? `url(${s.image_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                      {!s.image_url && <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-indigo-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[10px] font-bold px-1 py-0.5 rounded uppercase ${s.type === 'hook' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>Slide {i + 1}</span>
                      <p className="text-sm text-slate-700 truncate mt-0.5">{s.text}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Caption</h3>
              <button onClick={handleCopyCaption} className="text-sm text-indigo-600 font-medium flex items-center gap-1">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="TikTok/Instagram caption..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
        </div>
      </div>

      {/* Hidden Export Container */}
      <div className="fixed top-[-10000px] left-[-10000px]">
        {slides.map((s, i) => (
          <div 
            key={i} 
            ref={el => { slideRefs.current[i] = el; }}
            style={{ 
              width: '1080px', 
              height: '1920px', 
              background: s.image_url ? `url(${s.image_url}) center/cover` : currentTheme.gradient,
              position: 'relative'
            }}
          >
            <div style={{ position: 'absolute', inset: 0, backgroundColor: currentTheme.overlay }} />
            
            {watermark && (
              <div style={{ position: 'absolute', top: '80px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
                <span style={{ fontSize: '36px', fontWeight: 'bold', letterSpacing: '8px', color: currentTheme.textColor, opacity: 0.8 }}>{watermark}</span>
              </div>
            )}

            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ 
                  color: currentTheme.textColor, 
                  fontSize: '72px', 
                  fontWeight: 'bold', 
                  lineHeight: '1.4', 
                  textShadow: currentTheme.textShadow,
                  whiteSpace: 'pre-line' 
                }}>
                  {s.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Background Selection Modal */}
      <Modal open={bgModalOpen} onClose={() => setBgModalOpen(false)} title="Select Background Image" maxWidth="max-w-4xl">
        <div className="space-y-6">
          {collections.filter(c => c.images && c.images.length > 0).map(col => (
            <div key={col.id} className="space-y-3">
              <h4 className="font-medium text-slate-900">{col.name}</h4>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {col.images?.map(img => (
                  <button 
                    key={img.id} 
                    onClick={() => changeBackgroundImage(img.url)}
                    className="aspect-[9/16] rounded-md overflow-hidden hover:ring-2 ring-indigo-500 transition-all focus:outline-none"
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {collections.every(c => !c.images || c.images.length === 0) && (
            <p className="text-center text-slate-500 py-8">No images available in any collection.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
