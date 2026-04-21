import { useState, useEffect } from 'react';
import { ArrowLeft, Zap, RefreshCw, Loader2, Film, Trash2, CheckCircle, Circle } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import type { Automation, Hook, Slideshow } from '../lib/types';
import * as db from '../lib/database';
import { generateHooks, generateSlideshow } from '../services/geminiService';

export default function AutomationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingHooks, setGeneratingHooks] = useState(false);
  const [generatingSlideshow, setGeneratingSlideshow] = useState<string | null>(null);

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    try {
      const [auto, hks, shows] = await Promise.all([
        db.getAutomation(id!),
        db.getHooksByAutomation(id!),
        db.getSlideshowsByAutomation(id!),
      ]);
      setAutomation(auto);
      setHooks(hks);
      setSlideshows(shows);
    } catch (err) {
      console.error('Error loading automation:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateMoreHooks() {
    if (!automation) return;
    setGeneratingHooks(true);
    try {
      const project = automation.project;
      const hookTexts = await generateHooks({
        niche: automation.niche,
        narrativePrompt: automation.narrative_prompt,
        knowledgeBase: project?.knowledge_base,
        count: 10,
      });
      await db.createHooks(
        hookTexts.map((text) => ({ automation_id: automation.id, text }))
      );
      loadData();
    } catch (err) {
      console.error('Error generating hooks:', err);
    } finally {
      setGeneratingHooks(false);
    }
  }

  async function handleGenerateSlideshow(hook: Hook) {
    if (!automation) return;
    setGeneratingSlideshow(hook.id);
    try {
      const project = automation.project;
      const result = await generateSlideshow({
        hookText: hook.text,
        niche: automation.niche,
        narrativePrompt: automation.narrative_prompt,
        formatPrompt: automation.format_prompt,
        softCta: automation.soft_cta,
        knowledgeBase: project?.knowledge_base,
      });

      // Fetch collection images if automation has them assigned
      let hookImages: string[] = [];
      let bodyImages: string[] = [];
      
      if (automation.hook_collection_id) {
        const col = await db.getCollection(automation.hook_collection_id);
        if (col && col.images) hookImages = col.images.map((i) => i.url);
      }
      if (automation.body_collection_id) {
        const col = await db.getCollection(automation.body_collection_id);
        if (col && col.images) bodyImages = col.images.map((i) => i.url);
      }

      const getRandomImage = (images: string[]) => images.length > 0 ? images[Math.floor(Math.random() * images.length)] : '';

      // Add assigned or placeholder images to slides
      const slidesWithImages = result.slides.map((slide, index) => ({
        ...slide,
        image_url: index === 0 ? getRandomImage(hookImages) : getRandomImage(bodyImages),
      }));

      const slideshow = await db.createSlideshow({
        automation_id: automation.id,
        hook_id: hook.id,
        slides: slidesWithImages,
        caption: result.caption,
      });

      await db.markHookUsed(hook.id);
      navigate(`/editor/${slideshow.id}`);
    } catch (err) {
      console.error('Error generating slideshow:', err);
    } finally {
      setGeneratingSlideshow(null);
    }
  }

  async function handleDeleteHook(hookId: string) {
    try {
      await db.deleteHook(hookId);
      loadData();
    } catch (err) {
      console.error('Error deleting hook:', err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Automation not found.</p>
        <Link to="/automations" className="text-indigo-600 hover:underline mt-2 inline-block">Back to Automations</Link>
      </div>
    );
  }

  const unusedHooks = hooks.filter((h) => !h.used);
  const usedHooks = hooks.filter((h) => h.used);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Link to="/automations" className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{automation.name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
              automation.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${automation.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {automation.status}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">{automation.niche} • {automation.project?.name}</p>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Available Hooks</p>
          <p className="text-2xl font-bold text-slate-900">{unusedHooks.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Used Hooks</p>
          <p className="text-2xl font-bold text-slate-900">{usedHooks.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Slideshows</p>
          <p className="text-2xl font-bold text-slate-900">{slideshows.length}</p>
        </div>
      </div>

      {/* Hooks */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-500" />
            Hook Bank ({hooks.length} total)
          </h2>
          <button
            onClick={handleGenerateMoreHooks}
            disabled={generatingHooks}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            {generatingHooks ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Generate 10 More</>
            )}
          </button>
        </div>

        {hooks.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No hooks yet. Click "Generate 10 More" to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {hooks.map((hook) => (
              <div
                key={hook.id}
                className={`flex items-center gap-4 p-4 ${hook.used ? 'opacity-60 bg-slate-50' : 'hover:bg-slate-50'} transition-colors`}
              >
                {hook.used ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                )}
                <p className="flex-1 text-slate-900 text-sm">{hook.text}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!hook.used && (
                    <button
                      onClick={() => handleGenerateSlideshow(hook)}
                      disabled={generatingSlideshow === hook.id}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      {generatingSlideshow === hook.id ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                      ) : (
                        <><Film className="w-3 h-3" /> Create Slideshow</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteHook(hook.id)}
                    className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slideshows */}
      {slideshows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Film className="w-5 h-5 text-emerald-500" />
              Generated Slideshows ({slideshows.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {slideshows.map((show) => (
              <Link
                key={show.id}
                to={`/editor/${show.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <Film className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {show.hook?.text || 'Untitled'}
                  </p>
                  <p className="text-xs text-slate-500">{show.slides?.length || 0} slides</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  show.status === 'published' ? 'bg-emerald-100 text-emerald-700' :
                  show.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {show.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
