export interface Participant {
  id: string;
  user_id: string | null;
  /** Звʼязок із входом: збігається з email користувача в auth. */
  email: string | null;
  name: string;
  /** Частка котла. 0 — людина в застосунку є, але грошей не ділить (апрувер). */
  share: number;
  /** Може затверджувати задачі. */
  can_approve: boolean;
  active: boolean;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
  is_paid: boolean;
  is_done: boolean;
}

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  tz: string | null;
  responsible: string | null;
  /** Проєктні за задачу, ₴. */
  bonus: number;
  priority: Priority;
  deadline: string | null;
  status_id: string | null;
  /** Перше число місяця, у який іде бонус. */
  settlement_month: string | null;
  /** Відмітка затвердження. На розрахунок не впливає — бонус іде в проєктні в будь-якому разі. */
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface SettlementMonth {
  month: string;
  /** Обидва фікси — на двох, не кожному. */
  fix_amount: number;
  bugfix_amount: number;
  note: string | null;
  closed_at: string | null;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Низький',
  normal: 'Звичайний',
  high: 'Високий',
  urgent: 'Терміново',
};
