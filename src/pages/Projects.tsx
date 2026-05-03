import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { BarChart2, ChevronRight, FolderGit2, Plus, Sparkles, Trash2, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import type { BrandDNA, Project } from '../lib/types';
import * as db from '../lib/database';

function getBrandDnaProgress(brandDna?: BrandDNA) {
  if (!brandDna) return { score: 0, completed: 0, total: 8 };

  const fields = [
    brandDna.bio,
    brandDna.market,
    brandDna.target_audience,
    brandDna.tone_of_voice,
    brandDna.key_messages,
    brandDna.core_promise,
    brandDna.unique_mechanism,
    brandDna.proof_points,
  ];
  const completed = fields.filter((value) => value && value.trim().length > 0).length;
  return {
    score: Math.round((completed / fields.length) * 100),
    completed,
    total: fields.length,
  };
}

function getBrandDnaStatus(score: number) {
  if (score >= 75) return { label: 'Pronto para gerar', tone: 'emerald' as const };
  if (score >= 40) return { label: 'Quase sólido', tone: 'amber' as const };
  return { label: 'Precisa de contexto', tone: 'slate' as const };
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    try {
      const data = await db.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setName('');
    setModalOpen(true);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await db.createProject({ name: name.trim(), knowledge_base: '' });
      setModalOpen(false);
      loadProjects();
    } catch (err) {
      console.error('Error creating project:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e: { preventDefault: () => void }, id: string) {
    e.preventDefault();
    if (!confirm('Deletar este projeto e todas as suas automações?')) return;
    try {
      await db.deleteProject(id);
      loadProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  }

  const readyProjects = useMemo(
    () => projects.filter((project) => getBrandDnaProgress(project.brand_dna).score >= 75).length,
    [projects]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
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
            <Sparkles className="w-4 h-4" /> Base dos experts
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Projetos com próxima ação clara</h1>
            <p className="text-slate-500 mt-1">Cada projeto agora mostra se já tem contexto para gerar conteúdo, o que está faltando e para onde ir em seguida.</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="premium-button-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Projeto
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryMetric label="Projetos vivos" value={projects.length} detail="Experts e marcas ativas no sistema." />
        <SummaryMetric label="Prontos para gerar" value={readyProjects} detail="Já têm DNA forte para drafts mais autorais." />
        <SummaryMetric label="Precisando de DNA" value={projects.length - readyProjects} detail="Ainda pedem promessa, método e provas." />
      </div>

      {projects.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <FolderGit2 className="w-16 h-16 text-slate-700 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white">Nenhum projeto ainda</h3>
          <p className="text-slate-500 mt-2 mb-8">Crie seu primeiro projeto para conectar Brand DNA, drafts e automações no mesmo lugar.</p>
          <button
            onClick={openCreate}
            className="premium-button-primary inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Criar Projeto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((project) => {
            const progress = getBrandDnaProgress(project.brand_dna);
            const status = getBrandDnaStatus(progress.score);
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="premium-card p-6 hover:border-indigo-500/30 hover:shadow-indigo-500/5 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-600/10 transition-all" />

                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FolderGit2 className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white leading-tight">{project.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">DNA {progress.score}%</p>
                    </div>
                  </div>
                  <button
                    onClick={(e: { preventDefault: () => void }) => handleDelete(e, project.id)}
                    className="p-2 hover:bg-red-500/10 rounded-xl transition-all text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 mb-6 relative z-10">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
                      status.tone === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-200'
                        : status.tone === 'amber'
                          ? 'bg-amber-500/10 text-amber-100'
                          : 'bg-white/[0.04] text-slate-300'
                    }`}>
                      {status.label}
                    </span>
                    <span className="text-xs text-slate-500">{progress.completed}/{progress.total} blocos-chave</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress.score >= 75 ? 'bg-emerald-400' : progress.score >= 40 ? 'bg-amber-300' : 'bg-slate-500'
                      }`}
                      style={{ width: `${Math.max(progress.score, 6)}%` }}
                    />
                  </div>
                  {project.brand_dna?.core_promise ? (
                    <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">{project.brand_dna.core_promise}</p>
                  ) : project.brand_dna?.bio ? (
                    <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">{project.brand_dna.bio}</p>
                  ) : (
                    <p className="text-sm text-slate-500 leading-relaxed">Ainda falta estruturar promessa, método, provas e mensagem central deste expert.</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 relative z-10">
                  <ProjectShortcut to={`/create?project=${project.id}`} icon={Sparkles} label="Criar draft" />
                  <ProjectShortcut to={`/automations/new?project=${project.id}`} icon={Zap} label="Automação" />
                  <ProjectShortcut to={`/projects/${project.id}/analysis`} icon={BarChart2} label="Análise" />
                </div>

                <div className="flex items-center justify-between pt-4 mt-5 border-t border-white/5 relative z-10">
                  <p className="text-xs text-slate-500">
                    {progress.score >= 75 ? 'Pronto para escalar conteúdo.' : 'Vale completar o DNA antes de automatizar.'}
                  </p>
                  <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Projeto">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="premium-label">Nome do projeto</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Ex: Cliente Premium ABC"
              className="premium-input w-full"
              autoFocus
            />
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-2">Dica: você pode criar primeiro e fortalecer o Brand DNA logo em seguida.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="premium-button-secondary text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="premium-button-primary text-sm"
            >
              {saving ? 'Criando...' : 'Criar Projeto →'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="premium-card p-5">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-bold text-white font-space tracking-tighter">{value}</p>
      <p className="mt-2 text-sm text-slate-500 leading-relaxed">{detail}</p>
    </div>
  );
}

function ProjectShortcut({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      onClick={(event) => event.stopPropagation()}
      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center hover:bg-white/[0.06] transition-colors"
    >
      <Icon className="w-4 h-4 text-indigo-300 mx-auto mb-2" />
      <span className="text-[11px] font-bold text-slate-200">{label}</span>
    </Link>
  );
}
