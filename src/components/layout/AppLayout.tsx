import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

export default function AppLayout() {
  const { user, logOut } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      
      <div className="fixed top-4 right-4 flex items-center gap-4 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
        <span className="text-sm font-medium text-slate-700">
          {user?.email}
        </span>
        <button 
          onClick={logOut}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
