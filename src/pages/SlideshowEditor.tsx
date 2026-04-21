import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Save, Loader2, Type } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Slideshow, Slide } from '../lib/types';
import * as db from '../lib/database';

export default function SlideshowEditor() {
  const { id } = useParams<{ id: string }>();
  const [slideshow, setSlideshow] = useState<Slideshow | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [caption, setCaption] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editingText, setEditingText] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (id) loadSlideshow(); }, [id]);

  async function loadSlideshow() {
    try {
      const data = await db.getSlideshow(id!);
      if (data) {
        setSlideshow(data);
        setSlides(data.slides || []);
        setCaption(data.caption || '');
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!slideshow) return;
    setSaving(true);
    try { await db.updateSlideshow(slideshow.id, { slides, caption }); }
    catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  function updateSlideText(index: number, text: string) {
    setSlides((prev) => prev.map((s, i) => i === index ? { ...s, text } : s));
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  if (!slideshow || slides.length === 0) return <div className="text-center py-12"><p className="text-slate-500">Slideshow not found.</p><Link to="/gallery" className="text-indigo-600 hover:underline mt-2 inline-block">Back to Gallery</Link></div>;

  const slide = slides[currentSlide];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/automations/${slideshow.automation_id}`} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Slideshow Editor</h1>
            <p className="text-sm text-slate-500 truncate max-w-md">{slideshow.hook?.text || 'Untitled'}</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TikTok Preview */}
        <div className="flex flex-col items-center">
          <div className="relative w-[320px] h-[568px] rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-900" style={{ background: slide.image_url ? `url(${slide.image_url}) center/cover` : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' }}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="text-center">
                {slide.type === 'hook' && <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">Hook</div>}
                <p className="text-white text-xl font-bold leading-relaxed drop-shadow-lg whitespace-pre-line">{slide.text}</p>
              </div>
            </div>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
              {slides.map((_, i) => <button key={i} onClick={() => setCurrentSlide(i)} className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? 'bg-white' : 'bg-white/40'}`} />)}
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
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Type className="w-4 h-4 text-indigo-500" />Slide {currentSlide + 1} <span className="text-xs text-slate-400">({slide.type})</span></h3>
              <button onClick={() => setEditingText(!editingText)} className="text-sm text-indigo-600 font-medium">{editingText ? 'Done' : 'Edit'}</button>
            </div>
            {editingText ? <textarea value={slide.text} onChange={(e) => updateSlideText(currentSlide, e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /> : <p className="text-slate-700 text-sm whitespace-pre-line">{slide.text}</p>}
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">All Slides</h3>
            <div className="space-y-2">
              {slides.map((s, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)} className={`w-full text-left p-3 rounded-lg border transition-colors ${i === currentSlide ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${s.type === 'hook' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{i + 1}</span>
                    <p className="text-sm text-slate-700 truncate">{s.text}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">Caption</h3>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="TikTok/Instagram caption..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
