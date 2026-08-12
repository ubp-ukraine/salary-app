import { useEffect, useMemo, useState } from 'react';
import { Calculator, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Participant, SettlementMonth, Status, Task } from '../types/db';
import {
  ADVANCE_TOTAL,
  computeSettlement,
  monthKey,
  monthLabel,
  uah,
  unassignedBonus,
} from '../lib/settlement';

const DEFAULT_MONTH: SettlementMonth = {
  month: '',
  fix_amount: 25000,
  bugfix_amount: 25000,
  note: null,
  closed_at: null,
};

/** Останні 12 місяців, найновіший зверху. */
function recentMonths(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return out;
}

export function Settlement() {
  const months = useMemo(recentMonths, []);
  const [month, setMonth] = useState(months[0]);
  const [config, setConfig] = useState<SettlementMonth>({ ...DEFAULT_MONTH, month: months[0] });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [t, s, p, m] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('statuses').select('*').order('position'),
        supabase.from('participants').select('*').order('created_at'),
        supabase.from('settlement_months').select('*').eq('month', month).maybeSingle(),
      ]);
      if (cancelled) return;
      const failed = t.error || s.error || p.error || m.error;
      if (failed) setError(failed.message);
      setTasks((t.data as Task[]) ?? []);
      setStatuses((s.data as Status[]) ?? []);
      setParticipants((p.data as Participant[]) ?? []);
      setConfig((m.data as SettlementMonth) ?? { ...DEFAULT_MONTH, month });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [month]);

  const settlement = useMemo(
    () => computeSettlement(month, config, tasks, participants),
    [month, config, tasks, participants],
  );
  const pending = useMemo(() => unassignedBonus(tasks, statuses), [tasks, statuses]);

  const saveConfig = async (patch: Partial<SettlementMonth>) => {
    const next = { ...config, ...patch, month };
    setConfig(next);
    setSaving(true);
    const { error: upsertError } = await supabase
      .from('settlement_months')
      .upsert({
        month,
        fix_amount: next.fix_amount,
        bugfix_amount: next.bugfix_amount,
        note: next.note,
      });
    if (upsertError) setError(upsertError.message);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Calculator size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Розрахунок за місяць</h2>
            <p className="text-xs text-slate-400">
              Фікси й проєктні складаються в спільний котел і діляться за частками
            </p>
          </div>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        >
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-900 bg-rose-950/60 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Рахуємо…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Фікс, ₴ (на двох)"
              value={config.fix_amount}
              onCommit={(v) => void saveConfig({ fix_amount: v })}
            />
            <Field
              label="Фікс за баги, ₴ (на двох)"
              value={config.bugfix_amount}
              onCommit={(v) => void saveConfig({ bugfix_amount: v })}
            />
            <Stat label={`Проєктні (${settlement.taskCount} задач)`} value={uah(settlement.projects)} />
            <Stat label="Разом за місяць" value={uah(settlement.total)} accent />
          </div>

          {pending > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-900 bg-amber-950/40 px-3 py-2.5 text-sm text-amber-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                Є оплачені задачі на {uah(pending)} без місяця розрахунку — вони не потрапили
                в жоден місяць. Проставте їм «Місяць розрахунку» у списку задач.
              </span>
            </div>
          )}

          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Учасник</th>
                  <th className="px-4 py-2.5 text-right font-medium">Частка</th>
                  <th className="px-4 py-2.5 text-right font-medium">15 числа</th>
                  <th className="px-4 py-2.5 text-right font-medium">В кінці місяця</th>
                  <th className="px-4 py-2.5 text-right font-medium">Разом</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {settlement.payouts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      Немає учасників — додайте їх у таблиці participants.
                    </td>
                  </tr>
                ) : (
                  settlement.payouts.map((p) => (
                    <tr key={p.participant.id}>
                      <td className="px-4 py-2.5 text-slate-200">{p.participant.name}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">
                        {Math.round(p.share * 100)}%
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{uah(p.advance)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{uah(p.final)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-100 tabular-nums">
                        {uah(p.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-900/60 font-semibold text-slate-200">
                <tr>
                  <td className="px-4 py-2.5">Разом</td>
                  <td />
                  <td className="px-4 py-2.5 text-right tabular-nums">{uah(settlement.advanceTotal)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{uah(settlement.finalTotal)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{uah(settlement.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-slate-500">
            Аванс 15 числа — {uah(ADVANCE_TOTAL)} на двох, не редагується.
            {saving && ' Зберігаємо…'}
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${accent ? 'border-emerald-800 bg-emerald-950/40' : 'border-slate-800 bg-slate-900'}`}>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${accent ? 'text-emerald-300' : 'text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}

/** Число, яке зберігається на blur — щоб не писати в базу на кожну цифру. */
function Field({
  label, value, onCommit,
}: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="block rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <span className="block text-[11px] text-slate-400">{label}</span>
      <input
        value={text}
        inputMode="numeric"
        onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ''))}
        onBlur={() => {
          const n = Number(text) || 0;
          if (n !== value) onCommit(n);
        }}
        className="w-full bg-transparent text-lg font-semibold text-slate-100 tabular-nums outline-none"
      />
    </label>
  );
}
