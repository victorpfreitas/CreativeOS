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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-12 text-center">
            <FolderGit2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Nenhum projeto ainda</h3>
            <p className="text-slate-500 mt-1 mb-4">Crie seu primeiro projeto para começar a gerar conteúdo.</p>
            <button
              onClick={openCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar Projeto
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <FolderGit2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{project.name}</h3>
                </div>
                <button
                  onClick={(e: { preventDefault: () => void }) => handleDelete(e, project.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Brand DNA status */}
              <div className="space-y-2 mb-4">
                {project.brand_dna?.bio ? (
                  <p className="text-sm text-slate-500 line-clamp-2">{project.brand_dna.bio}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">Brand DNA não configurado</p>
                )}
              </div>

              {/* Quick links row */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                    <Zap className="w-3.5 h-3.5" /> Automações
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600 transition-colors">
                    <BarChart2 className="w-3.5 h-3.5" /> Análise
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400 hover:text-purple-600 transition-colors">
                    <Calendar className="w-3.5 h-3.5" /> Plano
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create modal — just the name; brand DNA is filled in ProjectDetail */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Projeto">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nome do projeto</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Ex: Cliente ABC"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <p className="text-xs text-slate-400">O Brand DNA e a estratégia são configurados dentro do projeto.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {saving ? 'Criando...' : 'Criar e configurar →'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
