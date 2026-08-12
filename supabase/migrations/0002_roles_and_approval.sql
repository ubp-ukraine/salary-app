/*
  # Троє учасників, апрув задач

  Було двоє й усі брали частку. Стало: Артем апрувить задачі й частки НЕ бере,
  Діана та Єгор додають задачі й ділять котел навпіл.

  Тому participants перестає означати «той, хто ділить гроші» і стає просто
  «людина в застосунку»: частка може бути 0. Хто скільки бере — видно з share,
  хто може апрувити — з can_approve. Одна таблиця замість двох: людей тут троє,
  і окремий довідник ролей був би важчим за задачу.

  Звʼязок із входом — через email: коли користувача заводять у Studio, він
  автоматично збігається зі своїм рядком, без ручного проставляння user_id.

  Апрув — відмітка стану, а не умова оплати: бонус іде в проєктні незалежно
  від нього (рішення бізнесу). Тому в розрахунку approved_at не фігурує.
*/

-- ── Учасники: частка може бути нульовою ─────────────────────────────────────

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS can_approve boolean NOT NULL DEFAULT false;

ALTER TABLE public.participants DROP CONSTRAINT IF EXISTS participants_share_check;
ALTER TABLE public.participants
  ADD CONSTRAINT participants_share_check CHECK (share >= 0 AND share <= 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_email
  ON public.participants (lower(btrim(email))) WHERE email IS NOT NULL;

COMMENT ON COLUMN public.participants.share IS
  'Частка котла. 0 — людина працює в застосунку, але грошей не ділить (апрувер).';

-- ── Апрув задачі ────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_approved ON public.tasks(approved_at);

/**
 * Апрувити може лише той, у кого can_approve. RLS тут навмисно широка (застосунок
 * внутрішній, троє людей), але саме апрув — єдина дія з розмежуванням, тож
 * стережемо її тригером, а не лише кнопкою в інтерфейсі.
 */
CREATE OR REPLACE FUNCTION public._tasks_guard_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.participants p
      JOIN auth.users u ON lower(btrim(p.email)) = lower(btrim(u.email))
      WHERE u.id = auth.uid() AND p.can_approve
    ) THEN
      RAISE EXCEPTION 'Затверджувати задачі може лише апрувер';
    END IF;
    NEW.approved_by := CASE WHEN NEW.approved_at IS NULL THEN NULL ELSE auth.uid() END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tasks_guard_approval ON public.tasks;
CREATE TRIGGER tasks_guard_approval
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public._tasks_guard_approval();

-- ── Учасники ────────────────────────────────────────────────────────────────
-- Email лишаємо порожнім: його впишуть, коли заведуть користувачів у Studio.
-- Без email людина не звʼяжеться зі своїм входом і не зможе апрувити.

INSERT INTO public.participants (name, share, can_approve)
SELECT * FROM (VALUES
  ('Артем', 0::numeric, true),
  ('Діана', 0.5::numeric, false),
  ('Єгор',  0.5::numeric, false)
) AS v(name, share, can_approve)
WHERE NOT EXISTS (SELECT 1 FROM public.participants);

NOTIFY pgrst, 'reload schema';
