import { useState, useEffect } from 'react';
import { FolderGit2, Plus, Trash2, Zap, BarChart2, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import type { Project } from '../lib/types';
import * as db from '../lib/database';

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
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1">Gerencie seus clientes e estratégias de marca.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Projeto
        </button>
      </header>

      {projects.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <FolderGit2 className="w-16 h-16 text-slate-700 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white">Nenhum projeto ainda</h3>
          <p className="text-slate-500 mt-2 mb-8">Crie seu primeiro projeto para começar a gerar conteúdo.</p>
          <button
            onClick={openCreate}
            className="premium-button-primary inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Criar Projeto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
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
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-black">PROJETO ATIVO</p>
                  </div>
                </div>
                <button
                  onClick={(e: { preventDefault: () => void }) => handleDelete(e, project.id)}
                  className="p-2 hover:bg-red-500/10 rounded-xl transition-all text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Brand DNA status */}
              <div className="space-y-3 mb-6 relative z-10">
                {project.brand_dna?.bio ? (
                  <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{project.brand_dna.bio}</p>
                ) : (
                  <div className="flex items-center gap-2 text-slate-600 italic text-sm">
                    <div className="w-1.5 h-1.5 bg-amber-500/50 rounded-full animate-pulse" />
                    Brand DNA pendente
                  </div>
                )}
              </div>

              {/* Quick links row */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-indigo-400 transition-colors">
                    <Zap className="w-3 h-3" /> Automações
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-emerald-400 transition-colors">
                    <BarChart2 className="w-3 h-3" /> Análise
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}
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
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-2">DICA: O Brand DNA é configurado após a criação.</p>
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
