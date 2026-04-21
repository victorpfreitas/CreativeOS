import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Loader2, Sparkles, Film, Check, RefreshCw } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import type { Project, ContentPlanItem, Automation } from '../lib/types';
import * as db from '../lib/database';
import { generateWeeklyPlan, generateSlideshow } from '../services/geminiService';

const DAYS: Array<{ key: ContentPlanItem['day']; label: string; short: string }> = [
  { key: 'mon', label: 'Segunda', short: 'Seg' },
  { key: 'tue', label: 'Terça', short: 'Ter' },
  { key: 'wed', label: 'Quarta', short: 'Qua' },
  { key: 'thu', label: 'Quinta', short: 'Qui' },
  { key: 'fri', label: 'Sexta', short: 'Sex' },
  { key: 'sat', label: 'Sábado', short: 'Sáb' },
  { key: 'sun', label: 'Domingo', short: 'Dom' },
];

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function WeeklyPlanning() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [items, setItems] = useState<ContentPlanItem[]>([]);
  const [weekStart, setWeekStart] = useState(getMondayOfCurrentWeek());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSlideshow, setGeneratingSlideshow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDays, setSelectedDays] = useState<ContentPlanItem['day'][]>(['mon', 'wed', 'fri']);

  useEffect(() => { if (id) load(); }, [id]);
  useEffect(() => { if (id && project) loadPlan(); }, [weekStart]);

  async function load() {
    try {
      const [proj, autos] = await Promise.all([
        db.getProject(id!),
        db.getAutomationsByProject(id!),
      ]);
      setProject(proj);
      setAutomations(autos);
      const plan = await db.getContentPlan(id!, weekStart);
      if (plan) setItems(plan.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlan() {
    const plan = await db.getContentPlan(id!, weekStart);
    setItems(plan ? plan.items : []);
  }

  function toggleDay(day: ContentPlanItem['day']) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleGenerate() {
    if (!project || automations.length === 0) return;
    setGenerating(true);
    try {
      const generated = await generateWeeklyPlan({
        projectName: project.name,
        knowledgeBase: project.knowledge_base,
        automations: automations.map((a) => ({ id: a.id, name: a.name, niche: a.niche })),
        weekDays: selectedDays,
      });
      setItems(generated);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSavePlan() {
    if (!project || items.length === 0) return;
    setSaving(true);
    try {
      await db.upsertContentPlan({ project_id: project.id, week_start: weekStart, items });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateSlideshow(item: ContentPlanItem) {
    const automation = automations.find((a) => a.id === item.automation_id) ?? automations[0];
    if (!automation) return;

    setGeneratingSlideshow(item.day);
    try {
      const result = await generateSlideshow({
        hookText: item.hook_suggestion,
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
      const slidesWithImages = result.slides.map((s, i) => ({
        ...s,
        image_url: i === 0 ? getRandom(hookImages) : getRandom(bodyImages),
      }));

      const slideshow = await db.createSlideshow({
        automation_id: automation.id,
        slides: slidesWithImages,
        caption: result.caption,
      });

      setItems((prev) => prev.map((p) => p.day === item.day ? { ...p, slideshow_id: slideshow.id, status: 'generated' } : p));
      navigate(`/editor/${slideshow.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingSlideshow(null);
    }
  }

  function updateItem(day: ContentPlanItem['day'], field: 'topic' | 'hook_suggestion', value: string) {
    setItems((prev) => prev.map((p) => p.day === day ? { ...p, [field]: value } : p));
  }

  const weekLabel = (() => {
    const start = new Date(weekStart + 'T00:00:00');
    const end = new Date(weekStart + 'T00:00:00');
    end.setDate(end.getDate() + 6);
    return `${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`;
  })();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="flex items-center gap-3">
        <Link to={`/projects/${id}`} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-purple-500" />
            Planejamento Semanal
          </h1>
          <p className="text-sm text-slate-500">{project?.name}</p>
        </div>
      </header>

      {/* Week nav + config */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              ← Semana anterior
            </button>
            <span className="font-semibold text-slate-900">{weekLabel}</span>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Próxima semana →
            </button>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={handleSavePlan}
                disabled={saving}
                className="px-4 py-2 border border-indigo-300 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-50 transition-colors"
              >
                {saving ? 'Salvando...' : 'Salvar plano'}
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating || automations.length === 0}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Gerando plano...' : items.length > 0 ? 'Regerar plano' : 'Gerar plano com IA'}
            </button>
          </div>
        </div>

        {/* Day selector */}
        <div>
          <p className="text-xs text-slate-500 mb-2 font-medium">Dias de postagem</p>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d) => (
              <button
                key={d.key}
                onClick={() => toggleDay(d.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  selectedDays.includes(d.key)
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {d.short}
              </button>
            ))}
          </div>
        </div>

        {automations.length === 0 && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Este projeto não tem automações. <Link to={`/automations/new`} className="font-semibold underline">Criar automação</Link> para gerar carrosséis a partir do plano.
          </div>
        )}
      </div>

      {/* Plan grid */}
      {items.length > 0 ? (
        <div className="space-y-3">
          {DAYS.filter((d) => items.some((i) => i.day === d.key)).map((d) => {
            const item = items.find((i) => i.day === d.key)!;
            const automation = automations.find((a) => a.id === item.automation_id);
            const isGenerating = generatingSlideshow === item.day;

            return (
              <div key={d.key} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <p className="text-xs font-bold text-purple-700 uppercase">{d.short}</p>
                    </div>
                    {item.status === 'generated' && (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Gerado
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500">Tópico</label>
                      <input
                        value={item.topic}
                        onChange={(e) => updateItem(item.day, 'topic', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500">Hook sugerido</label>
                      <textarea
                        rows={2}
                        value={item.hook_suggestion}
                        onChange={(e) => updateItem(item.day, 'hook_suggestion', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                      />
                    </div>
                    {automation && (
                      <p className="text-xs text-slate-400">
                        Automação: <span className="text-slate-600 font-medium">{automation.name}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleGenerateSlideshow(item)}
                      disabled={isGenerating}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
                      {isGenerating ? 'Criando...' : 'Criar carrossel'}
                    </button>
                    {item.slideshow_id && (
                      <Link
                        to={`/editor/${item.slideshow_id}`}
                        className="text-center text-xs text-indigo-600 hover:underline font-medium"
                      >
                        Abrir editor
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum plano para esta semana</p>
          <p className="text-sm mt-1">Selecione os dias de postagem e clique em "Gerar plano com IA"</p>
        </div>
      )}
    </div>
  );
}
