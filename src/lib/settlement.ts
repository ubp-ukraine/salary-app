import type { Participant, SettlementMonth, Status, Task } from '../types/db';

/**
 * Щомісячний розрахунок.
 *
 * Котел спільний: обидва фікси й проєктні складаються, і вже підсумок ділиться
 * за частками. Тому 25 000 фіксу — це 12 500 на людину, а не 25 000 кожному.
 *
 * Аванс — константа за домовленістю, не редагується: 15 числа виплачується
 * 10 000 на двох. Решта — в кінці місяця.
 */

/** Аванс 15 числа, ₴ на двох. */
export const ADVANCE_TOTAL = 10_000;

export interface ParticipantPayout {
  participant: Participant;
  share: number;
  /** Уся частка за місяць. */
  total: number;
  /** Аванс 15 числа. */
  advance: number;
  /** Решта в кінці місяця. */
  final: number;
}

export interface Settlement {
  month: string;
  fix: number;
  bugfix: number;
  projects: number;
  /** Разом за місяць на двох. */
  total: number;
  advanceTotal: number;
  finalTotal: number;
  payouts: ParticipantPayout[];
  /** Задачі, що потрапили в місяць. */
  taskCount: number;
}

/** Перше число місяця у форматі yyyy-mm-dd. */
export const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

export const monthLabel = (key: string): string => {
  const [y, m] = key.split('-');
  const names = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
  ];
  return `${names[Number(m) - 1] ?? m} ${y}`;
};

export const uah = (n: number): string =>
  `${Math.round(n).toLocaleString('uk-UA')} ₴`;

/**
 * Проєктні за місяць — сума бонусів задач, у яких проставлений цей місяць.
 * Статус не фільтруємо: місяць проставляють руками саме тоді, коли задачу
 * беруть у розрахунок, тож він і є ознакою.
 */
export function projectsTotal(tasks: Task[], month: string): number {
  return tasks
    .filter((t) => t.settlement_month === month)
    .reduce((sum, t) => sum + (Number(t.bonus) || 0), 0);
}

export function computeSettlement(
  month: string,
  config: Pick<SettlementMonth, 'fix_amount' | 'bugfix_amount'>,
  tasks: Task[],
  participants: Participant[],
): Settlement {
  const monthTasks = tasks.filter((t) => t.settlement_month === month);
  const projects = monthTasks.reduce((sum, t) => sum + (Number(t.bonus) || 0), 0);
  const fix = Number(config.fix_amount) || 0;
  const bugfix = Number(config.bugfix_amount) || 0;
  const total = fix + bugfix + projects;

  const active = participants.filter((p) => p.active);
  // Частки нормалізуємо: якщо в базі не рівно 1 (когось вимкнули), котел усе
  // одно має розійтись повністю, а не «загубити» решту.
  const shareSum = active.reduce((s, p) => s + (Number(p.share) || 0), 0) || 1;
  const advanceTotal = Math.min(ADVANCE_TOTAL, total);

  const payouts: ParticipantPayout[] = active.map((p) => {
    const share = (Number(p.share) || 0) / shareSum;
    const personTotal = total * share;
    const advance = advanceTotal * share;
    return {
      participant: p,
      share,
      total: personTotal,
      advance,
      final: personTotal - advance,
    };
  });

  return {
    month,
    fix,
    bugfix,
    projects,
    total,
    advanceTotal,
    finalTotal: total - advanceTotal,
    payouts,
    taskCount: monthTasks.length,
  };
}

/** Скільки бонусів ще не рознесено по місяцях — щоб не загубити оплачені задачі. */
export function unassignedBonus(tasks: Task[], statuses: Status[]): number {
  const paidIds = new Set(statuses.filter((s) => s.is_paid).map((s) => s.id));
  return tasks
    .filter((t) => !t.settlement_month && t.status_id && paidIds.has(t.status_id))
    .reduce((sum, t) => sum + (Number(t.bonus) || 0), 0);
}
