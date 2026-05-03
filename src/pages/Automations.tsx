import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { AlertTriangle, ArrowRight, Clock3, Pause, Play, Plus, Sparkles, Trash2, Zap } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Automation, Slideshow } from '../lib/types';
import * as db from '../lib/database';

type AutomationSummary = {
  drafts: Slideshow[];
  latestDraft?: Slideshow;
  health: 'active' | 'paused' | 'missing_inputs' | 'setup_needed';
  detail: string;
};

function formatSchedule(auto: Automation) {
  if (!auto.schedule_days?.length) return 'Agenda não definida';
  return `${auto.schedule_days.join(', ')} · ${auto.schedule_time || '10:00'}`;
}

export default function Automations() {
  const [searchParams] = useSearchParams();
  const projectFilter = searchParams.get('project');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<string, AutomationSummary>>({});

  useEffect(() => { loadAutomations(); }, [projectFilter]);

  async function loadAutomations() {
    setLoading(true);
    try {
      const data = projectFilter
        ? await db.getAutomationsByProject(projectFilter)
        : await db.getAutomations();
      setAutomations(data);

      const draftLists = await Promise.all(
        data.map(async (auto) => ({ id: auto.id, drafts: await db.getSlideshowsByAutomation(auto.id) }))
      );

      const nextSummaries = draftLists.reduce<Record<string, AutomationSummary>>((acc, item) => {
        const automation = data.find((auto) => auto.id === item.id);
        if (!automation) return acc;

        let health: AutomationSummary['health'] = 'active';
        let detail = 'Sistema pronto para continuar gerando e revisando drafts.';

        if (automation.status === 'paused') {
          health = 'paused';
          detail = 'A rotina está pausada e pode ser retomada quando fizer sentido.';
        } else if (!automation.schedule_days?.length || !automation.schedule_time) {
          health = 'setup_needed';
          detail = 'Falta definir agenda para transformar esta estratégia em recorrência.';
        } else if (!automation.narrative_prompt.trim() || !automation.niche.trim()) {
          health = 'missing_inputs';
          detail = 'A estratégia ainda precisa de contexto para gerar drafts com consistência.';
        } else if (item.drafts.length === 0) {
          health = 'setup_needed';
          detail = 'A automação está montada, mas ainda não gerou nenhum draft para validar.';
        }

        acc[item.id] = {
          drafts: item.drafts,
          latestDraft: item.drafts[0],
          health,
          detail,
        };
        return acc;
      }, {});

      setSummaries(nextSummaries);
    } catch (err) {
      console.error('Error loading automations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(auto: Automation) {
    try {
      await db.updateAutomation(auto.id, {
        status: auto.status === 'active' ? 'paused' : 'active',
      });
      loadAutomations();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this automation and all its hooks and slideshows?')) return;
    try {
      await db.deleteAutomation(id);
      loadAutomations();
    } catch (err) {
      console.error('Error deleting automation:', err);
    }
  }

  const groupedCounts = useMemo(() => {
    return automations.reduce(
      (acc, auto) => {
        const summary = summaries[auto.id];
        if (!summary) return acc;
        acc[summary.health] += 1;
        return acc;
      },
      { active: 0, paused: 0, missing_inputs: 0, setup_needed: 0 }
    );
  }, [automations, summaries]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
            <Sparkles className="w-4 h-4" /> Rotina recorrente
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Automações com saúde operacional clara</h1>
            <p className="text-slate-500 mt-1">Agora cada sistema mostra se está ativo, travado, sem insumos ou pronto para levar você de volta ao draft.</p>
          </div>
        </div>
        <Link
          to={projectFilter ? `/automations/new?project=${projectFilter}` : '/automations/new'}
          className="premium-button-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Automação
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatusMetric label="Ativas" value={groupedCounts.active} tone="emerald" />
        <StatusMetric label="Pausadas" value={groupedCounts.paused} tone="slate" />
        <StatusMetric label="Sem insumos" value={groupedCounts.missing_inputs} tone="amber" />
        <StatusMetric label="Pedindo setup" value={groupedCounts.setup_needed} tone="indigo" />
      </div>

      {automations.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">Nenhuma automação ainda</h3>
          <p className="text-slate-500 mt-1 mb-4">
            Crie sua primeira automação para ligar estratégia, agenda e geração recorrente no mesmo fluxo.
          </p>
          <Link
            to={projectFilter ? `/automations/new?project=${projectFilter}` : '/automations/new'}
            className="premium-button-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Criar Automação
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {automations.map((auto) => {
            const summary = summaries[auto.id];
            const latestDraft = summary?.latestDraft;
            const healthTone = summary?.health === 'active'
              ? 'emerald'
              : summary?.health === 'paused'
                ? 'slate'
                : summary?.health === 'missing_inputs'
                  ? 'amber'
                  : 'indigo';

            return (
              <div key={auto.id} className="premium-card p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
                        healthTone === 'emerald'
                          ? 'bg-emerald-500/10 text-emerald-200'
                          : healthTone === 'amber'
                            ? 'bg-amber-500/10 text-amber-100'
                            : healthTone === 'indigo'
                              ? 'bg-indigo-500/10 text-indigo-200'
                              : 'bg-white/[0.04] text-slate-300'
                      }`}>
                        {summary?.health === 'active' && 'Operando'}
                        {summary?.health === 'paused' && 'Pausada'}
                        {summary?.health === 'missing_inputs' && 'Sem insumos'}
                        {summary?.health === 'setup_needed' && 'Setup pendente'}
                      </span>
                      <span className="text-xs text-slate-500 uppercase tracking-widest font-black">{auto.project?.name || 'Sem projeto'}</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{auto.name}</h2>
                      <p className="text-sm text-slate-400 mt-1">{auto.niche}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStatus(auto)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        {auto.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {auto.status === 'active' ? 'Pausar' : 'Retomar'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDelete(auto.id)}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/20 transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <AutomationFact icon={Clock3} label="Agenda" value={formatSchedule(auto)} />
                  <AutomationFact icon={Zap} label="Drafts gerados" value={`${summary?.drafts.length || 0}`} />
                  <AutomationFact icon={AlertTriangle} label="CTA suave" value={auto.soft_cta?.trim() ? 'Definido' : 'Faltando'} />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Saúde do sistema</p>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">{summary?.detail || 'Carregando estado da automação.'}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Link to={`/automations/${auto.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors group">
                    <p className="text-sm font-bold text-white">Abrir sistema</p>
                    <p className="text-xs text-slate-500 mt-1">Revisar hooks, narrativa e regras.</p>
                    <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-indigo-300">
                      Ver detalhes <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>

                  {latestDraft ? (
                    <Link to={`/editor/${latestDraft.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors group">
                      <p className="text-sm font-bold text-white">Continuar último draft</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {latestDraft.slides?.length || 0} slides · {latestDraft.status || 'draft'}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-emerald-300">
                        Abrir editor <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Link>
                  ) : (
                    <Link to={`/automations/${auto.id}`} className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 hover:bg-white/[0.03] transition-colors group">
                      <p className="text-sm font-bold text-white">Gerar primeiro draft</p>
                      <p className="text-xs text-slate-500 mt-1">Valide esta automação produzindo o primeiro carrossel.</p>
                      <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-amber-200">
                        Preparar geração <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusMetric({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'indigo' | 'slate' }) {
  const cls = tone === 'emerald'
    ? 'bg-emerald-500/10 text-emerald-200'
    : tone === 'amber'
      ? 'bg-amber-500/10 text-amber-100'
      : tone === 'indigo'
        ? 'bg-indigo-500/10 text-indigo-200'
        : 'bg-white/[0.04] text-slate-200';

  return (
    <div className="premium-card p-5">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-4xl font-bold text-white font-space tracking-tighter">{value}</p>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${cls}`}>{label}</span>
      </div>
    </div>
  );
}

function AutomationFact({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="w-4 h-4" />
        <p className="text-[11px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className="mt-3 text-sm font-bold text-white leading-snug">{value}</p>
    </div>
  );
}
