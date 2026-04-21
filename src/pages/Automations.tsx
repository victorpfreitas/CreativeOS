import { Plus, Zap, Clock, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Automations() {
  const automations = [
    { id: 1, name: 'Real Estate Tips', niche: 'Real Estate', hooks: 15, schedule: 'Daily at 10 AM', status: 'Active' },
    { id: 2, name: 'Fitness Motivation', niche: 'Fitness', hooks: 4, schedule: 'Mon, Wed, Fri', status: 'Active' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Automations</h1>
          <p className="text-slate-500 mt-1">Manage your content systems and slideshow generation rules.</p>
        </div>
        <Link to="/automations/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" />
          New Automation
        </Link>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="p-4 text-sm font-medium text-slate-500">Name & Niche</th>
              <th className="p-4 text-sm font-medium text-slate-500">Available Hooks</th>
              <th className="p-4 text-sm font-medium text-slate-500">Schedule</th>
              <th className="p-4 text-sm font-medium text-slate-500">Status</th>
              <th className="p-4 text-sm font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {automations.map((auto) => (
              <tr key={auto.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-500" />
                    {auto.name}
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">{auto.niche}</div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${auto.hooks < 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {auto.hooks} hooks
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {auto.schedule}
                  </div>
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-sm text-slate-600">{auto.status}</span>
                  </span>
                </td>
                <td className="p-4">
                  <button className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
