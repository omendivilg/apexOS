import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const chartCard = 'rounded-3xl border border-zinc-800 bg-obsidian-card p-5';
const remainingPieColor = '#3f3f46';

function MetricChart({ title, children }) {
  return <div className={chartCard}><h3 className="mb-5 text-lg font-medium">{title}</h3><div className="h-[260px]">{children}</div></div>;
}

function pct(value) {
  return `${Math.round(value)}%`;
}

export default function Dashboard({ selectedDate, refreshKey }) {
  const [data, setData] = useState([]);
  const [exercise, setExercise] = useState({ daily: [], weekly: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch('/api/dashboard-summary').then((response) => response.json()), fetch('/api/exercise-summary').then((response) => response.json())]).then(([summary, exerciseSummary]) => {
      setData(summary);
      setExercise(exerciseSummary);
      setLoading(false);
    });
  }, [refreshKey]);

  const overview = useMemo(() => data.map((row) => ({ ...row, fill: row.verdict === 'good' ? '#39FF14' : row.verdict === 'mixed' ? '#f59e0b' : '#ef4444' })), [data]);
  const activeGoal = [...data].reverse().find((row) => row.goal)?.goal;
  const selectedDay = data.find((row) => row.date === selectedDate);
  const dayGoal = selectedDay?.goal || activeGoal;
  const dailyOverview = useMemo(() => {
    if (!selectedDay || !dayGoal) return null;
    const upperCalorieLimit = dayGoal.calorie_target + dayGoal.calorie_tolerance;
    const calorieScore = selectedDay.total_calories > upperCalorieLimit
      ? Math.max(0, 100 - ((selectedDay.total_calories - upperCalorieLimit) / Math.max(dayGoal.calorie_tolerance, 1)) * 100)
      : Math.min((selectedDay.total_calories / Math.max(dayGoal.calorie_target, 1)) * 100, 100);
    const caloriesComplete = Math.round(calorieScore);
    return {
      caloriesComplete,
      calorieColor: Math.abs(selectedDay.total_calories - dayGoal.calorie_target) <= dayGoal.calorie_tolerance ? '#7CFF6B' : caloriesComplete >= 75 ? '#38bdf8' : caloriesComplete >= 50 ? '#facc15' : caloriesComplete >= 25 ? '#f97316' : '#ef4444',
      caloriePie: [
        { name: 'Calories logged', value: caloriesComplete },
        { name: 'Remaining', value: Math.max(0, 100 - caloriesComplete) },
      ],
      sleepDone: selectedDay.sleep_hours >= dayGoal.sleep_target,
      sleepDetail: selectedDay.sleep_hours != null ? `${selectedDay.sleep_hours} / ${dayGoal.sleep_target} h` : 'Not logged',
      trainingDone: Boolean(selectedDay.trained),
      trainingDetail: selectedDay.muscles?.length ? selectedDay.muscles.join(', ') : 'No muscles logged',
    };
  }, [selectedDay, dayGoal]);

  if (loading) return <div className="flex h-96 items-center justify-center text-zinc-500">Loading metrics…</div>;

  return (
    <section className="space-y-6">
      <header><p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Command center</p><h2 className="mt-2 text-3xl font-semibold">Dashboard</h2></header>

      <div className={chartCard}>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div><p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Active monthly goals</p><h3 className="mt-2 text-2xl font-semibold capitalize">{activeGoal ? `${activeGoal.month} · ${activeGoal.goal_type}` : 'No monthly goal set'}</h3></div>
          {activeGoal && <p className="text-sm text-zinc-400">Calories tolerance: ±{activeGoal.calorie_tolerance} kcal</p>}
        </div>
        {activeGoal ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Calories</p><p className="mt-2 text-2xl font-semibold text-obsidian-accent">{activeGoal.calorie_target}</p><p className="text-sm text-zinc-400">kcal / day</p></div>
            <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Sleep</p><p className="mt-2 text-2xl font-semibold">{activeGoal.sleep_target}</p><p className="text-sm text-zinc-400">hours / night</p></div>
            <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-500">Target weight</p><p className="mt-2 text-2xl font-semibold">{activeGoal.target_weight}</p><p className="text-sm text-zinc-400">kg</p></div>
          </div>
        ) : <p className="mt-4 text-zinc-400">Create a monthly plan in Goals to activate scoring and dashboard targets.</p>}

        <div className="mt-6 border-t border-zinc-800 pt-6">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Daily overview</p>
          <h3 className="mt-2 text-2xl font-semibold">{selectedDay?.day_label || selectedDate}</h3>
          <div className="mt-4 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="h-[320px]">
              {dailyOverview ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dailyOverview.caloriePie} dataKey="value" nameKey="name" innerRadius={82} outerRadius={124} paddingAngle={1} cornerRadius={8}>
                      {dailyOverview.caloriePie.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? dailyOverview.calorieColor : remainingPieColor} stroke="#18181b" strokeWidth={3} />)}
                    </Pie>
                    <Tooltip formatter={(value, name) => [pct(value), name]} contentStyle={{ background: '#27272a', color: '#f4f4f5', border: '1px solid #52525b', borderRadius: 16, boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }} itemStyle={{ color: '#f4f4f5' }} labelStyle={{ color: '#f4f4f5' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-center text-zinc-500">Set this month's goals and log this day to activate the calorie chart.</div>}
            </div>
            <div className="grid content-center gap-3">
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm" style={{ color: dailyOverview?.calorieColor || '#7CFF6B' }}>Calories</p><p className="mt-1 text-3xl font-semibold">{dailyOverview ? pct(dailyOverview.caloriesComplete) : '?'}</p><p className="text-sm text-zinc-500">{selectedDay && dayGoal ? `${selectedDay.total_calories || 0} / ${dayGoal.calorie_target} kcal` : 'No goal'}</p></div>
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-400">Sleep</p><p className="mt-1 flex items-center gap-2 text-2xl font-semibold">{dailyOverview?.sleepDone ? <CheckCircle2 className="text-sky-400" size={24} /> : <Circle className="text-zinc-600" size={24} />} {dailyOverview?.sleepDone ? 'Complete' : 'Not complete'}</p><p className="text-sm text-zinc-500">{dailyOverview?.sleepDetail || 'No goal'}</p></div>
              <div className="rounded-2xl bg-zinc-950 p-4"><p className="text-sm text-zinc-400">Training</p><p className="mt-1 flex items-center gap-2 text-2xl font-semibold">{dailyOverview?.trainingDone ? <CheckCircle2 className="text-violet-400" size={24} /> : <Circle className="text-zinc-600" size={24} />} {dailyOverview?.trainingDone ? 'Trained' : 'Not trained'}</p><p className="text-sm capitalize text-zinc-500">{dailyOverview?.trainingDetail || 'No muscles logged'}</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className={chartCard}>
        <h3 className="text-lg font-medium">Main overview</h3>
        <p className="mb-5 text-sm text-zinc-400">Daily score against that month’s calorie, sleep, weight, and training goals.</p>
        <div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={overview}><CartesianGrid stroke="#27272a" strokeDasharray="3 3" /><XAxis dataKey="day_label" stroke="#a1a1aa" /><YAxis stroke="#a1a1aa" domain={[0, 100]} /><Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 16 }} /><Bar dataKey="score" name="Daily score" radius={[8, 8, 0, 0]}>{overview.map((entry) => <Cell key={entry.date} fill={entry.fill} />)}</Bar></ComposedChart></ResponsiveContainer></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MetricChart title="Meals: calories per day"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid stroke="#27272a" strokeDasharray="3 3" /><XAxis dataKey="date" stroke="#a1a1aa" /><YAxis stroke="#a1a1aa" /><Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 16 }} /><Bar dataKey="total_calories" fill="#39FF14" radius={[8, 8, 0, 0]} /></ComposedChart></ResponsiveContainer></MetricChart>
        <MetricChart title="Sleep hours"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid stroke="#27272a" strokeDasharray="3 3" /><XAxis dataKey="date" stroke="#a1a1aa" /><YAxis stroke="#a1a1aa" /><Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 16 }} /><Area type="monotone" dataKey="sleep_hours" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.18} /></ComposedChart></ResponsiveContainer></MetricChart>
        <MetricChart title="Weight trend (kg)"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid stroke="#27272a" strokeDasharray="3 3" /><XAxis dataKey="date" stroke="#a1a1aa" /><YAxis stroke="#a1a1aa" /><Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 16 }} /><Line type="monotone" dataKey="weight" stroke="#f4f4f5" strokeWidth={2.5} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer></MetricChart>
        <MetricChart title="Exercise: trained / rest"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={exercise.daily}><CartesianGrid stroke="#27272a" strokeDasharray="3 3" /><XAxis dataKey="date" stroke="#a1a1aa" /><YAxis stroke="#a1a1aa" domain={[0, 1]} ticks={[0, 1]} /><Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 16 }} /><Bar dataKey="trained" fill="#a78bfa" radius={[8, 8, 0, 0]} /></ComposedChart></ResponsiveContainer></MetricChart>
      </div>

      <div className={chartCard}><h3 className="text-lg font-medium">Weekly muscle frequency</h3><p className="mb-5 text-sm text-zinc-400">Target muscles aim for 2 sessions in the latest 7-day window. Abs and calves are tracked but not scored.</p><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={exercise.weekly}><CartesianGrid stroke="#27272a" strokeDasharray="3 3" /><XAxis dataKey="muscle" stroke="#a1a1aa" /><YAxis stroke="#a1a1aa" allowDecimals={false} /><Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 16 }} /><Bar dataKey="sessions" fill="#f59e0b" radius={[8, 8, 0, 0]} /><Line dataKey="target" stroke="#39FF14" strokeDasharray="5 5" /></ComposedChart></ResponsiveContainer></div></div>
    </section>
  );
}
