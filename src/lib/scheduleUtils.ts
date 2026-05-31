// Distribui N posts ao longo do tempo a partir de uma data inicial, horarios do dia
// e dias da semana permitidos. Funcao pura — usada na aprovacao/agendamento em massa.

function parseTime(value: string): { hours: number; minutes: number } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export function spreadSchedule(opts: {
  startDate: string; // 'YYYY-MM-DD'
  times: string[]; // ex.: ['09:00','18:00'] (ordem respeitada)
  days?: number[]; // 0=domingo .. 6=sabado; vazio/ausente = todos os dias
  count: number;
}): string[] {
  const { startDate, count } = opts;
  const times = (opts.times || []).map(parseTime).filter((value): value is { hours: number; minutes: number } => !!value);
  const allowedDays = opts.days && opts.days.length > 0 ? new Set(opts.days) : null;

  if (count <= 0 || times.length === 0) return [];

  const base = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return [];

  const result: string[] = [];
  // Limite de seguranca para nao iterar indefinidamente (ex.: dias permitidos vazios na pratica).
  const maxDays = 366 * 3;

  for (let dayOffset = 0; dayOffset < maxDays && result.length < count; dayOffset += 1) {
    const day = new Date(base.getTime());
    day.setDate(base.getDate() + dayOffset);
    if (allowedDays && !allowedDays.has(day.getDay())) continue;

    for (const time of times) {
      if (result.length >= count) break;
      const slot = new Date(day.getTime());
      slot.setHours(time.hours, time.minutes, 0, 0);
      result.push(slot.toISOString());
    }
  }

  return result;
}
