import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, ChevronRight, Clock3, Film, FolderGit2, Plus, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as db from '../lib/database';
import type { Automation, Project, Slideshow } from '../lib/types';
import { getReviewStateLabel } from '../lib/queueUtils';

function getBrandDnaScore(project: Project) {
  const dna = project.brand_dna;
  if (!dna) return 0;
  const fields = [
    dna.bio,
    dna.market,
    dna.target_audience,
    dna.tone_of_voice,
    dna.key_messages,
    dna.core_promise,
    dna.unique_mechanism,
    dna.proof_points,
  ];
  const filled = fields.filter((value) => value && value.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

export default function Dashboard() {
  const [stats, setStats] = useState({ totalAutomations: 0, totalSlideshows: 0, totalHooks: 0, scheduledToday: 0 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentAutomations, setRecentAutomations] = useState<Automation[]>([]);
  const [allSlideshows, setAllSlideshows] = useState<Slideshow[]>([]);
  const [recentSlideshows, setRecentSlideshows] = useState<Slideshow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, projectData, autos, shows] = await Promise.all([
          db.getDashboardStats(),
          db.getProjects(),
          db.getAutomations(),
          db.getSlideshows(),
        ]);
        setStats(s);
        setProjects(projectData);
        setRecentAutomations(autos.slice(0, 5));
        setAllSlideshows(shows);
        setRecentSlideshows(shows.slice(0, 5));
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const projectsMissingDna = useMemo(
    () => projects.filter((project) => getBrandDnaScore(project) < 50),
    [projects]
  );
  const queueItems = useMemo(
    () => allSlideshows.filter((show) => show.review_state && show.review_state !== 'approved' && show.review_state !== 'rejected'),
    [allSlideshows]
  );
  const queuedForReview = queueItems.filter((show) => show.review_state === 'queued').length;
  const recentQueueItems = queueItems.slice(0, 3);
  const latestDraft = recentSlideshows[0];
  const latestProjectNeedingSetup = projectsMissingDna[0];

  const nextAction = useMemo(() => {
    if (projects.length === 0) {
      return {
        label: 'Criar primeiro projeto',
        description: 'Comece definindo o expert ou cliente antes de abrir drafts soltos.',
        href: '/projects',
        cta: 'Abrir projetos',
      };
    }

    if (latestProjectNeedingSetup) {
      return {
        label: 'Completar Brand DNA',
        description: `O projeto ${latestProjectNeedingSetup.name} ainda precisa de contexto para a IA sair do genérico.`,
        href: `/projects/${latestProjectNeedingSetup.id}`,
        cta: 'Definir posicionamento',
      };
    }

    if (!latestDraft) {
      return {
        label: 'Gerar primeiro draft',
        description: 'Seu sistema já tem base suficiente. Agora vale abrir o criador guiado e validar um carrossel real.',
        href: projects[0] ? `/create?project=${projects[0].id}` : '/create',
        cta: 'Criar conteúdo',
      };
    }

    if (stats.totalAutomations === 0) {
      return {
        label: 'Montar a primeira automação',
        description: 'Você já tem material de base. O próximo passo é transformar isso em rotina recorrente.',
        href: projects[0] ? `/automations/new?project=${projects[0].id}` : '/automations/new',
        cta: 'Criar automação',
      };
    }

    return {
      label: 'Continuar último draft',
      description: 'Há um carrossel recente pronto para revisão visual, ajustes finos e export.',
      href: `/editor/${latestDraft.id}`,
      cta: 'Abrir editor',
    };
  }, [latestDraft, latestProjectNeedingSetup, projects, stats.totalAutomations]);

  const inMotionItems = [
    {
      label: 'Drafts recentes',
      value: `${stats.totalSlideshows}`,
      detail: latestDraft ? 'Há material recente para revisão e export.' : 'Ainda sem drafts em andamento.',
      icon: Film,
      tone: 'emerald',
    },
    {
      label: 'Sistemas ativos',
      value: `${recentAutomations.filter((auto) => auto.status === 'active').length}`,
      detail: stats.totalAutomations > 0 ? 'Rotinas prontas para gerar conteúdo recorrente.' : 'Nenhuma rotina automatizada ainda.',
      icon: Zap,
      tone: 'indigo',
    },
    {
      label: 'Agendados hoje',
      value: `${stats.scheduledToday}`,
      detail: stats.scheduledToday > 0 ? 'Já existe conteúdo planejado para hoje.' : 'Nada programado para a janela atual.',
      icon: Clock3,
      tone: 'amber',
    },
  ];

  const blockedItems = [
    {
      label: 'Projetos sem DNA forte',
      value: `${projectsMissingDna.length}`,
      detail: projectsMissingDna.length > 0 ? 'Alguns experts ainda não têm promessa, método e provas bem definidos.' : 'Os projetos principais já têm contexto mínimo.',
    },
    {
      label: 'Automações pausadas',
      value: `${recentAutomations.filter((auto) => auto.status === 'paused').length}`,
      detail: recentAutomations.some((auto) => auto.status === 'paused') ? 'Existem sistemas que podem voltar para a rotina.' : 'Nenhuma automação parada entre as mais recentes.',
    },
    {
      label: 'Projetos sem draft',
      value: `${Math.max(projects.length - stats.totalSlideshows, 0)}`,
      detail: projects.length > stats.totalSlideshows ? 'Há espaço para testar mais drafts com os experts já cadastrados.' : 'Todos os projetos já passaram pela fase de draft.',
    },
  ];

  const statCards = [
    { label: 'Sistemas ativos', value: stats.totalAutomations, icon: Zap, color: 'text-indigo-500 bg-indigo-50' },
    { label: 'Na draft queue', value: queuedForReview, icon: CheckCircle2, color: 'text-sky-500 bg-sky-50' },
    { label: 'Carrosséis criados', value: stats.totalSlideshows, icon: Film, color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Hooks disponíveis', value: stats.totalHooks, icon: TrendingUp, color: 'text-amber-500 bg-amber-50' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
            <Sparkles className="w-4 h-4" /> Sistema de conteúdo para experts
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-white font-space tracking-tight leading-none">
              Uma operação guiada de fonte até export.
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
              CreativeOS fica mais forte quando o próximo passo é óbvio: organizar o expert, gerar o draft, revisar no editor e repetir com rotina.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to={nextAction.href} className="premium-button-primary flex items-center gap-3 text-base">
              <Target className="w-5 h-5" /> {nextAction.cta}
            </Link>
            <Link to="/projects" className="premium-button-secondary flex items-center gap-3 text-base">
              Ajustar projetos
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 premium-card p-6 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-emerald-600/10" />
          <div className="relative z-10 h-full flex flex-col justify-between gap-8">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Próxima melhor ação</span>
              <Target className="w-5 h-5 text-indigo-300" />
            </div>
            <div className="space-y-4">
              <p className="text-3xl font-black text-white leading-tight">{nextAction.label}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{nextAction.description}</p>
            </div>
            <Link to={nextAction.href} className="flex items-center justify-between pt-4 border-t border-white/5 group">
              <span className="text-sm font-bold text-white">{nextAction.cta}</span>
              <ChevronRight className="w-5 h-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="premium-card p-6 group hover:border-white/10 transition-all duration-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{card.label}</h3>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-4xl font-bold text-white font-space tracking-tighter">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="premium-card p-6 xl:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <h2 className="text-lg font-bold text-white">Já em movimento</h2>
          </div>
          <div className="space-y-4">
            {inMotionItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone === 'emerald' ? 'bg-emerald-500/10 text-emerald-300' : item.tone === 'amber' ? 'bg-amber-500/10 text-amber-200' : 'bg-indigo-500/10 text-indigo-300'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{item.label}</p>
                        <p className="text-xs text-slate-500 mt-1">{item.detail}</p>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-white">{item.value}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="premium-card p-6 xl:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <h2 className="text-lg font-bold text-white">O que está travando</h2>
          </div>
          <div className="space-y-4">
            {blockedItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-white">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.detail}</p>
                  </div>
                  <span className="text-xl font-black text-amber-200">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="premium-card p-6 xl:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-indigo-300" />
            <h2 className="text-lg font-bold text-white">Atalhos úteis</h2>
          </div>
          <div className="space-y-3">
            <QuickAction
              to={projects[0] ? `/create?project=${projects[0].id}` : '/create'}
              title="Criar draft guiado"
              detail="Fonte, ângulo, estratégia e handoff para o editor."
            />
            <QuickAction
              to="/projects"
              title="Revisar Brand DNA"
              detail="Fortaleça promessa, método, crenças e provas do expert."
            />
            <QuickAction
              to={projects[0] ? `/automations/new?project=${projects[0].id}` : '/automations/new'}
              title="Montar rotina recorrente"
              detail="Conecte um projeto e tire uma automação do papel."
            />
            <QuickAction
              to="/queue"
              title="Revisar draft queue"
              detail="Veja o que a operação já gerou e assuma a próxima revisão."
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="premium-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Draft queue</h2>
            <Link to="/queue" className="text-xs font-black text-sky-400 uppercase tracking-widest hover:text-sky-300">Abrir fila</Link>
          </div>
          {recentQueueItems.length === 0 ? <div className="p-12 text-center text-slate-600 text-sm italic">Nenhum draft aguardando revisão agora</div> : (
            <div className="divide-y divide-white/5">
              {recentQueueItems.map((show) => (
                <Link key={show.id} to={`/editor/${show.id}`} className="flex items-center gap-4 p-6 hover:bg-white/[0.03] transition-colors group">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-6 h-6 text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate text-lg group-hover:text-sky-300 transition-colors">{show.hook?.text || show.slides?.[0]?.title || show.slides?.[0]?.text || 'Draft sem título'}</p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">
                      {getReviewStateLabel(show.review_state)} · {show.generated_by || 'manual'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-800 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          )}
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:col-span-2">
        <div className="premium-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Sistemas recentes</h2>
            <Link to="/automations" className="text-xs font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">Ver todos</Link>
          </div>
          {recentAutomations.length === 0 ? <div className="p-12 text-center text-slate-600 text-sm italic">Nenhum sistema criado ainda</div> : (
            <div className="divide-y divide-white/5">
              {recentAutomations.map((auto) => (
                <Link key={auto.id} to={`/automations/${auto.id}`} className="flex items-center gap-4 p-6 hover:bg-white/[0.03] transition-colors group">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white truncate text-lg group-hover:text-indigo-300 transition-colors">{auto.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${auto.status === 'active' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-slate-500/10 text-slate-300'}`}>
                        {auto.status === 'active' ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">{auto.project?.name || auto.niche}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-800 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="premium-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Drafts recentes</h2>
            <Link to="/gallery" className="text-xs font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300">Ver galeria</Link>
          </div>
          {recentSlideshows.length === 0 ? <div className="p-12 text-center text-slate-600 text-sm italic">Nenhum carrossel criado ainda</div> : (
            <div className="divide-y divide-white/5">
              {recentSlideshows.map((show) => (
                <Link key={show.id} to={`/editor/${show.id}`} className="flex items-center gap-4 p-6 hover:bg-white/[0.03] transition-colors group">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Film className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate text-lg group-hover:text-emerald-300 transition-colors">{show.hook?.text || show.slides?.[0]?.title || show.slides?.[0]?.text || 'Carrossel sem título'}</p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">{show.slides?.length || 0} slides · {show.status || 'draft'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-800 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function QuickAction({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors group">
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-slate-500 mt-1">{detail}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-indigo-300 group-hover:translate-x-1 transition-transform" />
    </Link>
  );
}
