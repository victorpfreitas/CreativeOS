import { useState, useEffect } from 'react';
import { FolderGit2, Plus, Pencil, Trash2, BookOpen, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import type { Project } from '../lib/types';
import * as db from '../lib/database';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState('');
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
    setEditingProject(null);
    setName('');
    setKnowledgeBase('');
    setModalOpen(true);
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setName(project.name);
    setKnowledgeBase(project.knowledge_base);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingProject) {
        await db.updateProject(editingProject.id, { name: name.trim(), knowledge_base: knowledgeBase });
      } else {
        await db.createProject({ name: name.trim(), knowledge_base: knowledgeBase });
      }
      setModalOpen(false);
      loadProjects();
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project and all its automations?')) return;
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
          <p className="text-slate-500 mt-1">Manage your clients and their knowledge bases.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </header>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-12 text-center">
            <FolderGit2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No projects yet</h3>
            <p className="text-slate-500 mt-1 mb-4">Create your first project to start generating content.</p>
            <button
              onClick={openCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <FolderGit2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{project.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(project)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {project.knowledge_base ? (
                <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                  <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                  {project.knowledge_base}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic mb-4">No knowledge base yet</p>
              )}

              <Link
                to={`/automations?project=${project.id}`}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                View Automations
              </Link>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingProject ? 'Edit Project' : 'New Project'}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Client ABC"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Knowledge Base</label>
            <p className="text-xs text-slate-500">Brand guidelines, tone of voice, key messages. The AI will use this when generating content.</p>
            <textarea
              rows={5}
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              placeholder="e.g. We are a luxury real estate agency. Our tone is professional but approachable. We never use slang..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {saving ? 'Saving...' : editingProject ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
