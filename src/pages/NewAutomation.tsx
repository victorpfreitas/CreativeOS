import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Sparkles, Image as ImageIcon, Calendar, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Project, ImageCollection } from '../lib/types';
import * as db from '../lib/database';
import { generateHooks } from '../services/geminiService';

export default function NewAutomation() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [collections, setCollections] = useState<ImageCollection[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [narrativePrompt, setNarrativePrompt] = useState('');
  const [formatPrompt, setFormatPrompt] = useState('');
  const [softCta, setSoftCta] = useState('');
  const [scheduleDays, setScheduleDays] = useState<string[]>(['mon', 'wed', 'fri']);
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [hookCollectionId, setHookCollectionId] = useState('');
  const [bodyCollectionId, setBodyCollectionId] = useState('');

  useEffect(() => {
    db.getProjects().then(setProjects).catch(console.error);
    db.getCollections().then(setCollections).catch(console.error);
  }, []);

  const dayOptions = [
    { value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' },
    { value: 'wed', label: 'Wed' }, { value: 'thu', label: 'Thu' },
    { value: 'fri', label: 'Fri' }, { value: 'sat', label: 'Sat' },
    { value: 'sun', label: 'Sun' },
  ];

  function toggleDay(day: string) {
    setScheduleDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  async function handleSave() {
    if (!projectId || !name.trim() || !niche.trim()) return;
    setSaving(true);
    try {
      const automation = await db.createAutomation({
        project_id: projectId,
        name: name.trim(),
        niche: niche.trim(),
        narrative_prompt: narrativePrompt,
        format_prompt: formatPrompt,
        soft_cta: softCta,
        schedule_days: scheduleDays,
        schedule_time: scheduleTime,
        schedule_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hook_collection_id: hookCollectionId || null,
        body_collection_id: bodyCollectionId || null,
      });

      try {
        const project = projects.find((p) => p.id === projectId);
        const hookTexts = await generateHooks({
          niche: niche.trim(),
          narrativePrompt: narrativePrompt,
          knowledgeBase: project?.knowledge_base,
          count: 10,
        });
        await db.createHooks(hookTexts.map((text) => ({ automation_id: automation.id, text })));
      } catch (aiErr) {
        console.error('Hook generation failed:', aiErr);
        alert('Automação criada! Mas a geração automática de hooks falhou — você pode gerá-los manualmente na página da automação.');
      }

      navigate(`/automations/${automation.id}`);
    } catch (err) {
      console.error('Error creating automation:', err);
      alert('Erro ao criar automação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  const hookCols = collections.filter(c => c.type === 'hook');
  const bodyCols = collections.filter(c => c.type === 'body');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="flex items-center gap-4">
        <Link to="/automations" className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Automation</h1>
          <p className="text-slate-500 text-sm">Design a repeatable content system for a specific niche.</p>
        </div>
      </header>

      <div className="space-y-6">
        {/* Project Selection */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Project</h2>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Select a project...</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {projects.length === 0 && <p className="text-sm text-amber-600">No projects found. <Link to="/projects" className="underline font-medium">Create one first</Link>.</p>}
        </div>

        {/* Core Strategy */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-500" />Core Strategy</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Automation Name *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Real Estate Tips" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Niche / Topic *</label><input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. First-time homebuyers" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          </div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Narrative Prompt</label><textarea rows={3} value={narrativePrompt} onChange={(e) => setNarrativePrompt(e.target.value)} placeholder="e.g. Informative but casual..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Format Prompt</label><textarea rows={2} value={formatPrompt} onChange={(e) => setFormatPrompt(e.target.value)} placeholder="e.g. 5 slides max. Short bullet points. Use emojis." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Soft CTA</label><input type="text" value={softCta} onChange={(e) => setSoftCta(e.target.value)} placeholder="e.g. Follow for more tips 👋" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
        </div>

        {/* Image Content */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-indigo-500" />Visual Identity</h2>
          <p className="text-sm text-slate-500">Select image collections to automatically assign backgrounds to generated slides.</p>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Hook Cover Collection</label>
              <select value={hookCollectionId} onChange={(e) => setHookCollectionId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">None (Random colors)</option>
                {hookCols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Body Slides Collection</label>
              <select value={bodyCollectionId} onChange={(e) => setBodyCollectionId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">None (Random colors)</option>
                {bodyCols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-500" />Schedule & Publishing</h2>
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">Days</label>
            <div className="flex gap-2">
              {dayOptions.map((day) => <button key={day.value} type="button" onClick={() => toggleDay(day.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${scheduleDays.includes(day.value) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{day.label}</button>)}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Time</label>
            <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="flex justify-end pt-4 pb-12">
          <button type="button" onClick={handleSave} disabled={saving || !projectId || !name.trim() || !niche.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Save className="w-4 h-4" /> Save & Generate Hooks</>}
          </button>
        </div>
      </div>
    </div>
  );
}
