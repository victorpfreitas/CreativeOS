import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

export default function AppLayout() {
  const { user, logOut } = useAuth();
  const location = useLocation();
  const isEditor = location.pathname.startsWith('/editor/');

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a] text-slate-300 font-space">
      <Sidebar />
      <main className={`flex-1 overflow-x-hidden relative ${isEditor ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent" />

        <div className={`relative z-10 ${isEditor ? 'h-full min-h-0 p-4 max-w-none' : 'mx-auto max-w-7xl p-6 lg:p-8'}`}>
          <Outlet />
        </div>
      </main>
      
      {!isEditor && (
        <div className="fixed right-6 top-5 z-50 flex items-center gap-3 rounded-xl border border-white/10 bg-[#101018]/90 px-3 py-2 shadow-2xl backdrop-blur">
          <span className="max-w-[220px] truncate text-xs font-medium text-slate-400">
            {user?.email}
          </span>
          <button
            onClick={logOut}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
