import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, FileText, Film } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ContentDraft, Slideshow } from '../lib/types';
import * as db from '../lib/database';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Schedule() {
  const [current, setCurrent] = useState(new Date());
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [contentDrafts, setContentDrafts] = useState<ContentDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSlideshows(); }, []);

  async function loadSlideshows() {
    try {
      const [shows, drafts] = await Promise.all([
        db.getSlideshows(),
        db.getContentDrafts(),
      ]);
      setSlideshows(shows);
      setContentDrafts(drafts);
    }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  function getSlideshowsForDay(day: number): Slideshow[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return slideshows.filter((s) => s.scheduled_for?.startsWith(dateStr));
  }

  function getContentDraftsForDay(day: number): ContentDraft[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return contentDrafts.filter((draft) => draft.scheduled_for?.startsWith(dateStr));
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-white">Agenda</h1>
        <p className="text-slate-500 mt-1">Conteudos marcados como agendados no CreativeOS.</p>
      </header>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <button onClick={() => setCurrent(new Date(year, month - 1))} className="rounded-lg p-2 text-slate-300 hover:bg-white/[0.06]"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-semibold text-white">{MONTHS[month]} {year}</h2>
          <button onClick={() => setCurrent(new Date(year, month + 1))} className="rounded-lg p-2 text-slate-300 hover:bg-white/[0.06]"><ChevronRight className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-7">
          {DAYS.map((d) => <div key={d} className="border-b border-white/10 p-2 text-center text-xs font-medium text-slate-500">{d}</div>)}
          {cells.map((day, i) => {
            const dayShows = day ? getSlideshowsForDay(day) : [];
            const dayDrafts = day ? getContentDraftsForDay(day) : [];
            const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            return (
              <div key={i} className={`min-h-[112px] border-b border-r border-white/10 p-1.5 ${!day ? 'bg-black/20' : ''}`}>
                {day && (
                  <>
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{day}</span>
                    {dayDrafts.map((draft) => (
                      <Link key={draft.id} to={`/content/${draft.id}`} className="mt-1 block truncate rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-100 transition-colors hover:bg-emerald-500/20">
                        <FileText className="mr-0.5 inline h-2.5 w-2.5" />
                        {draft.title || 'Post para X'}
                      </Link>
                    ))}
                    {dayShows.map((s) => (
                      <Link key={s.id} to={`/editor/${s.id}`} className="mt-1 block truncate rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-100 transition-colors hover:bg-indigo-500/20">
                        <Film className="w-2.5 h-2.5 inline mr-0.5" />
                        {s.hook?.text?.substring(0, 20) || 'Slideshow'}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading && <p className="text-center text-sm text-slate-400">Loading...</p>}
    </div>
  );
}
