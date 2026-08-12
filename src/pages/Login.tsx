import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/** Вхід за email і паролем. Ніяких налаштувань підключення — інстанція зашита на збірці. */
export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError((err as Error).message || 'Не вдалося увійти');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <KeyRound size={20} />
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-100">Задачі та розрахунок</h1>
            <p className="text-xs text-slate-400">Вхід для своїх</p>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-rose-900 bg-rose-950/60 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {busy ? 'Заходимо…' : 'Увійти'}
        </button>
      </form>
    </div>
  );
}
