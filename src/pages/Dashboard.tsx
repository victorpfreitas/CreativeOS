import { useState, useEffect } from 'react';
import { Zap, TrendingUp, Film, Clock, Plus, Loader2, ChevronRight, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import * as db from '../lib/database';
import type { Automation, Slideshow, ImageCollection } from '../lib/types';
import Modal from '../components/ui/Modal';
import { generateHooks, generateSlideshow } from '../services/geminiService';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalAutomations: 0, totalSlideshows: 0, totalHooks: 0, scheduledToday: 0 });
  const [recentAutomations, setRecentAutomations] = useState<Automation[]>([]);
  const [recentSlideshows, setRecentSlideshows] = useState<Slideshow[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Create State
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light' | 'vibrant'>('dark');
  const [watermark, setWatermark] = useState('');
  const [collections, setCollections] = useState<ImageCollection[]>([]);
  const [selectedCol, setSelectedCol] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [s, autos, shows, cols] = await Promise.all([
          db.getDashboardStats(),
          db.getAutomations(),
          db.getSlideshows(),
          db.getCollections()
        ]);
        setStats(s);
        setRecentAutomations(autos.slice(0, 5));
        setRecentSlideshows(shows.slice(0, 5));
        setCollections(cols);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleQuickCreate() {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      // 1. Generate a single hook based on topic
      const hooks = await generateHooks({
        niche: topic,
        narrativePrompt: 'Engaging, viral, fast-paced.',
        count: 1
      });
      const hook = hooks[0] || `The truth about ${topic}`;

      // 2. Generate Slideshow
      const result = await generateSlideshow({
        hookText: hook,
        niche: topic,
        narrativePrompt: 'Engaging, viral, fast-paced.',
        formatPrompt: 'Short bullet points. Max 5 slides.',
        slideCount: 5
      });

      // 3. Get images from collection
      let images: string[] = [];
      if (selectedCol) {
        const col = await db.getCollection(selectedCol);
        if (col && col.images) images = col.images.map(i => i.url);
      }
      const getRandomImage = () => images.length > 0 ? images[Math.floor(Math.random() * images.length)] : '';

      const slidesWithImages = result.slides.map((s) => ({
        ...s,
        image_url: getRandomImage()
      }));

      // 4. Save orphan slideshow
      const slideshow = await db.createSlideshow({
        slides: slidesWithImages,
        caption: result.caption,
        theme,
        watermark
      });

      navigate(`/editor/${slideshow.id}`);
    } catch (err) {
      console.error('Error quick creating:', err);
      alert('Failed to generate slideshow. Is the Gemini API Key set?');
    } finally {
      setGenerating(false);
    }
  }

  const statCards = [
    { label: 'Active Automations', value: stats.totalAutomations, icon: Zap, color: 'text-indigo-500 bg-indigo-50' },
    { label: 'Slideshows Generated', value: stats.totalSlideshows, icon: Film, color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Available Hooks', value: stats.totalHooks, icon: TrendingUp, color: 'text-amber-500 bg-amber-50' },
    { label: 'Scheduled Today', value: stats.scheduledToday, icon: Clock, color: 'text-violet-500 bg-violet-50' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-white font-space tracking-tight">Dashboard</h1>
          <p className="text-slate-400 mt-2 text-lg">Welcome back. Here's an overview of your content systems.</p>
        </div>
        <button 
          onClick={() => setQuickCreateOpen(true)}
          className="bg-white hover:bg-slate-200 text-[#0a0a0a] px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          Quick Create
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="premium-card p-6 group hover:border-white/10 transition-all duration-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{card.label}</h3>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-4xl font-bold text-white font-space tracking-tighter">{card.value}</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                <TrendingUp className="w-3 h-3 text-emerald-500" /> +12% this month
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link to="/automations/new" className="premium-button-primary flex items-center gap-3">
          <Zap className="w-5 h-5 text-white shadow-lg" /> New Automation
        </Link>
        <Link to="/projects" className="premium-button-secondary flex items-center gap-3">
          Manage Projects
        </Link>
      </div>

      {/* Recent content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="premium-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Recent Automations</h2>
            <Link to="/automations" className="text-xs font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">View All</Link>
          </div>
          {recentAutomations.length === 0 ? <div className="p-12 text-center text-slate-600 text-sm italic">No systems created yet</div> : (
            <div className="divide-y divide-white/5">
              {recentAutomations.map((auto) => (
                <Link key={auto.id} to={`/automations/${auto.id}`} className="flex items-center gap-4 p-6 hover:bg-white/[0.03] transition-colors group">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate text-lg group-hover:text-indigo-300 transition-colors">{auto.name}</p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">{auto.niche}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-800 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="premium-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Recent Slideshows</h2>
            <Link to="/gallery" className="text-xs font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300">View All</Link>
          </div>
          {recentSlideshows.length === 0 ? <div className="p-12 text-center text-slate-600 text-sm italic">No carousels generated yet</div> : (
            <div className="divide-y divide-white/5">
              {recentSlideshows.map((show) => (
                <Link key={show.id} to={`/editor/${show.id}`} className="flex items-center gap-4 p-6 hover:bg-white/[0.03] transition-colors group">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Film className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate text-lg group-hover:text-emerald-300 transition-colors">{show.hook?.text || show.slides?.[0]?.text || 'Untitled Carousel'}</p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">{show.slides?.length || 0} Slides</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-800 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Create Modal */}
      <Modal open={quickCreateOpen} onClose={() => !generating && setQuickCreateOpen(false)} title="Quick Create Carousel">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="premium-label">Topic or Idea</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. 3 tools for productivity" className="premium-input w-full" />
          </div>
          <div className="space-y-2">
            <label className="premium-label">Image Collection (Backgrounds)</label>
            <select value={selectedCol} onChange={e => setSelectedCol(e.target.value)} className="premium-input w-full cursor-pointer appearance-none">
              <option value="">Random Colors</option>
              {collections.map(c => <option key={c.id} value={c.id} className="bg-[#1a1a1a]">{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="premium-label">Theme</label>
              <select value={theme} onChange={e => setTheme(e.target.value as any)} className="premium-input w-full cursor-pointer appearance-none">
                <option value="dark" className="bg-[#1a1a1a]">Dark Premium</option>
                <option value="light" className="bg-[#1a1a1a]">Light Clean</option>
                <option value="vibrant" className="bg-[#1a1a1a]">Neon Vibrant</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="premium-label">Watermark / @arroba</label>
              <input value={watermark} onChange={e => setWatermark(e.target.value)} placeholder="@madebyhuman" className="premium-input w-full" />
            </div>
          </div>
          <div className="pt-6 flex justify-end gap-3">
            <button onClick={() => setQuickCreateOpen(false)} disabled={generating} className="premium-button-secondary text-sm">Cancel</button>
            <button onClick={handleQuickCreate} disabled={generating || !topic.trim()} className="premium-button-primary text-sm flex items-center gap-3">
              {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} {generating ? 'Magic in progress...' : 'Create Carousel'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
