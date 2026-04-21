import { FolderGit2, Plus } from 'lucide-react';

export default function Projects() {
  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1">Manage your clients and their knowledge bases.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-12 text-center">
          <FolderGit2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No projects yet</h3>
          <p className="text-slate-500 mt-1">Create your first project to start generating content.</p>
        </div>
      </div>
    </div>
  );
}
