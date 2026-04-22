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
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <header className="flex items-center gap-4 px-2">
        <Link to="/automations" className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Automation</h1>
          <p className="text-slate-500 text-sm mt-1">Design a repeatable content system for a specific niche.</p>
        </div>
      </header>

      <div className="space-y-6">
        {/* Project Selection */}
        <div className="premium-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Project Connection</h2>
          <div className="space-y-2">
            <label className="premium-label">Target Project</label>
            <select 
              value={projectId} 
              onChange={(e) => setProjectId(e.target.value)} 
              className="premium-input w-full appearance-none cursor-pointer"
            >
              <option value="">Select a project...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {projects.length === 0 && <p className="text-xs text-amber-500/80 mt-2">No projects found. <Link to="/projects" className="underline font-bold text-amber-500">Create one first</Link>.</p>}
          </div>
        </div>

        {/* Core Strategy */}
        <div className="premium-card p-8 space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-white/5">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Core Strategy</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="premium-label">Automation Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Real Estate Tips" className="premium-input w-full" />
            </div>
            <div className="space-y-2">
              <label className="premium-label">Niche / Topic *</label>
              <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. First-time homebuyers" className="premium-input w-full" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="premium-label">Narrative Prompt</label>
            <textarea rows={3} value={narrativePrompt} onChange={(e) => setNarrativePrompt(e.target.value)} placeholder="e.g. Informative but casual, focus on pain points..." className="premium-input w-full resize-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="premium-label">Format Prompt</label>
              <textarea rows={2} value={formatPrompt} onChange={(e) => setFormatPrompt(e.target.value)} placeholder="e.g. 5 slides max. Short bullet points." className="premium-input w-full resize-none" />
            </div>
            <div className="space-y-2">
              <label className="premium-label">Soft CTA</label>
              <textarea rows={2} value={softCta} onChange={(e) => setSoftCta(e.target.value)} placeholder="e.g. Follow for more tips 👋" className="premium-input w-full resize-none" />
            </div>
          </div>
        </div>

        {/* Image Content */}
        <div className="premium-card p-8 space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-white/5">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <ImageIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Visual Identity</h2>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">Select image collections to automatically assign backgrounds to generated slides.</p>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="premium-label">Hook Cover Collection</label>
              <select value={hookCollectionId} onChange={(e) => setHookCollectionId(e.target.value)} className="premium-input w-full appearance-none cursor-pointer">
                <option value="">None (Random colors)</option>
                {hookCols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="premium-label">Body Slides Collection</label>
              <select value={bodyCollectionId} onChange={(e) => setBodyCollectionId(e.target.value)} className="premium-input w-full appearance-none cursor-pointer">
                <option value="">None (Random colors)</option>
                {bodyCols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="premium-card p-8 space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-white/5">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Publishing Schedule</h2>
          </div>
          
          <div className="space-y-4">
            <label className="premium-label">Weekly Schedule</label>
            <div className="flex flex-wrap gap-2">
              {dayOptions.map((day) => (
                <button 
                  key={day.value} 
                  type="button" 
                  onClick={() => toggleDay(day.value)} 
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                    scheduleDays.includes(day.value) 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                      : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="premium-label">Preferred Time</label>
            <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="premium-input w-40" />
          </div>
        </div>

        <div className="flex justify-end pt-6 pb-20">
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={saving || !projectId || !name.trim() || !niche.trim()} 
            className="premium-button-primary flex items-center gap-3 group disabled:opacity-30 disabled:grayscale"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Creating...</>
            ) : (
              <><Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> Save & Generate Hooks</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
