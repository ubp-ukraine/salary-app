/*
  # Задачі та щомісячний розрахунок

  Перенесення однофайлового Task Tracker у нормальну схему + зарплатна частина.

  У вихідному HTML було три таблиці (tasks / statuses / comments), «оплачено»
  визначалось збігом назви статусу, а дати оплати не було взагалі — тож рознести
  бонуси по місяцях було нічим. Додаємо:
  - statuses.is_paid — ознака замість пошуку по назві;
  - tasks.settlement_month — місяць, у який іде бонус (ставиться руками);
  - settlement_months — фікси по місяцях (редаговані) і факт закриття;
  - participants — між ким ділиться котел.

  Аванс 15 числа — константа в коді (10 000 на двох), тут його немає навмисно:
  за домовленістю він не редагується.

  Застосунок внутрішній, на двох, тож RLS проста: будь-який авторизований
  працює з усіма даними. Різниця в правах тут була б імітацією безпеки.
*/

-- ── Учасники ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.participants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name       text NOT NULL,
  /** Частка котла. Двоє по 0.5; сума часток має давати 1. */
  share      numeric NOT NULL DEFAULT 0.5 CHECK (share > 0 AND share <= 1),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Статуси задач ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.statuses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#94a3b8',
  position   integer NOT NULL DEFAULT 0,
  /** Задачі в такому статусі вважаються оплаченими. */
  is_paid    boolean NOT NULL DEFAULT false,
  /** Робота завершена, але ще не оплачена. */
  is_done    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Задачі ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  tz          text,
  responsible text,
  /** Проєктні за задачу, ₴. */
  bonus       numeric NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  priority    text NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  deadline    date,
  status_id   uuid REFERENCES public.statuses(id) ON DELETE SET NULL,
  /**
   * Місяць, у який іде бонус — перше число. Заповнюється руками: у трекері
   * немає дати оплати, а прив'язка «коли закрили» не збігається з тим, за який
   * місяць рахуємось.
   */
  settlement_month date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_month ON public.tasks(settlement_month);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status_id);

-- ── Коментарі ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  body       text NOT NULL,
  author     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON public.comments(task_id);

-- ── Місяці розрахунку ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.settlement_months (
  /** Перше число місяця. */
  month          date PRIMARY KEY,
  /** Обидва фікси — на двох, не кожному. Редаговані: «за баги» діє не завжди. */
  fix_amount     numeric NOT NULL DEFAULT 25000 CHECK (fix_amount >= 0),
  bugfix_amount  numeric NOT NULL DEFAULT 25000 CHECK (bugfix_amount >= 0),
  note           text,
  closed_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.participants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_months  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['participants', 'statuses', 'tasks', 'comments', 'settlement_months']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "authenticated_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ── Стартові дані ───────────────────────────────────────────────────────────

INSERT INTO public.statuses (name, color, position, is_paid, is_done)
SELECT * FROM (VALUES
  ('Беклог',    '#94a3b8', 1, false, false),
  ('В роботі',  '#facc15', 2, false, false),
  ('Готово',    '#4ade80', 3, false, true),
  ('Оплачено',  '#7dd3fc', 4, true,  true)
) AS v(name, color, position, is_paid, is_done)
WHERE NOT EXISTS (SELECT 1 FROM public.statuses);

NOTIFY pgrst, 'reload schema';
