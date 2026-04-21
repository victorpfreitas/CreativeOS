import { useState, useEffect } from 'react';
import { Film, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Slideshow } from '../lib/types';
import * as db from '../lib/database';

export default function Gallery() {
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSlideshows(); }, []);

  async function loadSlideshows() {
    try { setSlideshows(await db.getSlideshows()); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this slideshow?')) return;
    try { await db.deleteSlideshow(id); loadSlideshows(); }
    catch (err) { console.error(err); }
  }

  if (loading) return <div className="space-y-6"><div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" /><div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="aspect-[9/16] bg-slate-100 rounded-xl animate-pulse" />)}</div></div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Gallery</h1>
        <p className="text-slate-500 mt-1">Browse all generated slideshows across your automations.</p>
      </header>

      {slideshows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Film className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No slideshows yet</h3>
          <p className="text-slate-500 mt-1">Generate your first slideshow from an automation's hook bank.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {slideshows.map((show) => {
            const hookSlide = show.slides?.[0];
            return (
              <div key={show.id} className="group relative">
                <Link to={`/editor/${show.id}`} className="block">
                  <div className="aspect-[9/16] rounded-xl overflow-hidden shadow-md border border-slate-200 relative" style={{ background: hookSlide?.image_url ? `url(${hookSlide.image_url}) center/cover` : 'linear-gradient(135deg, #1e1b4b, #4338ca)' }}>
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <p className="text-white text-sm font-bold text-center leading-snug drop-shadow-lg line-clamp-4">{hookSlide?.text || 'Untitled'}</p>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${show.status === 'published' ? 'bg-emerald-500 text-white' : show.status === 'scheduled' ? 'bg-blue-500 text-white' : 'bg-white/80 text-slate-700'}`}>{show.status}</span>
                    </div>
                    <div className="absolute bottom-2 left-2 text-[10px] text-white/70">{show.slides?.length || 0} slides</div>
                  </div>
                </Link>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-500 truncate flex-1">{show.automation?.name || ''}</p>
                  <button onClick={() => handleDelete(show.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
