import { useState, useEffect } from 'react';
import { Zap, TrendingUp, Film, Clock } from 'lucide-react';
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
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back. Here's an overview of your content systems.</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-500">{card.label}</h3>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link
          to="/automations/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Zap className="w-4 h-4" />
          New Automation
        </Link>
        <Link
          to="/projects"
          className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium border border-slate-200 transition-colors"
        >
          Manage Projects
        </Link>
      </div>

      {/* Recent content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Automations */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Automations</h2>
          </div>
          {recentAutomations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No automations yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAutomations.map((auto) => (
                <Link
                  key={auto.id}
                  to={`/automations/${auto.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <Zap className="w-4 h-4 text-indigo-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{auto.name}</p>
                    <p className="text-sm text-slate-500">{auto.niche}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                    auto.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${auto.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {auto.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Slideshows */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Slideshows</h2>
          </div>
          {recentSlideshows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No slideshows generated yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentSlideshows.map((show) => (
                <Link
                  key={show.id}
                  to={`/editor/${show.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <Film className="w-4 h-4 text-emerald-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {show.hook?.text || 'Untitled'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {show.slides?.length || 0} slides
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    show.status === 'published' ? 'bg-emerald-100 text-emerald-700' :
                    show.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {show.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
