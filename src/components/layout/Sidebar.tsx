import { NavLink } from 'react-router-dom';
import { Home, FolderGit2, Inbox, Zap, Settings, Images, Film, Sparkles } from 'lucide-react';

export default function Sidebar() {
  const links = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/queue', icon: Inbox, label: 'Draft Queue' },
    { to: '/create', icon: Sparkles, label: 'Criar Conteúdo' },
    { to: '/projects', icon: FolderGit2, label: 'Experts' },
    { to: '/automations', icon: Zap, label: 'Sistemas' },
    { to: '/collections', icon: Images, label: 'Assets' },
    { to: '/gallery', icon: Film, label: 'Carrosséis' },
  ];

  return (
    <div className="w-64 h-screen bg-[#0d0d0d] text-slate-400 flex flex-col border-r border-white/5 relative z-20">
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 font-space tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          Creative OS
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-white/10 text-white font-medium shadow-inner border border-white/5'
                    : 'hover:bg-white/5 hover:text-slate-200 transparent border border-transparent'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-6">
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-white/5 transition-colors text-left border border-transparent">
          <Settings className="w-5 h-5" />
          Settings
        </button>
      </div>
    </div>
  );
}
