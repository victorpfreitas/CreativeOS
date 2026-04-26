import { useAuth } from '../lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

function getAuthErrorCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return '';
}

function getLoginErrorMessage(error: unknown): string {
  const code = getAuthErrorCode(error);
  const host = window.location.hostname;

  if (code === 'auth/unauthorized-domain') {
    return `Este preview (${host}) ainda nao esta autorizado no Firebase Auth. Adicione esse dominio em Firebase Console > Authentication > Settings > Authorized domains, ou teste pela URL de producao.`;
  }

  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou a janela do Google. Libere pop-ups para este site e tente novamente.';
  }

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'O login foi cancelado antes de terminar. Abra o pop-up do Google ate concluir a autenticacao.';
  }

  if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid' || code === 'auth/invalid-auth-event') {
    return 'As chaves do Firebase nao parecem configuradas neste ambiente de preview da Vercel. Confira as Environment Variables de Preview.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Nao consegui falar com o Firebase agora. Verifique a conexao e tente novamente.';
  }

  return code ? `Login falhou (${code}). Tente novamente ou use a URL de producao.` : 'Nao consegui fazer login agora. Tente novamente.';
}

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
      setError(getLoginErrorMessage(err));
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
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Creative OS</h1>
        <p className="text-slate-500 mb-8">Sistema de conteudo para experts</p>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm mb-6 text-left flex gap-3 leading-relaxed">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
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
          {loading ? 'Entrando...' : 'Entrar com Google'}
        </button>

        <p className="text-xs text-slate-400 mt-6">
          Acesso restrito.
        </p>
      </div>
    </div>
  );
}
