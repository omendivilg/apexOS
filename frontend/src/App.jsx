import { useState } from 'react';
import { CalendarDays, Download, LayoutDashboard, Target, UtensilsCrossed } from 'lucide-react';
import Dashboard from './components/Dashboard.jsx';
import MealLogger from './components/MealLogger.jsx';
import DailyLog from './components/DailyLog.jsx';
import Goals from './components/Goals.jsx';

const today = new Date().toISOString().slice(0, 10);
const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'nutrition', label: 'Nutrition', icon: UtensilsCrossed },
  { id: 'daily-log', label: 'Daily Log', icon: CalendarDays },
  { id: 'goals', label: 'Goals', icon: Target },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(today);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((value) => value + 1);

  return (
    <div className="min-h-screen bg-obsidian-bg text-obsidian-text">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 md:flex-row md:p-8">
        <aside className="w-full rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 md:w-72">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Local-first</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Apex OS</h1>
          </div>

          <label className="mb-6 block text-sm text-zinc-400">
            Active date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-obsidian-accent"
            />
          </label>

          <nav className="space-y-2">
            {tabs.map(({ id, label, icon: Icon }) => {
              const selected = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${selected ? 'bg-obsidian-accent text-black shadow-glow' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}>
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <a href="/api/export" className="mt-8 flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-300 transition hover:border-obsidian-accent hover:text-obsidian-accent">
            <Download size={16} />
            Download backup
          </a>
        </aside>

        <main className="flex-1">
          {activeTab === 'dashboard' && <Dashboard selectedDate={selectedDate} refreshKey={refreshKey} />}
          {activeTab === 'nutrition' && <MealLogger selectedDate={selectedDate} onSaved={refresh} />}
          {activeTab === 'daily-log' && <DailyLog selectedDate={selectedDate} onSaved={refresh} />}
          {activeTab === 'goals' && <Goals onSaved={refresh} />}
        </main>
      </div>
    </div>
  );
}


