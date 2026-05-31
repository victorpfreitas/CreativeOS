import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Film, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ContentDraft, Project, Slideshow } from '../lib/types';
import * as db from '../lib/database';
import { PageHeader, StatusBadge } from '../components/ui/AppPrimitives';
import { getSlideshowProjectId } from '../lib/queueUtils';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Schedule() {
  const [current, setCurrent] = useState(new Date());
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [contentDrafts, setContentDrafts] = useState<ContentDraft[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSchedule(); }, []);

  async function loadSchedule() {
    try {
      const [shows, drafts, projectData] = await Promise.all([
        db.getSlideshows(),
        db.getContentDrafts(),
        db.getProjects(),
      ]);
      setSlideshows(shows);
      setContentDrafts(drafts);
      setProjects(projectData);
    } finally {
      setLoading(false);
    }
  }

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const filteredDrafts = contentDrafts.filter((draft) => projectFilter === 'all' || draft.project_id === projectFilter);
  const filteredShows = slideshows.filter((show) => projectFilter === 'all' || getSlideshowProjectId(show) === projectFilter);
  const scheduledTotal = filteredDrafts.filter((draft) => draft.scheduled_for).length + filteredShows.filter((show) => show.scheduled_for).length;

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function itemsForDay(day: number) {
    const key = dateKey(day);
    const drafts = filteredDrafts.filter((draft) => draft.scheduled_for?.startsWith(key));
    const shows = filteredShows.filter((show) => show.scheduled_for?.startsWith(key));
    return { drafts, shows };
  }

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agenda editorial"
        title="Agenda"
        description="Posts e carrosséis marcados como agendados no CreativeOS."
        icon={CalendarDays}
        actions={
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="premium-input min-w-[220px]">
            <option value="all">Todos os experts</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric label="Agendados" value={scheduledTotal} />
        <Metric label="Posts para X" value={filteredDrafts.filter((draft) => draft.scheduled_for).length} />
        <Metric label="Carrosséis" value={filteredShows.filter((show) => show.scheduled_for).length} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <button onClick={() => setCurrent(new Date(year, month - 1))} className="rounded-xl p-2 text-slate-300 hover:bg-white/[0.06]">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-black text-white">{MONTHS[month]} {year}</h2>
          <button onClick={() => setCurrent(new Date(year, month + 1))} className="rounded-xl p-2 text-slate-300 hover:bg-white/[0.06]">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {DAYS.map((day) => <div key={day} className="border-b border-white/10 p-3 text-center text-xs font-black uppercase tracking-widest text-slate-500">{day}</div>)}
          {cells.map((day, index) => {
            const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            const items = day ? itemsForDay(day) : { drafts: [], shows: [] };
            return (
              <div key={index} className={`min-h-[150px] border-b border-r border-white/10 p-2 ${!day ? 'bg-black/20' : ''}`}>
                {day && (
                  <>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{day}</span>
                    <div className="mt-2 space-y-1.5">
                      {items.drafts.map((draft) => (
                        <ScheduleItem key={draft.id} to={`/content/${draft.id}`} icon="post" title={draft.title || 'Post para X'} expert={projectMap.get(draft.project_id)?.name} />
                      ))}
                      {items.shows.map((show) => (
                        <ScheduleItem key={show.id} to={`/editor/${show.id}`} icon="carousel" title={show.slides?.[0]?.title || show.slides?.[0]?.text || 'Carrossel'} expert={projectMap.get(getSlideshowProjectId(show))?.name} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {loading && <p className="flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando agenda...</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="premium-card p-5">
      <p className="premium-label">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function ScheduleItem({ to, icon, title, expert }: { to: string; icon: 'post' | 'carousel'; title: string; expert?: string }) {
  const Icon = icon === 'post' ? FileText : Film;
  return (
    <Link to={to} className={`block rounded-xl border p-2 text-left transition hover:bg-white/[0.06] ${icon === 'post' ? 'border-emerald-400/15 bg-emerald-500/10' : 'border-indigo-400/15 bg-indigo-500/10'}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${icon === 'post' ? 'text-emerald-200' : 'text-indigo-200'}`} />
        <StatusBadge tone={icon === 'post' ? 'emerald' : 'indigo'}>{icon === 'post' ? 'X' : 'CAR'}</StatusBadge>
      </div>
      <p className="mt-1 line-clamp-2 text-xs font-bold leading-snug text-white">{title}</p>
      {expert && <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">{expert}</p>}
    </Link>
  );
}
