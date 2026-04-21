import { useState, useEffect } from 'react';
import { Zap, TrendingUp, Film, Clock, Plus, Loader2 } from 'lucide-react';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-400">{card.label}</h3>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color.replace('bg-', 'bg-opacity-20 bg-')}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-4xl font-bold text-white font-space">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link to="/automations/new" className="bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-xl font-medium border border-white/10 transition-colors flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-400" /> New Automation
        </Link>
        <Link to="/projects" className="bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-xl font-medium border border-white/10 transition-colors">
          Manage Projects
        </Link>
      </div>

      {/* Recent content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <h2 className="font-semibold text-white">Recent Automations</h2>
          </div>
          {recentAutomations.length === 0 ? <div className="p-8 text-center text-slate-500 text-sm">No automations yet</div> : (
            <div className="divide-y divide-white/5">
              {recentAutomations.map((auto) => (
                <Link key={auto.id} to={`/automations/${auto.id}`} className="flex items-center gap-4 p-5 hover:bg-white/5 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate text-lg">{auto.name}</p>
                    <p className="text-sm text-slate-400">{auto.niche}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <h2 className="font-semibold text-white">Recent Slideshows</h2>
          </div>
          {recentSlideshows.length === 0 ? <div className="p-8 text-center text-slate-500 text-sm">No slideshows yet</div> : (
            <div className="divide-y divide-white/5">
              {recentSlideshows.map((show) => (
                <Link key={show.id} to={`/editor/${show.id}`} className="flex items-center gap-4 p-5 hover:bg-white/5 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Film className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate text-lg">{show.hook?.text || show.slides?.[0]?.text || 'Untitled'}</p>
                    <p className="text-sm text-slate-400">{show.slides?.length || 0} slides</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Create Modal */}
      <Modal open={quickCreateOpen} onClose={() => !generating && setQuickCreateOpen(false)} title="Quick Create Carousel">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Topic or Idea</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. 3 tools for productivity" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Image Collection (Backgrounds)</label>
            <select value={selectedCol} onChange={e => setSelectedCol(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Random Colors</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Theme</label>
              <select value={theme} onChange={e => setTheme(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="dark">Dark Premium</option>
                <option value="light">Light Clean</option>
                <option value="vibrant">Neon Vibrant</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Watermark / @arroba</label>
              <input value={watermark} onChange={e => setWatermark(e.target.value)} placeholder="@madebyhuman" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button onClick={() => setQuickCreateOpen(false)} disabled={generating} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleQuickCreate} disabled={generating || !topic.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-5 py-2 rounded-lg font-medium flex items-center gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} {generating ? 'Generating AI...' : 'Create Magic'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
