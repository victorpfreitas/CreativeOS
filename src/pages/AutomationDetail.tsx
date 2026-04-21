import { useState, useEffect } from 'react';
import { ArrowLeft, Zap, RefreshCw, Loader2, Film, Trash2, CheckCircle, Circle, ExternalLink, Check, Pencil, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Automation, Hook, Slideshow } from '../lib/types';
import * as db from '../lib/database';
import { generateHooks, generateSlideshow } from '../services/geminiService';

export default function AutomationDetail() {
  const { id } = useParams<{ id: string }>();
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingHooks, setGeneratingHooks] = useState(false);
  const [generatingSlideshow, setGeneratingSlideshow] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<Slideshow | null>(null);
  const [editingHook, setEditingHook] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

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
      await db.createHooks(hookTexts.map((text) => ({ automation_id: automation.id, text })));
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
    setLastCreated(null);
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

      let hookImages: string[] = [];
      let bodyImages: string[] = [];

      if (automation.hook_collection_id) {
        const col = await db.getCollection(automation.hook_collection_id);
        if (col?.images) hookImages = col.images.map((i) => i.url);
      }
      if (automation.body_collection_id) {
        const col = await db.getCollection(automation.body_collection_id);
        if (col?.images) bodyImages = col.images.map((i) => i.url);
      }

      const getRandom = (imgs: string[]) => imgs.length > 0 ? imgs[Math.floor(Math.random() * imgs.length)] : '';

      const slidesWithImages = result.slides.map((slide, index) => ({
        ...slide,
        image_url: index === 0 ? getRandom(hookImages) : getRandom(bodyImages),
      }));

      const slideshow = await db.createSlideshow({
        automation_id: automation.id,
        hook_id: hook.id,
        slides: slidesWithImages,
        caption: result.caption,
      });

      await db.markHookUsed(hook.id);
      setLastCreated(slideshow);
      loadData();
    } catch (err) {
      console.error('Error generating slideshow:', err);
    } finally {
      setGeneratingSlideshow(null);
    }
  }

  async function handleDeleteHook(hookId: string) {
    try {
      await db.deleteHook(hookId);
      setHooks((prev) => prev.filter((h) => h.id !== hookId));
    } catch (err) {
      console.error('Error deleting hook:', err);
    }
  }

  async function handleDeleteSlideshow(slideshowId: string) {
    if (!confirm('Remover este carrossel?')) return;
    try {
      await db.deleteSlideshow(slideshowId);
      setSlideshows((prev) => prev.filter((s) => s.id !== slideshowId));
      if (lastCreated?.id === slideshowId) setLastCreated(null);
    } catch (err) {
      console.error('Error deleting slideshow:', err);
    }
  }

  function startEditHook(hook: Hook) {
    setEditingHook(hook.id);
    setEditText(hook.text);
  }

  async function saveEditHook(hookId: string) {
    if (!editText.trim()) return;
    try {
      await db.updateHook(hookId, editText.trim());
      setHooks((prev) => prev.map((h) => h.id === hookId ? { ...h, text: editText.trim() } : h));
    } catch (err) {
      console.error('Error updating hook:', err);
    } finally {
      setEditingHook(null);
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
        <p className="text-slate-500">Automação não encontrada.</p>
        <Link to="/automations" className="text-indigo-600 hover:underline mt-2 inline-block">Voltar</Link>
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
          <p className="text-sm text-slate-500">Hooks disponíveis</p>
          <p className="text-2xl font-bold text-slate-900">{unusedHooks.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Hooks usados</p>
          <p className="text-2xl font-bold text-slate-900">{usedHooks.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Carrosséis</p>
          <p className="text-2xl font-bold text-slate-900">{slideshows.length}</p>
        </div>
      </div>

      {/* Success banner após gerar slideshow */}
      {lastCreated && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900">Carrossel criado com sucesso!</p>
              <p className="text-sm text-emerald-700">{lastCreated.slides?.length} slides gerados</p>
            </div>
          </div>
          <Link
            to={`/editor/${lastCreated.id}`}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir no editor
          </Link>
        </div>
      )}

      {/* Hook Bank */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-500" />
            Banco de Hooks ({hooks.length} total)
          </h2>
          <button
            onClick={handleGenerateMoreHooks}
            disabled={generatingHooks}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            {generatingHooks ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Gerar 10 mais</>
            )}
          </button>
        </div>

        {hooks.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhum hook ainda. Clique em "Gerar 10 mais" para começar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {hooks.map((hook) => (
              <div
                key={hook.id}
                className={`flex items-start gap-4 p-4 ${hook.used ? 'opacity-50 bg-slate-50' : 'hover:bg-slate-50'} transition-colors`}
              >
                {hook.used ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                )}

                <div className="flex-1 min-w-0">
                  {editingHook === hook.id ? (
                    <div className="flex items-center gap-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="flex-1 px-2 py-1 border border-indigo-400 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        autoFocus
                      />
                      <button onClick={() => saveEditHook(hook.id)} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingHook(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-900 text-sm leading-relaxed">{hook.text}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!hook.used && editingHook !== hook.id && (
                    <>
                      <button
                        onClick={() => startEditHook(hook)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                        title="Editar hook"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleGenerateSlideshow(hook)}
                        disabled={generatingSlideshow === hook.id}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        {generatingSlideshow === hook.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Criando...</>
                        ) : (
                          <><Film className="w-3 h-3" /> Criar carrossel</>
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDeleteHook(hook.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
              Carrosséis gerados ({slideshows.length})
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
            {slideshows.map((show) => {
              const thumb = show.slides?.[0]?.image_url;
              return (
                <div key={show.id} className="group relative">
                  <Link
                    to={`/editor/${show.id}`}
                    className="block aspect-[4/5] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all"
                  >
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-900">
                        <Film className="w-8 h-8 text-indigo-400 opacity-60" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 rounded-b-xl">
                      <p className="text-white text-xs font-medium line-clamp-2 leading-tight">
                        {show.hook?.text || 'Carrossel'}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-400 text-[10px]">{show.slides?.length} slides</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          show.status === 'published' ? 'bg-emerald-500/80 text-white' :
                          show.status === 'scheduled' ? 'bg-blue-500/80 text-white' :
                          'bg-white/20 text-white'
                        }`}>
                          {show.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDeleteSlideshow(show.id)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
