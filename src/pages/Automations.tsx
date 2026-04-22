import { useState, useEffect } from 'react';
import { Plus, Zap, Clock, MoreHorizontal, Trash2, Pause, Play } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Automation } from '../lib/types';
import * as db from '../lib/database';

export default function Automations() {
  const [searchParams] = useSearchParams();
  const projectFilter = searchParams.get('project');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => { loadAutomations(); }, [projectFilter]);

  async function loadAutomations() {
    try {
      const data = projectFilter
        ? await db.getAutomationsByProject(projectFilter)
        : await db.getAutomations();
      setAutomations(data);
    } catch (err) {
      console.error('Error loading automations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(auto: Automation) {
    try {
      await db.updateAutomation(auto.id, {
        status: auto.status === 'active' ? 'paused' : 'active',
      });
      loadAutomations();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this automation and all its hooks and slideshows?')) return;
    try {
      await db.deleteAutomation(id);
      loadAutomations();
    } catch (err) {
      console.error('Error deleting automation:', err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Automations</h1>
          <p className="text-slate-500 mt-1">
            Manage your content systems and slideshow generation rules.
          </p>
        </div>
        <Link
          to="/automations/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Automation
        </Link>
      </header>

      {automations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No automations yet</h3>
          <p className="text-slate-500 mt-1 mb-4">
            Create your first automation to start generating content automatically.
          </p>
          <Link
            to="/automations/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Automation
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse overflow-visible">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-4 text-sm font-medium text-slate-500">Name & Niche</th>
                <th className="p-4 text-sm font-medium text-slate-500">Project</th>
                <th className="p-4 text-sm font-medium text-slate-500">Schedule</th>
                <th className="p-4 text-sm font-medium text-slate-500">Status</th>
                <th className="p-4 text-sm font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {automations.map((auto) => (
                <tr key={auto.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <Link to={`/automations/${auto.id}`} className="block">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-indigo-500" />
                        {auto.name}
                      </div>
                      <div className="text-sm text-slate-500 mt-0.5">{auto.niche}</div>
                    </Link>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {auto.project?.name || '—'}
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {auto.schedule_days?.length > 0
                        ? `${auto.schedule_days.join(', ')} at ${auto.schedule_time || '10:00'}`
                        : 'Not set'}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${auto.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span className="text-sm text-slate-600">{auto.status}</span>
                    </span>
                  </td>
                  <td className="p-4 relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === auto.id ? null : auto.id)}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {menuOpen === auto.id && (
                      <div className="absolute right-4 top-12 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                        <button
                          onClick={() => { toggleStatus(auto); setMenuOpen(null); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          {auto.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {auto.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={() => { handleDelete(auto.id); setMenuOpen(null); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
