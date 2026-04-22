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
    <div className="space-y-8 py-4">
      <header className="flex items-center gap-6">
        <Link to="/automations" className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white">{automation.name}</h1>
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${
              automation.status === 'active' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-white/5 border-white/10 text-slate-500'
            }`}>
              <span className={`w-2 h-2 rounded-full ${automation.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{automation.status}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">{automation.niche}</span>
            <span className="text-slate-700">•</span>
            <span className="text-sm text-slate-500">{automation.project?.name}</span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="premium-card p-6 flex flex-col justify-between">
          <p className="premium-label">Hooks Disponíveis</p>
          <p className="text-3xl font-bold text-white font-space mt-2">{unusedHooks.length}</p>
        </div>
        <div className="premium-card p-6 flex flex-col justify-between">
          <p className="premium-label">Total de Carrosséis</p>
          <p className="text-3xl font-bold text-white font-space mt-2">{slideshows.length}</p>
        </div>
        <div className="premium-card p-6 flex flex-col justify-between border-indigo-500/10 bg-indigo-500/[0.02]">
          <p className="premium-label !text-indigo-400">Eficiência</p>
          <p className="text-3xl font-bold text-white font-space mt-2">
            {hooks.length > 0 ? Math.round((usedHooks.length / hooks.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Success banner */}
      {lastCreated && (
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-6 py-5 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
              <Check className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-lg">Carrossel criado com sucesso!</p>
              <p className="text-emerald-400/80 text-sm">{lastCreated.slides?.length} slides gerados automaticamente.</p>
            </div>
          </div>
          <Link
            to={`/editor/${lastCreated.id}`}
            className="premium-button-primary !bg-emerald-600 hover:!bg-emerald-500 flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir no Editor
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Hook Bank */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" />
              Banco de Hooks
            </h2>
            <button
              onClick={handleGenerateMoreHooks}
              disabled={generatingHooks}
              className="premium-button-secondary !py-2 !px-4 text-xs flex items-center gap-2"
            >
              {generatingHooks ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
              ) : (
                <><RefreshCw className="w-3.5 h-3.5" /> Gerar +10 Hooks</>
              )}
            </button>
          </div>

          <div className="premium-card overflow-hidden">
            {hooks.length === 0 ? (
              <div className="p-16 text-center">
                <Zap className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                <p className="text-slate-500">Nenhum hook gerado ainda para esta estratégia.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {hooks.map((hook) => (
                  <div
                    key={hook.id}
                    className={`flex items-start gap-4 p-5 ${hook.used ? 'opacity-40 grayscale bg-white/[0.01]' : 'hover:bg-white/[0.02]'} transition-all group`}
                  >
                    <div className="mt-1 flex-shrink-0">
                      {hook.used ? (
                        <div className="p-1 bg-emerald-500/20 rounded-full">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 border-2 border-slate-700 rounded-full group-hover:border-indigo-500/50 transition-colors" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {editingHook === hook.id ? (
                        <div className="flex items-start gap-3">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            className="premium-input w-full text-sm leading-relaxed"
                            autoFocus
                          />
                          <div className="flex flex-col gap-2">
                            <button onClick={() => saveEditHook(hook.id)} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingHook(null)} className="p-2 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-white text-sm leading-relaxed font-medium">{hook.text}</p>
                      )}
                    </div>

                    {!hook.used && editingHook !== hook.id && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => startEditHook(hook)}
                          className="p-2 hover:bg-white/10 rounded-xl transition-all text-slate-500 hover:text-white"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleGenerateSlideshow(hook)}
                          disabled={generatingSlideshow === hook.id}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap"
                        >
                          {generatingSlideshow === hook.id ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Criando...</>
                          ) : (
                            <><Film className="w-3.5 h-3.5" /> Criar Carrossel</>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteHook(hook.id)}
                          className="p-2 hover:bg-red-500/10 rounded-xl transition-all text-slate-600 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Slideshows Grid */}
        <div className="lg:col-span-5 space-y-4">
          <div className="px-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-emerald-400" />
              Carrosséis Gerados
            </h2>
          </div>

          {slideshows.length === 0 ? (
            <div className="premium-card p-12 text-center">
              <Film className="w-12 h-12 text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">Os carrosséis criados aparecerão aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {slideshows.map((show) => {
                const thumb = show.slides?.[0]?.image_url;
                return (
                  <div key={show.id} className="group relative">
                    <Link
                      to={`/editor/${show.id}`}
                      className="premium-card block aspect-[4/5] overflow-hidden hover:border-indigo-500/30 transition-all shadow-2xl shadow-black/40"
                    >
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#111] to-[#050505]">
                          <Film className="w-10 h-10 text-white/10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                      
                      <div className="absolute inset-0 p-4 flex flex-col justify-end">
                        <p className="text-white text-xs font-bold line-clamp-3 leading-relaxed mb-3 group-hover:text-indigo-300 transition-colors">
                          {show.hook?.text ? (show.hook.text.length > 80 ? show.hook.text.substring(0, 80) + '...' : show.hook.text) : 'Untitled Carousel'}
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{show.slides?.length || 0} Slides</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                            show.status === 'published' ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                            show.status === 'scheduled' ? 'bg-indigo-500 text-white' :
                            'bg-white/20 text-white'
                          }`}>
                            {show.status || 'Draft'}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => handleDeleteSlideshow(show.id)}
                      className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-red-600 backdrop-blur-md text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all z-10"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
