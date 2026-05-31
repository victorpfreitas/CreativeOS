import { NavLink } from 'react-router-dom';
import { CalendarDays, Home, FolderGit2, Inbox, Zap, Settings, Images, Film, Layers } from 'lucide-react';

export default function Sidebar() {
  const links = [
    { to: '/', icon: Home, label: 'Hoje' },
    { to: '/projects', icon: FolderGit2, label: 'Experts' },
    { to: '/batch', icon: Layers, label: 'Content Machine' },
    { to: '/queue', icon: Inbox, label: 'Board' },
    { to: '/schedule', icon: CalendarDays, label: 'Agenda' },
    { to: '/gallery', icon: Film, label: 'Carrosséis' },
    { to: '/collections', icon: Images, label: 'Assets' },
    { to: '/automations', icon: Zap, label: 'Sistemas' },
  ];

  return (
    <aside className="relative z-20 flex h-screen w-64 flex-col border-r border-white/5 bg-[#0d0d0d] text-slate-400">
      <div className="p-8">
        <h1 className="flex items-center gap-3 font-space text-2xl font-bold tracking-tight text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Zap className="h-4 w-4 text-white" />
          </div>
          Creative OS
        </h1>
        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-600">Operação por expert</p>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-4">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200 ${
                  isActive
                    ? 'border-white/10 bg-white/10 font-medium text-white shadow-inner'
                    : 'border-transparent hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-6">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              isActive
                ? 'border-white/10 bg-white/10 font-medium text-white'
                : 'border-transparent hover:bg-white/5 hover:text-slate-200'
            }`
          }
        >
          <Settings className="h-5 w-5" />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
