import { describe, it, expect } from 'vitest';
import { spreadSchedule } from '../src/lib/scheduleUtils';

describe('spreadSchedule', () => {
  it('gera a quantidade pedida de slots', () => {
    const slots = spreadSchedule({ startDate: '2026-06-01', times: ['09:00', '18:00'], count: 5 });
    expect(slots).toHaveLength(5);
  });

  it('respeita a ordem dos horários no mesmo dia', () => {
    const slots = spreadSchedule({ startDate: '2026-06-01', times: ['09:00', '18:00'], count: 2 });
    const first = new Date(slots[0]);
    const second = new Date(slots[1]);
    expect(first.getHours()).toBe(9);
    expect(second.getHours()).toBe(18);
    expect(second.getTime()).toBeGreaterThan(first.getTime());
  });

  it('avança para o próximo dia quando os horários do dia acabam', () => {
    const slots = spreadSchedule({ startDate: '2026-06-01', times: ['09:00'], count: 2 });
    const day1 = new Date(slots[0]).getDate();
    const day2 = new Date(slots[1]).getDate();
    expect(day2).toBe(day1 + 1);
  });

  it('filtra por dias da semana permitidos', () => {
    // 2026-06-01 é segunda-feira. Permitir só seg(1) e qua(3).
    const slots = spreadSchedule({ startDate: '2026-06-01', times: ['09:00'], days: [1, 3], count: 3 });
    const weekdays = slots.map((iso) => new Date(iso).getDay());
    expect(weekdays.every((day) => day === 1 || day === 3)).toBe(true);
  });

  it('retorna vazio sem horários válidos ou count <= 0', () => {
    expect(spreadSchedule({ startDate: '2026-06-01', times: [], count: 3 })).toEqual([]);
    expect(spreadSchedule({ startDate: '2026-06-01', times: ['bad'], count: 3 })).toEqual([]);
    expect(spreadSchedule({ startDate: '2026-06-01', times: ['09:00'], count: 0 })).toEqual([]);
  });

  it('produz ISO strings parseáveis', () => {
    const slots = spreadSchedule({ startDate: '2026-06-01', times: ['09:00'], count: 1 });
    expect(Number.isNaN(new Date(slots[0]).getTime())).toBe(false);
  });
});
