import { useEffect, useMemo, useState } from 'react';
import { ListTodo, Loader2, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PRIORITY_LABELS, type Priority, type Status, type Task } from '../types/db';
import { monthKey, monthLabel, uah } from '../lib/settlement';

const emptyDraft = () => ({
  title: '',
  tz: '',
  responsible: '',
  bonus: '',
  priority: 'normal' as Priority,
  deadline: '',
  status_id: '',
  settlement_month: '',
});

type Draft = ReturnType<typeof emptyDraft>;

const monthOptions = (): string[] => {
  const out: string[] = [];
  const now = new Date();
  for (let i = 1; i >= -11; i--) {
    out.push(monthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  }
  return out;
};

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const months = useMemo(monthOptions, []);

  const load = async () => {
    setLoading(true);
    const [t, s] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('statuses').select('*').order('position'),
    ]);
    if (t.error || s.error) setError((t.error ?? s.error)!.message);
    setTasks((t.data as Task[]) ?? []);
    setStatuses((s.data as Status[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const startCreate = () => {
    setEditing(null);
    setDraft({ ...emptyDraft(), status_id: statuses[0]?.id ?? '' });
    setOpen(true);
  };

  const startEdit = (t: Task) => {
    setEditing(t);
    setDraft({
      title: t.title,
      tz: t.tz ?? '',
      responsible: t.responsible ?? '',
      bonus: t.bonus ? String(t.bonus) : '',
      priority: t.priority,
      deadline: t.deadline ?? '',
      status_id: t.status_id ?? '',
      settlement_month: t.settlement_month ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) { setError('Вкажіть назву задачі'); return; }
    setSaving(true);
    setError('');
    const payload = {
      title: draft.title.trim(),
      tz: draft.tz.trim() || null,
      responsible: draft.responsible.trim() || null,
      bonus: Number(draft.bonus) || 0,
      priority: draft.priority,
      deadline: draft.deadline || null,
      status_id: draft.status_id || null,
      settlement_month: draft.settlement_month || null,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = editing
      ? await supabase.from('tasks').update(payload).eq('id', editing.id)
      : await supabase.from('tasks').insert(payload);
    if (saveError) setError(saveError.message);
    else { setOpen(false); await load(); }
    setSaving(false);
  };

  const grouped = statuses.map((s) => ({
    status: s,
    items: tasks.filter((t) => t.status_id === s.id),
  }));
  const orphans = tasks.filter((t) => !t.status_id || !statuses.some((s) => s.id === t.status_id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <ListTodo size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Задачі</h2>
            <p className="text-xs text-slate-400">
              Бонус іде в той місяць, який проставлений у задачі
            </p>
          </div>
        </div>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          <Plus size={15} /> Нова задача
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-900 bg-rose-950/60 px-3 py-2 text-sm text-rose-300">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Завантаження…
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped, ...(orphans.length ? [{ status: null, items: orphans }] : [])].map((g, i) => (
            <div key={g.status?.id ?? `orphan-${i}`} className="rounded-2xl border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: g.status?.color ?? '#64748b' }}
                  />
                  {g.status?.name ?? 'Без статусу'}
                </span>
                <span className="text-xs text-slate-400 tabular-nums">
                  {g.items.length} · {uah(g.items.reduce((a, t) => a + (Number(t.bonus) || 0), 0))}
                </span>
              </div>
              <div className="divide-y divide-slate-800">
                {g.items.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-slate-500">Порожньо</p>
                ) : (
                  g.items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => startEdit(t)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-900/60"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm text-slate-100">{t.title}</span>
                        <span className="block text-[11px] text-slate-500">
                          {t.responsible || '—'} · {PRIORITY_LABELS[t.priority]}
                          {t.deadline ? ` · до ${new Date(t.deadline).toLocaleDateString('uk-UA')}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {t.settlement_month ? monthLabel(t.settlement_month) : 'без місяця'}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-emerald-400 tabular-nums">
                        {t.bonus ? uah(Number(t.bonus)) : '—'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                {editing ? 'Задача' : 'Нова задача'}
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <Input label="Назва" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
            <Input label="ТЗ" value={draft.tz} onChange={(v) => setDraft({ ...draft, tz: v })} textarea />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Відповідальний" value={draft.responsible} onChange={(v) => setDraft({ ...draft, responsible: v })} />
              <Input label="Бонус, ₴" value={draft.bonus} onChange={(v) => setDraft({ ...draft, bonus: v.replace(/[^\d.]/g, '') })} />
              <Select
                label="Статус"
                value={draft.status_id}
                onChange={(v) => setDraft({ ...draft, status_id: v })}
                options={statuses.map((s) => ({ value: s.id, label: s.name }))}
              />
              <Select
                label="Пріоритет"
                value={draft.priority}
                onChange={(v) => setDraft({ ...draft, priority: v as Priority })}
                options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Input label="Дедлайн" value={draft.deadline} onChange={(v) => setDraft({ ...draft, deadline: v })} type="date" />
              <Select
                label="Місяць розрахунку"
                value={draft.settlement_month}
                onChange={(v) => setDraft({ ...draft, settlement_month: v })}
                options={[{ value: '', label: 'не вказано' }, ...months.map((m) => ({ value: m, label: monthLabel(m) }))]}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Скасувати
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text', textarea,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; textarea?: boolean }) {
  const cls =
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500';
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={cls} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}

function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
