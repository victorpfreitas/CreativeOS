import { useAuth } from '../lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function Login() {
  const { user, signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      await signIn();
    } catch (err) {
      setError('Failed to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Made by Human</h1>
        <p className="text-slate-500 mb-8">Creative OS and Carousel Automator</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
          )}
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <p className="text-xs text-slate-400 mt-6">
          Restricted internal access only.
        </p>
      </div>
    </div>
  );
}
