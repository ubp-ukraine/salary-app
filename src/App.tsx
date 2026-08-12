import { useState } from 'react';
import { Calculator, ListTodo, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Tasks } from './pages/Tasks';
import { Settlement } from './pages/Settlement';

type Tab = 'tasks' | 'settlement';

function Shell() {
  const { session, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('tasks');

  if (loading) {
    return <div className="min-h-screen bg-slate-950" />;
  }
  if (!session) return <Login />;

  const tabs: { key: Tab; label: string; icon: typeof ListTodo }[] = [
    { key: 'tasks', label: 'Задачі', icon: ListTodo },
    { key: 'settlement', label: 'Розрахунок', icon: Calculator },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-sm font-semibold">Задачі та розрахунок</span>
          <nav className="flex items-center gap-1 rounded-xl bg-slate-800/60 p-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  tab === key ? 'bg-slate-950 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => void signOut()}
            title={session.user.email ?? ''}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            <LogOut size={15} /> Вийти
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {tab === 'tasks' ? <Tasks /> : <Settlement />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
