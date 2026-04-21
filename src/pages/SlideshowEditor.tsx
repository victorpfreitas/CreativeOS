import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Loader2, Type, Image as ImageIcon, Download, Copy, Check, Palette } from 'lucide-react';
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
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Background Swap State
  const [bgModalOpen, setBgModalOpen] = useState(false);
  const [collections, setCollections] = useState<ImageCollection[]>([]);

  // Refs for rendering
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

  function scrollToSlide(index: number) {
    setCurrentSlide(index);
    if (scrollContainerRef.current) {
      const children = scrollContainerRef.current.children;
      if (children[index]) {
        children[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
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

  // Theme Styles config
  const themeStyles = {
    dark: {
      gradient: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
      overlay: 'rgba(0,0,0,0.6)',
      textColor: 'white',
      fontFamily: "'Playfair Display', serif",
      textShadow: '0 4px 30px rgba(0,0,0,0.8)'
    },
    light: {
      gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      overlay: 'rgba(255,255,255,0.85)',
      textColor: '#0f172a',
      fontFamily: "'Space Grotesk', sans-serif",
      textShadow: 'none'
    },
    vibrant: {
      gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%)',
      overlay: 'rgba(0,0,0,0.3)',
      textColor: 'white',
      fontFamily: "'Outfit', sans-serif",
      textShadow: '0 4px 20px rgba(236,72,153,0.8)'
    }
  };

  const currentTheme = themeStyles[theme];

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={slideshow.automation_id ? `/automations/${slideshow.automation_id}` : "/"} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-white font-space tracking-tight">Studio Editor</h1>
            <p className="text-sm text-slate-400 truncate max-w-md">{slideshow.hook?.text || 'Standalone Carousel'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} disabled={exporting} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]">
            {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {exporting ? 'Exporting Zip...' : 'Download Carousel'}
          </button>
          <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(79,70,229,0.2)] hover:shadow-[0_0_25px_rgba(79,70,229,0.4)]">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* HORIZONTAL CAROUSEL VIEWER */}
      <div className="relative -mx-8 px-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-transparent to-[#0a0a0a] pointer-events-none z-10" />
        
        <div 
          ref={scrollContainerRef}
          className="flex flex-row overflow-x-auto gap-6 pb-8 pt-4 snap-x snap-mandatory hide-scrollbar items-center relative"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {slides.map((s, i) => {
            const isSelected = currentSlide === i;
            return (
              <div 
                key={i}
                onClick={() => scrollToSlide(i)}
                className={`relative min-w-[320px] lg:min-w-[400px] aspect-[4/5] snap-center shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${isSelected ? 'ring-4 ring-indigo-500 shadow-2xl shadow-indigo-500/20 scale-100' : 'opacity-60 hover:opacity-80 scale-95'}`}
                style={{ 
                  background: s.image_url ? `url(${s.image_url}) center/cover` : currentTheme.gradient 
                }}
              >
                <div className="absolute inset-0" style={{ backgroundColor: currentTheme.overlay }} />
                
                {/* Watermark Top */}
                {watermark && (
                  <div className="absolute top-6 left-0 right-0 text-center z-10">
                    <span className="text-xs font-bold tracking-widest opacity-60" style={{ color: currentTheme.textColor }}>{watermark}</span>
                  </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <div className="text-center w-full">
                    {s.type === 'hook' && <div className="text-[10px] font-bold uppercase tracking-widest mb-4 opacity-80" style={{ color: theme === 'light' ? '#4f46e5' : '#818cf8' }}>Slide 1 • Hook</div>}
                    <p 
                      className="text-2xl lg:text-3xl font-bold leading-tight whitespace-pre-line" 
                      style={{ 
                        color: currentTheme.textColor, 
                        textShadow: currentTheme.textShadow,
                        fontFamily: currentTheme.fontFamily
                      }}
                    >
                      {s.text}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setBgModalOpen(true); }}
                      className="bg-black/80 text-white px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 backdrop-blur-md border border-white/10 hover:bg-black transition-colors shadow-xl"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Swap BG
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Controls below the carousel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Slide Text Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2 text-lg">
                <Type className="w-5 h-5 text-indigo-400" />
                Editing Slide {currentSlide + 1}
              </h3>
              <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${slide.type === 'hook' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 text-slate-400'}`}>
                {slide.type}
              </span>
            </div>
            <textarea 
              value={slide.text} 
              onChange={(e) => updateSlideText(currentSlide, e.target.value)} 
              rows={4} 
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white text-lg font-space resize-none" 
              placeholder="Enter slide text..."
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white text-lg">TikTok/Reels Caption</h3>
              <button onClick={handleCopyCaption} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 bg-indigo-400/10 px-3 py-1.5 rounded-lg transition-colors">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea 
              value={caption} 
              onChange={(e) => setCaption(e.target.value)} 
              rows={4} 
              placeholder="Write your engaging caption with hashtags..." 
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-300 text-sm resize-none" 
            />
          </div>
        </div>

        {/* Global Branding & Settings */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm h-full">
            <h3 className="font-semibold text-white flex items-center gap-2 text-lg mb-6">
              <Palette className="w-5 h-5 text-pink-400" /> Global Branding
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Design Theme</label>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => setTheme('dark')} className={`px-4 py-3 rounded-xl border text-left transition-all ${theme === 'dark' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                    <span className="block font-bold text-white mb-1 font-serif">Dark Premium</span>
                    <span className="text-xs text-slate-500">Elegant serifs, deep shadows</span>
                  </button>
                  <button onClick={() => setTheme('light')} className={`px-4 py-3 rounded-xl border text-left transition-all ${theme === 'light' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                    <span className="block font-bold text-white mb-1 font-space">Light Clean</span>
                    <span className="text-xs text-slate-500">Modern sans-serif, high contrast</span>
                  </button>
                  <button onClick={() => setTheme('vibrant')} className={`px-4 py-3 rounded-xl border text-left transition-all ${theme === 'vibrant' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                    <span className="block font-bold text-pink-400 mb-1" style={{ textShadow: '0 0 10px rgba(236,72,153,0.5)' }}>Neon Vibrant</span>
                    <span className="text-xs text-slate-500">Bold, colorful, TikTok style</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-slate-400">Watermark / @arroba</label>
                <input 
                  value={watermark} 
                  onChange={e => setWatermark(e.target.value)} 
                  placeholder="@madebyhuman" 
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white font-space" 
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Hidden Export Container (1080x1350 Instagram Portrait aspect ratio) */}
      <div className="fixed top-[-10000px] left-[-10000px]">
        {slides.map((s, i) => (
          <div 
            key={i} 
            ref={el => { slideRefs.current[i] = el; }}
            style={{ 
              width: '1080px', 
              height: '1350px', 
              background: s.image_url ? `url(${s.image_url}) center/cover` : currentTheme.gradient,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', inset: 0, backgroundColor: currentTheme.overlay }} />
            
            {watermark && (
              <div style={{ position: 'absolute', top: '60px', left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
                <span style={{ fontSize: '30px', fontWeight: 'bold', letterSpacing: '8px', color: currentTheme.textColor, opacity: 0.6 }}>{watermark}</span>
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
                  fontFamily: currentTheme.fontFamily
                }}>
                  {s.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Background Selection Modal */}
      <Modal open={bgModalOpen} onClose={() => setBgModalOpen(false)} title="Select Background Image" maxWidth="max-w-5xl">
        <div className="space-y-8 p-2">
          {collections.filter(c => c.images && c.images.length > 0).map(col => (
            <div key={col.id} className="space-y-4">
              <h4 className="font-bold text-slate-800 text-lg border-b pb-2">{col.name}</h4>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {col.images?.map(img => (
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
          {collections.every(c => !c.images || c.images.length === 0) && (
            <div className="text-center py-12 bg-slate-50 rounded-2xl">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No images available in any collection.</p>
              <Link to="/collections" className="text-indigo-600 font-bold hover:underline mt-2 inline-block">Go to Collections to upload</Link>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
