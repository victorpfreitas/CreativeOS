import { NavLink } from 'react-router-dom';
import { Home, FolderGit2, Zap, Settings, Calendar, Images, Film } from 'lucide-react';

export default function Sidebar() {
  const links = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/projects', icon: FolderGit2, label: 'Projects' },
    { to: '/automations', icon: Zap, label: 'Automations' },
    { to: '/schedule', icon: Calendar, label: 'Schedule' },
    { to: '/collections', icon: Images, label: 'Collections' },
    { to: '/gallery', icon: Film, label: 'Gallery' },
  ];

  return (
    <div className="w-64 h-screen bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-indigo-400" />
          Made by Human
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-indigo-600/10 text-indigo-400 font-medium' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg hover:bg-slate-800 transition-colors text-left">
          <Settings className="w-5 h-5" />
          Settings
        </button>
      </div>
    </div>
  );
}
