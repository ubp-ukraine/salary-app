export interface Participant {
  id: string;
  user_id: string | null;
  name: string;
  /** Частка котла: у двох по 0.5. */
  share: number;
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
