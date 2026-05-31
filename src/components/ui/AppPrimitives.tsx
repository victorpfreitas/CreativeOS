import type { ComponentType, ReactNode } from 'react';

type Tone = 'slate' | 'indigo' | 'emerald' | 'amber' | 'red' | 'sky';

const toneClasses: Record<Tone, string> = {
  slate: 'border-white/10 bg-white/[0.04] text-slate-200',
  indigo: 'border-indigo-400/25 bg-indigo-500/10 text-indigo-100',
  emerald: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
  amber: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
  red: 'border-red-400/25 bg-red-500/10 text-red-100',
  sky: 'border-sky-400/25 bg-sky-500/10 text-sky-100',
};

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-indigo-300">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          {eyebrow && <p className="premium-label text-indigo-300">{eyebrow}</p>}
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatusBadge({ children, tone = 'slate' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      {Icon && <Icon className="mx-auto mb-4 h-10 w-10 text-slate-700" />}
      <h3 className="text-lg font-black text-white">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101018]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">{children}</div>
    </div>
  );
}

export function KanbanColumn({
  title,
  detail,
  count,
  children,
}: {
  title: string;
  detail?: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="min-h-[520px] rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-white">{title}</h2>
          {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
        </div>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-black text-slate-300">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function ExpertHealthCard({
  title,
  score,
  detail,
  tone,
}: {
  title: string;
  score: number;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-[11px] font-black uppercase tracking-widest opacity-80">{title}</p>
      <p className="mt-2 text-3xl font-black text-white">{score}</p>
      <p className="mt-1 text-sm leading-relaxed opacity-80">{detail}</p>
    </div>
  );
}

export function ContentCard({ children, tone = 'slate' }: { children: ReactNode; tone?: Tone }) {
  const border = tone === 'slate' ? 'border-white/10 bg-[#111]' : toneClasses[tone];
  return <article className={`rounded-2xl border p-4 shadow-xl shadow-black/10 ${border}`}>{children}</article>;
}
