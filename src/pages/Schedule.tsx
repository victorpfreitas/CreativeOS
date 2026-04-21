import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Film } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Slideshow } from '../lib/types';
import * as db from '../lib/database';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Schedule() {
  const [current, setCurrent] = useState(new Date());
  const [slideshows, setSlideshows] = useState<Slideshow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSlideshows(); }, []);

  async function loadSlideshows() {
    try { setSlideshows(await db.getSlideshows()); }
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

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Schedule</h1>
        <p className="text-slate-500 mt-1">View scheduled slideshow outputs across the month.</p>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <button onClick={() => setCurrent(new Date(year, month - 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-semibold text-slate-900">{MONTHS[month]} {year}</h2>
          <button onClick={() => setCurrent(new Date(year, month + 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-7">
          {DAYS.map((d) => <div key={d} className="p-2 text-center text-xs font-medium text-slate-500 border-b border-slate-100">{d}</div>)}
          {cells.map((day, i) => {
            const dayShows = day ? getSlideshowsForDay(day) : [];
            const isToday = day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            return (
              <div key={i} className={`min-h-[80px] p-1.5 border-b border-r border-slate-100 ${!day ? 'bg-slate-50' : ''}`}>
                {day && (
                  <>
                    <span className={`text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>{day}</span>
                    {dayShows.map((s) => (
                      <Link key={s.id} to={`/editor/${s.id}`} className="block mt-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] truncate hover:bg-indigo-200 transition-colors">
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

      {loading && <p className="text-sm text-slate-400 text-center">Loading...</p>}
    </div>
  );
}
