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
        {/* Subtle background glow effect */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-600/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className={`relative z-10 ${isEditor ? 'h-full min-h-0 p-4 max-w-none' : 'p-8 max-w-7xl mx-auto'}`}>
          <Outlet />
        </div>
      </main>
      
      {!isEditor && (
        <div className="fixed top-6 right-6 flex items-center gap-4 bg-white/5 border border-white/10 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl z-50">
          <span className="text-sm font-medium text-slate-300">
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
