import { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function MealLogger({ selectedDate, onSaved }) {
  const [description, setDescription] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [meals, setMeals] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totals = useMemo(() => meals.reduce((acc, meal) => ({ calories: acc.calories + Number(meal.calories || 0), protein: acc.protein + Number(meal.protein || 0) }), { calories: 0, protein: 0 }), [meals]);
  const selectedMonth = selectedDate.slice(0, 7);

  async function loadMeals() {
    const [dayMeals, summary] = await Promise.all([
      fetch(`/api/meals?date=${selectedDate}`).then((response) => response.json()),
      fetch('/api/dashboard-summary').then((response) => response.json()),
    ]);
    setMeals(dayMeals);
    setMonthlyData(summary.filter((row) => row.date.startsWith(selectedMonth)));
  }

  useEffect(() => {
    loadMeals();
    setEstimate(null);
    setError('');
  }, [selectedDate]);

  async function estimateMeal(event) {
    event.preventDefault();
    setEstimating(true);
    setError('');
    const response = await fetch('/api/meals/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description }) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || 'Could not estimate this meal.');
    else setEstimate(payload);
    setEstimating(false);
  }

  async function saveMeal(event) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch('/api/meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, ...estimate, source: 'gemini' }) });
    if (response.ok) {
      setEstimate(null);
      setDescription('');
      await loadMeals();
      onSaved();
    }
    setSaving(false);
  }

  async function deleteMeal(id) {
    const response = await fetch(`/api/meals/${id}`, { method: 'DELETE' });
    if (response.ok) {
      await loadMeals();
      onSaved();
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Fuel</p>
        <h2 className="mt-2 text-3xl font-semibold">Nutrition</h2>
      </header>

      <div className="rounded-3xl border border-zinc-800 bg-obsidian-card p-5">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-medium">Meals on this day</h3><span className="text-sm text-zinc-500">{selectedDate}</span></div>
        <div className="space-y-3">
          {meals.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-zinc-500">No meals logged.</p> : meals.map((meal) => (
            <div key={meal.id} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
              <div><p className="font-medium">{meal.meal_name}</p><p className="text-sm text-zinc-400">{meal.calories} kcal · {meal.protein}g protein</p></div>
              <button onClick={() => deleteMeal(meal.id)} className="rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-red-400"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-zinc-800 bg-obsidian-card p-5">
          <h3 className="text-lg font-medium">Describe a meal</h3>
          <p className="mt-1 text-sm text-zinc-400">Example: 200g chicken breast, 150g cooked rice, 2 eggs.</p>
          <form className="mt-5 space-y-4" onSubmit={estimateMeal}>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows="4" placeholder="What did you eat? Include grams when you know them." className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none transition focus:border-obsidian-accent" />
            <button disabled={estimating || !description.trim()} className="flex items-center justify-center gap-2 rounded-2xl bg-obsidian-accent px-4 py-3 font-medium text-black transition hover:brightness-110 disabled:opacity-60"><Sparkles size={18} />{estimating ? 'Estimating…' : 'Estimate with Gemini'}</button>
          </form>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-obsidian-card p-5">
          <p className="text-sm text-zinc-400">{selectedDate}</p>
          <p className="mt-3 text-4xl font-semibold text-obsidian-accent">{totals.calories}</p>
          <p className="text-sm text-zinc-400">kcal</p>
          <div className="mt-5 border-t border-zinc-800 pt-5"><p className="text-2xl font-semibold">{totals.protein.toFixed(1)}g</p><p className="text-sm text-zinc-400">protein</p></div>
        </div>
      </div>

      {estimate && (
        <form onSubmit={saveMeal} className="rounded-3xl border border-obsidian-accent/40 bg-obsidian-card p-5 shadow-glow">
          <h3 className="text-lg font-medium">Review before saving</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <input value={estimate.meal_name} onChange={(event) => setEstimate((current) => ({ ...current, meal_name: event.target.value }))} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:border-obsidian-accent md:col-span-4" />
            {['calories', 'protein', 'carbs', 'fats'].map((field) => <label key={field} className="text-sm capitalize text-zinc-400">{field}<input type="number" step={field === 'calories' ? '1' : '0.1'} value={estimate[field]} onChange={(event) => setEstimate((current) => ({ ...current, [field]: Number(event.target.value) }))} className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-obsidian-accent" /></label>)}
          </div>
          <button disabled={saving} className="mt-5 flex items-center gap-2 rounded-2xl bg-obsidian-accent px-4 py-3 font-medium text-black"><Plus size={18} />{saving ? 'Saving…' : 'Confirm and save meal'}</button>
        </form>
      )}

      <div className="rounded-3xl border border-zinc-800 bg-obsidian-card p-5">
        <h3 className="text-lg font-medium">Nutrition this month</h3>
        <p className="mb-5 text-sm text-zinc-400">Calories per logged day in {selectedMonth}.</p>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyData}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="day_label" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 16 }} />
              <Bar dataKey="total_calories" fill="#39FF14" radius={[8, 8, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
