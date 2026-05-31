import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, Check, Copy, FileText, Film, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ContentDraft, Project, Slideshow } from '../lib/types';
import * as db from '../lib/database';
import { getSlideshowProjectId } from '../lib/queueUtils';
import { spreadSchedule } from '../lib/scheduleUtils';

type BoardStatus = 'review' | 'approved' | 'scheduled';
type BoardItem =
  | { kind: 'content'; id: string; status: BoardStatus; draft: ContentDraft }
  | { kind: 'carousel'; id: string; status: BoardStatus; slideshow: Slideshow };

const columns: Array<{ id: BoardStatus; label: string; detail: string }> = [
  { id: 'review', label: 'Para revisar', detail: 'Drafts novos esperando decisao.' },
  { id: 'approved', label: 'Aprovado', detail: 'Aceitos, ainda sem data.' },
  { id: 'scheduled', label: 'Agendado', detail: 'Com data no CreativeOS.' },
];

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function getCarouselStatus(slideshow: Slideshow): BoardStatus | null {
  if (slideshow.review_state === 'rejected') return null;
  if (slideshow.status === 'scheduled' || slideshow.scheduled_for) return 'scheduled';
  if (slideshow.review_state === 'approved') return 'approved';
  if (slideshow.review_state) return 'review';
  return null;
}

function getItemDate(item: BoardItem) {
  return item.kind === 'content' ? item.draft.created_at : item.slideshow.created_at;
}

function getItemCopy(item: BoardItem) {
  if (item.kind === 'carousel') return item.slideshow.caption || item.slideshow.slides?.[0]?.title || 'Carrossel';
  if (item.draft.format === 'x_thread') {
    return item.draft.thread_items.map((text, index) => `${index + 1}/${item.draft.thread_items.length}\n${text}`).join('\n\n');
  }
  return item.draft.body;
}

