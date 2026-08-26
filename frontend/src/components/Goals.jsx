import { useEffect, useState } from 'react';
import { Pencil, Save, Sparkles } from 'lucide-react';

const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);
const isFirstOfMonth = today.getDate() === 1;
const defaultProfile = { height_cm: '', age: '', sex: 'male', activity_level: 'moderate' };
const defaultGoal = { month: currentMonth, goal_type: 'maintain', current_weight: '', desired_weight: '', calorie_target: '', sleep_target: '', target_weight: '', calorie_tolerance: 200, source: 'manual', notes: '' };

export default function Goals({ onSaved }) {
  const [profile, setProfile] = useState(defaultProfile);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(true);
  const [goal, setGoal] = useState(defaultGoal);
  const [hasSavedGoal, setHasSavedGoal] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/profile').then((response) => response.json()).then((payload) => {
      if (payload) {
        setProfile(payload);
        setHasSavedProfile(true);
        setIsEditingProfile(false);
      }
    });
  }, []);

  useEffect(() => {
    fetch(`/api/goals?month=${goal.month}`).then((response) => response.json()).then((payload) => {
      if (payload) {
        setGoal(payload);
        setHasSavedGoal(true);
        setIsEditingGoal(false);
      } else {
        setHasSavedGoal(false);
        setIsEditingGoal(true);
        setGoal((current) => ({ ...defaultGoal, month: current.month }));
      }
    });
  }, [goal.month]);

  async function saveProfile(event) {
    event.preventDefault(); setSavingProfile(true);
    const response = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
    if (response.ok) {
      setProfile(await response.json());
      setHasSavedProfile(true);
      setIsEditingProfile(false);
      setMessage('One-time body profile saved.');
    }
    setSavingProfile(false);
  }

  async function generateGoal() {
    setGenerating(true); setMessage('');
    const response = await fetch('/api/goals/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goal) });
    const payload = await response.json();
    if (response.ok) setGoal(payload); else setMessage(payload.error || 'Could not generate monthly goal.');
    setGenerating(false);
  }

  async function saveGoal(event) {
    event.preventDefault(); setSavingGoal(true);
    const response = await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goal) });
    if (response.ok) {
      setGoal(await response.json());
      setHasSavedGoal(true);
      setIsEditingGoal(false);
      setMessage('Monthly goals saved.');
      onSaved();
    }
    setSavingGoal(false);
  }

  return (
    <section className="space-y-6">
      <header><p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Direction</p><h2 className="mt-2 text-3xl font-semibold">Goals</h2></header>

      <div className="rounded-3xl border border-zinc-800 bg-obsidian-card p-5">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-medium">One-time body profile</h3>
          {hasSavedProfile && !isEditingProfile && <button type="button" onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2 rounded-2xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 transition hover:border-obsidian-accent hover:text-obsidian-accent"><Pencil size={16} /> Modify</button>}
        </div>
        {hasSavedProfile && !isEditingProfile ? (
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Height</p><p className="mt-2 text-2xl font-semibold">{profile.height_cm} cm</p></div>
            <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Age</p><p className="mt-2 text-2xl font-semibold">{profile.age}</p></div>
            <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Sex</p><p className="mt-2 text-2xl font-semibold capitalize">{profile.sex}</p></div>
            <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Activity</p><p className="mt-2 text-2xl font-semibold capitalize">{profile.activity_level?.replace('_', ' ')}</p></div>
          </div>
        ) : (
          <form onSubmit={saveProfile}>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <input type="number" placeholder="Height cm" value={profile.height_cm ?? ''} onChange={(event) => setProfile((current) => ({ ...current, height_cm: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent" />
              <input type="number" placeholder="Age" value={profile.age ?? ''} onChange={(event) => setProfile((current) => ({ ...current, age: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent" />
              <select value={profile.sex ?? 'male'} onChange={(event) => setProfile((current) => ({ ...current, sex: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent"><option value="male">Male</option><option value="female">Female</option></select>
              <select value={profile.activity_level ?? 'moderate'} onChange={(event) => setProfile((current) => ({ ...current, activity_level: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent"><option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="active">Active</option><option value="very_active">Very active</option></select>
            </div>
            <button disabled={savingProfile} className="mt-4 flex items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 font-medium text-black"><Save size={18} /> {savingProfile ? 'Saving…' : hasSavedProfile ? 'Save changes' : 'Save profile'}</button>
          </form>
        )}
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-obsidian-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-medium">Monthly goal plan</h3>
            <p className="mt-1 text-sm text-zinc-400">Set once per month, then modify only when you choose to reopen it.</p>
          </div>
          {hasSavedGoal && !isEditingGoal && <button type="button" onClick={() => setIsEditingGoal(true)} className="flex items-center gap-2 rounded-2xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 transition hover:border-obsidian-accent hover:text-obsidian-accent"><Pencil size={16} /> Modify</button>}
        </div>

        {isFirstOfMonth && goal.month === currentMonth && (
          <div className="mt-4 rounded-2xl border border-obsidian-accent/40 bg-obsidian-accent/10 p-4 text-sm text-zinc-100">
            It’s the 1st of the month — review and set this month’s plan.
          </div>
        )}

        {hasSavedGoal && !isEditingGoal ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Month</p><p className="mt-2 text-2xl font-semibold">{goal.month}</p></div>
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Goal</p><p className="mt-2 text-2xl font-semibold capitalize">{goal.goal_type}</p></div>
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Current weight</p><p className="mt-2 text-2xl font-semibold">{goal.current_weight} kg</p></div>
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Desired weight</p><p className="mt-2 text-2xl font-semibold">{goal.desired_weight ?? '—'}{goal.desired_weight != null ? ' kg' : ''}</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Calories</p><p className="mt-2 text-2xl font-semibold text-obsidian-accent">{goal.calorie_target}</p><p className="text-sm text-zinc-400">kcal / day</p></div>
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Sleep</p><p className="mt-2 text-2xl font-semibold">{goal.sleep_target}</p><p className="text-sm text-zinc-400">hours / night</p></div>
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Target weight</p><p className="mt-2 text-2xl font-semibold">{goal.target_weight} kg</p></div>
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Tolerance</p><p className="mt-2 text-2xl font-semibold">±{goal.calorie_tolerance}</p><p className="text-sm text-zinc-400">kcal</p></div>
            </div>
            {goal.notes && <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Notes</p><p className="mt-2 text-zinc-200">{goal.notes}</p></div>}
          </div>
        ) : (
          <form onSubmit={saveGoal}>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <input type="month" value={goal.month} onChange={(event) => setGoal((current) => ({ ...current, month: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent" />
              <select value={goal.goal_type} onChange={(event) => setGoal((current) => ({ ...current, goal_type: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent"><option value="cut">Cut</option><option value="maintain">Maintain</option><option value="bulk">Bulk</option></select>
              <input type="number" step="0.1" placeholder="Current weight (kg)" value={goal.current_weight} onChange={(event) => setGoal((current) => ({ ...current, current_weight: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent" />
              <input type="number" step="0.1" placeholder="Desired goal weight (kg, optional)" value={goal.desired_weight ?? ''} onChange={(event) => setGoal((current) => ({ ...current, desired_weight: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent md:col-span-3" />
            </div>
            <button type="button" onClick={generateGoal} disabled={generating} className="mt-4 flex items-center gap-2 rounded-2xl bg-obsidian-accent px-4 py-3 font-medium text-black"><Sparkles size={18} /> {generating ? 'Calculating…' : 'Calculate with Gemini'}</button>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <label className="text-sm text-zinc-400">Calories<input type="number" value={goal.calorie_target} onChange={(event) => setGoal((current) => ({ ...current, calorie_target: event.target.value, source: 'manual' }))} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-obsidian-accent" /></label>
              <label className="text-sm text-zinc-400">Sleep target<input type="number" step="0.1" value={goal.sleep_target} onChange={(event) => setGoal((current) => ({ ...current, sleep_target: event.target.value, source: 'manual' }))} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-obsidian-accent" /></label>
              <label className="text-sm text-zinc-400">Target weight (kg)<input type="number" step="0.1" value={goal.target_weight} onChange={(event) => setGoal((current) => ({ ...current, target_weight: event.target.value, source: 'manual' }))} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-obsidian-accent" /></label>
              <label className="text-sm text-zinc-400">Calorie tolerance<input type="number" value={goal.calorie_tolerance} onChange={(event) => setGoal((current) => ({ ...current, calorie_tolerance: event.target.value, source: 'manual' }))} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-obsidian-accent" /></label>
            </div>
            <textarea value={goal.notes ?? ''} onChange={(event) => setGoal((current) => ({ ...current, notes: event.target.value }))} rows="3" placeholder="Gemini notes or your own monthly notes" className="mt-4 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent" />
            <button disabled={savingGoal} className="mt-4 flex items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 font-medium text-black"><Save size={18} /> {savingGoal ? 'Saving…' : hasSavedGoal ? 'Save changes' : 'Save monthly goals'}</button>
          </form>
        )}
        {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
      </div>
    </section>
  );
}
