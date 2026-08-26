import { useEffect, useState } from 'react';
import { Dumbbell, MoonStar, Save, Scale } from 'lucide-react';

export default function DailyLog({ selectedDate, onSaved }) {
  const [meta, setMeta] = useState({ muscle_groups: [] });
  const [form, setForm] = useState({ weight: '', sleep_hours: '', muscles: [] });
  const [history, setHistory] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/meta').then((response) => response.json()).then(setMeta);
  }, []);

  useEffect(() => {
    fetch(`/api/daily-log/${selectedDate}`).then((response) => response.json()).then((payload) => {
      setHistory(payload);
      setForm({
        weight: payload.weight?.weight ?? '',
        sleep_hours: payload.sleep?.sleep_hours ?? '',
        muscles: payload.workout?.muscles ?? [],
      });
    });
  }, [selectedDate]);

  const toggleMuscle = (muscle) => setForm((current) => ({ ...current, muscles: current.muscles.includes(muscle) ? current.muscles.filter((item) => item !== muscle) : [...current.muscles, muscle] }));

  async function saveDailyLog(event) {
    event.preventDefault();
    setSaving(true);
    const requests = [];
    if (form.weight !== '') requests.push(fetch('/api/weight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, weight: Number(form.weight) }) }));
    if (form.sleep_hours !== '') requests.push(fetch('/api/sleep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, sleep_hours: Number(form.sleep_hours) }) }));
    requests.push(fetch('/api/workouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, muscles: form.muscles }) }));
    await Promise.all(requests);
    const refreshed = await fetch(`/api/daily-log/${selectedDate}`).then((response) => response.json());
    setHistory(refreshed);
    onSaved();
    setSaving(false);
  }

  return (
    <section className="space-y-6">
      <header><p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Daily record</p><h2 className="mt-2 text-3xl font-semibold">Daily Log</h2></header>

      <form onSubmit={saveDailyLog} className="space-y-6 rounded-3xl border border-zinc-800 bg-obsidian-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-zinc-400"><span className="flex items-center gap-2"><Scale size={16} /> Current weight (kg)</span><input type="number" step="0.1" value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-obsidian-accent" /></label>
          <label className="text-sm text-zinc-400"><span className="flex items-center gap-2"><MoonStar size={16} /> Sleep hours</span><input type="number" step="0.1" value={form.sleep_hours} onChange={(event) => setForm((current) => ({ ...current, sleep_hours: event.target.value }))} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-obsidian-accent" /></label>
        </div>

        <div>
          <p className="mb-3 flex items-center gap-2 text-sm text-zinc-400"><Dumbbell size={16} /> Muscles trained</p>
          <div className="flex flex-wrap gap-2">
            {meta.muscle_groups.map((muscle) => {
              const active = form.muscles.includes(muscle);
              return <button type="button" key={muscle} onClick={() => toggleMuscle(muscle)} className={`rounded-full px-4 py-2 capitalize transition ${active ? 'bg-obsidian-accent text-black' : 'border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600'}`}>{muscle}</button>;
            })}
          </div>
        </div>

        <button disabled={saving} className="flex items-center gap-2 rounded-2xl bg-obsidian-accent px-4 py-3 font-medium text-black"><Save size={18} /> {saving ? 'Saving…' : 'Save daily log'}</button>
      </form>

      <div className="rounded-3xl border border-zinc-800 bg-obsidian-card p-5">
        <h3 className="text-lg font-medium">Stored record for {selectedDate}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Weight (kg)</p><p className="mt-2 text-2xl font-semibold">{history?.weight?.weight ?? '—'}</p></div>
          <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Sleep</p><p className="mt-2 text-2xl font-semibold">{history?.sleep?.sleep_hours ?? '—'}</p></div>
          <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Workout</p><p className="mt-2 text-2xl font-semibold">{history?.workout?.trained ? 'Trained' : 'Rest'}</p><p className="mt-1 text-sm capitalize text-zinc-400">{history?.workout?.muscles?.join(', ') || 'No muscles logged'}</p></div>
        </div>
      </div>
    </section>
  );
}