export default function DraftQueue() {
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState('all');
  const [scheduleInputs, setScheduleInputs] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStartDate, setBulkStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bulkTimes, setBulkTimes] = useState('09:00, 18:00');
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [contentDrafts, carouselDrafts, projectData] = await Promise.all([
          db.getContentDrafts(),
          db.getSlideshows(),
          db.getProjects(),
        ]);
        setDrafts(contentDrafts);
        setSlideshows(carouselDrafts);
        setProjects(projectData);
        const nextScheduleInputs: Record<string, string> = {};
        contentDrafts.forEach((draft) => {
          if (draft.scheduled_for) nextScheduleInputs[`content:${draft.id}`] = toDatetimeLocal(draft.scheduled_for);
        });
        carouselDrafts.forEach((slideshow) => {
          if (slideshow.scheduled_for) nextScheduleInputs[`carousel:${slideshow.id}`] = toDatetimeLocal(slideshow.scheduled_for);
        });
        setScheduleInputs(nextScheduleInputs);
      } catch (error) {
        console.error('Error loading content board:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const boardItems = useMemo<BoardItem[]>(() => {
    const contentItems: BoardItem[] = drafts.map((draft) => ({
      kind: 'content',
      id: `content:${draft.id}`,
      status: draft.status,
      draft,
    }));

    const carouselItems = slideshows
      .map<BoardItem | null>((slideshow) => {
        const status = getCarouselStatus(slideshow);
        return status ? { kind: 'carousel' as const, id: `carousel:${slideshow.id}`, status, slideshow } : null;
      })
      .filter((item): item is BoardItem => !!item);

    return [...contentItems, ...carouselItems]
      .filter((item) => {
        if (projectFilter === 'all') return true;
        if (item.kind === 'content') return item.draft.project_id === projectFilter;
        return getSlideshowProjectId(item.slideshow) === projectFilter;
      })
      .sort((a, b) => (getItemDate(b) || '').localeCompare(getItemDate(a) || ''));
  }, [drafts, projectFilter, slideshows]);

  async function copyItem(item: BoardItem) {
    await navigator.clipboard.writeText(getItemCopy(item));
    setNotice('Conteudo copiado.');
  }

  async function moveContentDraft(draft: ContentDraft, status: BoardStatus) {
    setActingId(`content:${draft.id}`);
    try {
      const updated = await db.updateContentDraft(draft.id, {
        status,
        scheduled_for: status === 'scheduled'
          ? fromDatetimeLocal(scheduleInputs[`content:${draft.id}`] || '')
          : draft.scheduled_for,
      });
      setDrafts((prev) => prev.map((item) => item.id === draft.id ? { ...updated, project: item.project } : item));
      await db.createVoiceLearningEvent({
        project_id: draft.project_id,
        draft_id: draft.id,
        event_type: status === 'scheduled' ? 'scheduled' : 'approved',
        format: draft.format,
        after_text: getItemCopy({ kind: 'content', id: `content:${draft.id}`, status, draft }),
        instruction: status === 'scheduled' ? 'Draft agendado pelo board.' : 'Draft aprovado pelo board.',
      });
    } finally {
      setActingId(null);
    }
  }

  async function moveCarousel(slideshow: Slideshow, status: BoardStatus) {
    setActingId(`carousel:${slideshow.id}`);
    try {
      const updated = await db.updateSlideshow(slideshow.id, {
        review_state: status === 'review' ? 'reviewing' : 'approved',
        status: status === 'scheduled' ? 'scheduled' : 'reviewing',
        scheduled_for: status === 'scheduled'
          ? fromDatetimeLocal(scheduleInputs[`carousel:${slideshow.id}`] || '')
          : null,
      });
      setSlideshows((prev) => prev.map((item) => item.id === slideshow.id ? { ...item, ...updated } : item));
    } finally {
      setActingId(null);
    }
  }

  async function requestNewCarouselVersion(slideshow: Slideshow) {
    setActingId(`carousel:${slideshow.id}`);
    try {
      const updated = await db.updateSlideshow(slideshow.id, { review_state: 'needs_regeneration' });
      setSlideshows((prev) => prev.map((item) => item.id === slideshow.id ? { ...item, ...updated } : item));
    } finally {
      setActingId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Drafts de texto selecionados (apenas kind 'content'), na ordem do board.
  const selectedDrafts = useMemo(
    () => boardItems
      .filter((item): item is Extract<BoardItem, { kind: 'content' }> => item.kind === 'content' && selectedIds.has(item.id))
      .map((item) => item.draft),
    [boardItems, selectedIds]
  );

  async function bulkApprove() {
    const targets = selectedDrafts.filter((draft) => draft.status === 'review');
    if (targets.length === 0) {
      setNotice('Nenhum draft em "Para revisar" selecionado.');
      return;
    }
    setBulkBusy(true);
    try {
      for (const draft of targets) {
        await moveContentDraft(draft, 'approved');
      }
      setNotice(`${targets.length} draft(s) aprovado(s).`);
      clearSelection();
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkSchedule() {
    const targets = selectedDrafts.filter((draft) => draft.status !== 'scheduled');
    if (targets.length === 0) {
      setNotice('Selecione drafts ainda não agendados.');
      return;
    }
    const times = bulkTimes.split(',').map((value) => value.trim()).filter(Boolean);
    const slots = spreadSchedule({ startDate: bulkStartDate, times, count: targets.length });
    if (slots.length < targets.length) {
      setNotice('Informe uma data e ao menos um horário válido (ex.: 09:00, 18:00).');
      return;
    }
    setBulkBusy(true);
    try {
      for (let index = 0; index < targets.length; index += 1) {
        const draft = targets[index];
        const scheduledFor = slots[index];
        const updated = await db.updateContentDraft(draft.id, { status: 'scheduled', scheduled_for: scheduledFor });
        setDrafts((prev) => prev.map((item) => item.id === draft.id ? { ...updated, project: item.project } : item));
        setScheduleInputs((prev) => ({ ...prev, [`content:${draft.id}`]: toDatetimeLocal(scheduledFor) }));
        await db.createVoiceLearningEvent({
          project_id: draft.project_id,
          draft_id: draft.id,
          event_type: 'scheduled',
          format: draft.format,
          instruction: 'Draft agendado em massa pelo board.',
        });
      }
      setNotice(`${targets.length} draft(s) agendado(s).`);
      clearSelection();
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-indigo-300">
            <Sparkles className="h-4 w-4" /> Content Machine
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">Content Board</h1>
          <p className="mt-1 text-sm text-slate-500">Para revisar, aprovado e agendado.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="premium-input min-w-[220px] appearance-none">
            <option value="all">Todos os experts</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <Link to="/create" className="premium-button-primary inline-flex items-center justify-center gap-2">
            Criar conteudo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {notice && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</div>}

      {selectedDrafts.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="premium-label">{selectedDrafts.length} selecionado(s)</p>
              <button onClick={clearSelection} className="mt-1 text-xs font-bold uppercase tracking-widest text-indigo-200 hover:text-white">Limpar seleção</button>
            </div>
            <div>
              <label className="premium-label">A partir de</label>
              <input type="date" value={bulkStartDate} onChange={(event) => setBulkStartDate(event.target.value)} className="premium-input mt-1 block" />
            </div>
            <div>
              <label className="premium-label">Horários (vírgula)</label>
              <input value={bulkTimes} onChange={(event) => setBulkTimes(event.target.value)} placeholder="09:00, 18:00" className="premium-input mt-1 block" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={bulkApprove} disabled={bulkBusy} className="premium-button-secondary flex items-center gap-2 disabled:opacity-50">
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Aprovar selecionados
            </button>
            <button onClick={bulkSchedule} disabled={bulkBusy} className="premium-button-primary flex items-center gap-2 disabled:opacity-50">
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Agendar selecionados
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {columns.map((column) => {
          const items = boardItems.filter((item) => item.status === column.id);
          return (
            <section key={column.id} className="min-h-[520px] rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white">{column.label}</h2>
                  <p className="mt-1 text-sm text-slate-500">{column.detail}</p>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-black text-slate-300">{items.length}</span>
              </div>

              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-600">
                    Sem cards aqui.
                  </div>
                ) : items.map((item) => (
                  <BoardCard
                    key={item.id}
                    item={item}
                    acting={actingId === item.id}
                    project={item.kind === 'content'
                      ? item.draft.project || projectMap.get(item.draft.project_id)
                      : item.slideshow.automation?.project || projectMap.get(getSlideshowProjectId(item.slideshow))}
                    scheduleValue={scheduleInputs[item.id] || ''}
                    onScheduleChange={(value) => setScheduleInputs((prev) => ({ ...prev, [item.id]: value }))}
                    selected={selectedIds.has(item.id)}
                    onToggleSelect={item.kind === 'content' ? () => toggleSelect(item.id) : undefined}
                    onCopy={() => copyItem(item)}
                    onApprove={() => item.kind === 'content'
                      ? moveContentDraft(item.draft, 'approved')
                      : moveCarousel(item.slideshow, 'approved')}
                    onSchedule={() => item.kind === 'content'
                      ? moveContentDraft(item.draft, 'scheduled')
                      : moveCarousel(item.slideshow, 'scheduled')}
                    onBack={() => item.kind === 'content'
                      ? moveContentDraft(item.draft, item.status === 'scheduled' ? 'approved' : 'review')
                      : moveCarousel(item.slideshow, item.status === 'scheduled' ? 'approved' : 'review')}
                    onRequestNewVersion={() => item.kind === 'content'
                      ? undefined
                      : requestNewCarouselVersion(item.slideshow)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({
  item,
  acting,
  project,
  scheduleValue,
  onScheduleChange,
  selected,
  onToggleSelect,
  onCopy,
  onApprove,
  onSchedule,
  onBack,
  onRequestNewVersion,
}: {
  item: BoardItem;
  acting: boolean;
  project?: Project;
  scheduleValue: string;
  onScheduleChange: (value: string) => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  onCopy: () => void;
  onApprove: () => void;
  onSchedule: () => void;
  onBack: () => void;
  onRequestNewVersion: () => void;
}) {
  const isContent = item.kind === 'content';
  const title = isContent
    ? item.draft.title || item.draft.hook
    : item.slideshow.slides?.[0]?.title || item.slideshow.slides?.[0]?.text || 'Carrossel';
  const detail = isContent
    ? item.draft.format === 'x_thread'
      ? item.draft.thread_items[0] || item.draft.hook
      : item.draft.body
    : item.slideshow.caption || item.slideshow.content_angle || '';
  const editUrl = isContent ? `/content/${item.draft.id}` : `/editor/${item.slideshow.id}`;
  const formatLabel = isContent
    ? item.draft.format === 'x_thread' ? 'Thread para X' : 'Post para X'
    : 'Carrossel';
  const Icon = isContent ? FileText : Film;

  return (
    <article className="rounded-2xl border border-white/10 bg-[#111] p-4 shadow-xl shadow-black/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-300">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={onToggleSelect}
              onClick={(event) => event.stopPropagation()}
              className="h-3.5 w-3.5 accent-indigo-500"
              title="Selecionar para ação em massa"
            />
          )}
          <Icon className="h-3.5 w-3.5" /> {formatLabel}
        </span>
        {item.status === 'scheduled' && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200">
            Agendado
          </span>
        )}
      </div>

      <h3 className="text-base font-bold leading-tight text-white">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{detail || 'Sem texto salvo.'}</p>

      {isContent && (
        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          {item.draft.research_thesis && <PreviewLine label="Tese" value={item.draft.research_thesis} />}
          {item.draft.source_title && <PreviewLine label="Fonte" value={item.draft.source_title} />}
          {item.draft.voice_review_notes && <PreviewLine label="Voz" value={item.draft.voice_review_notes} />}
          {typeof item.draft.voice_review_score === 'number' && item.draft.voice_review_score > 0 && (
            <PreviewLine label="Score de voz" value={`${item.draft.voice_review_score}/100`} />
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Fact label="Expert" value={project?.name || 'Sem expert'} />
        <Fact label="Criado" value={new Date(getItemDate(item)).toLocaleDateString('pt-BR')} />
      </div>

      <div className="mt-4 space-y-2">
        <input
          type="datetime-local"
          value={scheduleValue}
          onChange={(event) => onScheduleChange(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <Link to={editUrl} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white transition hover:bg-white/[0.06]">
            Editar
          </Link>
          <button onClick={onCopy} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white transition hover:bg-white/[0.06]">
            <Copy className="mr-1 inline h-3.5 w-3.5" /> Copiar
          </button>
          {item.status === 'review' && (
            <button onClick={onApprove} disabled={acting} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50">
              {acting ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 inline h-3.5 w-3.5" />} Aprovar
            </button>
          )}
          {item.status !== 'scheduled' && (
            <button onClick={onSchedule} disabled={acting || !scheduleValue} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50">
              <CalendarClock className="mr-1 inline h-3.5 w-3.5" /> Agendar
            </button>
          )}
          {item.status !== 'review' && (
            <button onClick={onBack} disabled={acting} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50">
              Voltar
            </button>
          )}
          {item.kind === 'content' ? (
            <Link to={editUrl} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-500/20">
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Nova versao
            </Link>
          ) : (
            <button onClick={onRequestNewVersion} disabled={acting} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50">
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Nova versao
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-200">{value}</p>
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">{value}</p>
    </div>
  );
}
