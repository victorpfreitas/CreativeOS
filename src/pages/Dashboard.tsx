import { useState, useEffect } from 'react';
import { Zap, TrendingUp, Film, Clock, Plus, ChevronRight, Sparkles, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as db from '../lib/database';
import type { Automation, Slideshow } from '../lib/types';

export default function Dashboard() {
  const [stats, setStats] = useState({ totalAutomations: 0, totalSlideshows: 0, totalHooks: 0, scheduledToday: 0 });
  const [recentAutomations, setRecentAutomations] = useState<Automation[]>([]);
  const [recentSlideshows, setRecentSlideshows] = useState<Slideshow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, autos, shows] = await Promise.all([
          db.getDashboardStats(),
          db.getAutomations(),
          db.getSlideshows(),
        ]);
        setStats(s);
        setRecentAutomations(autos.slice(0, 5));
        setRecentSlideshows(shows.slice(0, 5));
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    { label: 'Sistemas ativos', value: stats.totalAutomations, icon: Zap, color: 'text-indigo-500 bg-indigo-50' },
    { label: 'Carrosséis criados', value: stats.totalSlideshows, icon: Film, color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Hooks disponíveis', value: stats.totalHooks, icon: TrendingUp, color: 'text-amber-500 bg-amber-50' },
    { label: 'Agendados hoje', value: stats.scheduledToday, icon: Clock, color: 'text-violet-500 bg-violet-50' },
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
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
            <Sparkles className="w-4 h-4" /> Sistema de conteúdo para experts
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-white font-space tracking-tight leading-none">
              Transforme ideias em carrosséis premium.
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
              Comece por um brief estratégico, aprove o ângulo e abra o editor já com um roteiro pronto para publicar.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to="/create" className="premium-button-primary flex items-center gap-3 text-base">
              <Plus className="w-5 h-5" /> Criar conteúdo
            </Link>
            <Link to="/projects" className="premium-button-secondary flex items-center gap-3 text-base">
              Ajustar Brand DNA
            </Link>
          </div>
        </div>

        <Link to="/create" className="lg:col-span-5 premium-card p-6 group hover:border-indigo-500/30 transition-all overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-pink-600/10" />
          <div className="relative z-10 h-full flex flex-col justify-between gap-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Novo fluxo</span>
              <Target className="w-5 h-5 text-indigo-300" />
            </div>
            <div className="space-y-4">
              <p className="text-3xl font-black text-white leading-tight">Ideia → estratégia → carrossel → export</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Use presets como autoridade, objeção, prova social e lançamento para sair do conteúdo genérico.
              </p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <span className="text-sm font-bold text-white">Abrir criador guiado</span>
              <ChevronRight className="w-5 h-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </section>

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
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="premium-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Sistemas semanais</h2>
            <Link to="/automations" className="text-xs font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">Ver todos</Link>
          </div>
          {recentAutomations.length === 0 ? <div className="p-12 text-center text-slate-600 text-sm italic">Nenhum sistema criado ainda</div> : (
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
            <h2 className="text-xl font-bold text-white">Carrosséis recentes</h2>
            <Link to="/gallery" className="text-xs font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300">Ver galeria</Link>
          </div>
          {recentSlideshows.length === 0 ? <div className="p-12 text-center text-slate-600 text-sm italic">Nenhum carrossel criado ainda</div> : (
            <div className="divide-y divide-white/5">
              {recentSlideshows.map((show) => (
                <Link key={show.id} to={`/editor/${show.id}`} className="flex items-center gap-4 p-6 hover:bg-white/[0.03] transition-colors group">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Film className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate text-lg group-hover:text-emerald-300 transition-colors">{show.hook?.text || show.slides?.[0]?.text || 'Carrossel sem título'}</p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">{show.slides?.length || 0} slides · {show.status || 'draft'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-800 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
