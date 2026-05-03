import { useAuth } from '../lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';

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

  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'E-mail ou senha invalidos.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Login por e-mail e senha ainda nao esta habilitado no Firebase Auth.';
  }

  return code ? `Login falhou (${code}). Tente novamente ou use a URL de producao.` : 'Nao consegui fazer login agora. Tente novamente.';
}

export default function Login() {
  const { user, signIn, signInWithEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailLoading(true);
    setError('');
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_42%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_50%,_#f8fafc_100%)] flex items-center justify-center p-4">
      <div className="max-w-5xl w-full grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-stretch">
        <div className="hidden lg:flex rounded-[32px] border border-indigo-100 bg-slate-950 p-10 text-left overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.35),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.18),_transparent_30%)]" />
          <div className="relative z-10 flex flex-col justify-between gap-10">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-indigo-200/80">
                <Sparkles className="w-4 h-4" /> CreativeOS
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold text-white leading-tight">Operação de conteúdo para experts que precisam gerar, revisar e publicar com consistência.</h1>
                <p className="text-slate-300 leading-relaxed max-w-xl">
                  Entre para continuar no fluxo completo: projeto, Brand DNA, draft guiado, editor de carrossel e rotina recorrente.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <LoginFeature title="Brand DNA forte" detail="Promessa, método, crenças e provas." />
              <LoginFeature title="Draft guiado" detail="Fonte, ângulo e estratégia antes do editor." />
              <LoginFeature title="Rotina recorrente" detail="Automações, planning e handoff para publicação." />
            </div>
          </div>
        </div>

        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl border border-slate-100 p-8 text-center mx-auto">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Creative OS</h1>
          <p className="text-slate-500 mb-2">Sistema de conteúdo para experts</p>
          <p className="text-sm text-slate-400 mb-8">Entre para retomar seus projetos, drafts e automações de onde parou.</p>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm mb-6 text-left flex gap-3 leading-relaxed">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-3 text-left mb-5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">E-mail</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Senha</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                required
              />
            </div>
            <button
              type="submit"
              disabled={emailLoading || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {emailLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              {emailLoading ? 'Entrando...' : 'Entrar com e-mail'}
            </button>
          </form>

          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ou</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || emailLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
            )}
            {loading ? 'Entrando...' : 'Entrar com Google'}
          </button>

          <p className="text-xs text-slate-400 mt-6 leading-relaxed">
            Acesso restrito. Se algo falhar, a mensagem acima já tenta dizer se o problema está em credenciais, preview ou autorização do ambiente.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginFeature({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-400 leading-relaxed">{detail}</p>
    </div>
  );
}
