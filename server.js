require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'apex.db');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'abs', 'calves'];
const TARGET_MUSCLES = MUSCLE_GROUPS.filter((muscle) => !['abs', 'calves'].includes(muscle));

app.use(cors());
app.use(express.json());
const db = new sqlite3.Database(DB_PATH);
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function onRun(error) { if (error) reject(error); else resolve(this); }));
const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => { if (error) reject(error); else resolve(row); }));
const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => { if (error) reject(error); else resolve(rows); }));

async function ensureColumn(table, column, definition) { const columns = await all(`PRAGMA table_info(${table})`); if (!columns.some((item) => item.name === column)) await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`); }
async function initializeDatabase() {
  await run('PRAGMA foreign_keys = ON');
  await run(`CREATE TABLE IF NOT EXISTS biometrics (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, weight REAL NOT NULL, body_fat REAL)`);
  await run(`CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, meal_name TEXT NOT NULL, calories INTEGER NOT NULL, protein REAL NOT NULL DEFAULT 0, carbs REAL NOT NULL DEFAULT 0, fats REAL NOT NULL DEFAULT 0)`);
  await ensureColumn('meals', 'description', 'TEXT'); await ensureColumn('meals', 'source', "TEXT NOT NULL DEFAULT 'manual'"); await run('CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date)');
  await run(`CREATE TABLE IF NOT EXISTS recovery (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, sleep_hours REAL NOT NULL)`);
  await run(`CREATE TABLE IF NOT EXISTS workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, muscles_json TEXT NOT NULL DEFAULT '[]')`);
  await run(`CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id = 1), height_cm REAL, age INTEGER, sex TEXT, activity_level TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS monthly_goals (id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT NOT NULL UNIQUE, goal_type TEXT NOT NULL, current_weight REAL NOT NULL, desired_weight REAL, calorie_target INTEGER NOT NULL, sleep_target REAL NOT NULL, target_weight REAL NOT NULL, calorie_tolerance INTEGER NOT NULL DEFAULT 200, source TEXT NOT NULL DEFAULT 'manual', notes TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS productivity (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, source TEXT, activity_title TEXT NOT NULL, duration_minutes INTEGER NOT NULL, category TEXT)`);
}

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isMonth = (value) => /^\d{4}-\d{2}$/.test(value);
const asNumber = (value) => Number(value);
const requireDate = (value) => typeof value === 'string' && isIsoDate(value);
const normalizeMuscles = (muscles = []) => [...new Set(muscles.map((muscle) => String(muscle).toLowerCase()).filter((muscle) => MUSCLE_GROUPS.includes(muscle)))];
const parseMuscles = (value) => { try { return JSON.parse(value || '[]'); } catch { return []; } };
const handleError = (res, error) => { console.error(error); res.status(500).json({ error: 'Internal server error' }); };
const monthForDate = (date) => date.slice(0, 7);
const dayLabel = (date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

function scoreDay(row, goal) {
  if (!goal) return { score: 0, verdict: 'no-goal' };
  const checks = [];
  if (row.total_calories > 0) checks.push(Math.max(0, 1 - Math.abs(row.total_calories - goal.calorie_target) / Math.max(goal.calorie_tolerance, 1)));
  if (row.sleep_hours != null) checks.push(Math.min(row.sleep_hours / goal.sleep_target, 1));
  if (row.weight != null) {
    const monthlyDelta = Math.abs(goal.current_weight - goal.target_weight);
    const distance = Math.abs(row.weight - goal.target_weight);
    checks.push(monthlyDelta === 0 ? (distance <= 0.5 ? 1 : 0) : Math.max(0, 1 - distance / monthlyDelta));
  }
  checks.push(row.trained ? 1 : 0);
  const score = Math.round((checks.reduce((sum, value) => sum + value, 0) / checks.length) * 100);
  return { score, verdict: score >= 80 ? 'good' : score >= 60 ? 'mixed' : 'poor' };
}

app.get('/api/meta', (_req, res) => res.json({ muscle_groups: MUSCLE_GROUPS, target_muscles: TARGET_MUSCLES, gemini_configured: Boolean(GEMINI_API_KEY) }));
app.get('/api/profile', async (_req, res) => { try { res.json(await get('SELECT * FROM profile WHERE id = 1') || null); } catch (error) { handleError(res, error); } });
app.post('/api/profile', async (req, res) => { try { const { height_cm, age, sex, activity_level } = req.body; await run('INSERT INTO profile (id, height_cm, age, sex, activity_level) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET height_cm = excluded.height_cm, age = excluded.age, sex = excluded.sex, activity_level = excluded.activity_level', [asNumber(height_cm), asNumber(age), sex, activity_level]); res.status(201).json(await get('SELECT * FROM profile WHERE id = 1')); } catch (error) { handleError(res, error); } });
app.get('/api/goals', async (req, res) => { try { res.json(req.query.month ? await get('SELECT * FROM monthly_goals WHERE month = ?', [req.query.month]) || null : await all('SELECT * FROM monthly_goals ORDER BY month DESC')); } catch (error) { handleError(res, error); } });
app.post('/api/goals/generate', async (req, res) => {
  try {
    const { month, goal_type, current_weight, desired_weight = null } = req.body;
    const profile = await get('SELECT * FROM profile WHERE id = 1');
    if (!profile) return res.status(400).json({ error: 'Complete your profile first.' });
    if (!isMonth(month) || !['cut', 'maintain', 'bulk'].includes(goal_type) || !Number.isFinite(asNumber(current_weight))) return res.status(400).json({ error: 'month, goal_type, and current_weight are required' });
    if (!GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to .env.' });
    const prompt = `Create monthly fitness goals for a ${profile.age}-year-old ${profile.sex}, ${profile.height_cm} cm tall, activity level ${profile.activity_level}, current weight ${current_weight} kg. Monthly goal: ${goal_type}. Desired weight if provided: ${desired_weight ?? 'not provided'}. Return realistic daily calorie target, nightly sleep target in hours, and target weight for the end of the month. Keep calories practical for someone eating 2-3 meals per day.`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { calorie_target: { type: 'INTEGER' }, sleep_target: { type: 'NUMBER' }, target_weight: { type: 'NUMBER' }, notes: { type: 'STRING' } }, required: ['calorie_target', 'sleep_target', 'target_weight', 'notes'] } } }) });
    if (!response.ok) return res.status(502).json({ error: 'Gemini goal generation failed', detail: await response.text() });
    const payload = await response.json(); const generated = JSON.parse(payload.candidates?.[0]?.content?.parts?.[0]?.text);
    res.json({ month, goal_type, current_weight: asNumber(current_weight), desired_weight: desired_weight === null || desired_weight === '' ? null : asNumber(desired_weight), calorie_tolerance: 200, source: 'gemini', ...generated });
  } catch (error) { handleError(res, error); }
});
app.post('/api/goals', async (req, res) => { try { const goal = req.body; if (!isMonth(goal.month)) return res.status(400).json({ error: 'Valid month is required' }); await run('INSERT INTO monthly_goals (month, goal_type, current_weight, desired_weight, calorie_target, sleep_target, target_weight, calorie_tolerance, source, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(month) DO UPDATE SET goal_type = excluded.goal_type, current_weight = excluded.current_weight, desired_weight = excluded.desired_weight, calorie_target = excluded.calorie_target, sleep_target = excluded.sleep_target, target_weight = excluded.target_weight, calorie_tolerance = excluded.calorie_tolerance, source = excluded.source, notes = excluded.notes', [goal.month, goal.goal_type, asNumber(goal.current_weight), goal.desired_weight === '' || goal.desired_weight == null ? null : asNumber(goal.desired_weight), asNumber(goal.calorie_target), asNumber(goal.sleep_target), asNumber(goal.target_weight), asNumber(goal.calorie_tolerance ?? 200), goal.source || 'manual', goal.notes || null]); res.status(201).json(await get('SELECT * FROM monthly_goals WHERE month = ?', [goal.month])); } catch (error) { handleError(res, error); } });

// Existing endpoint block retained below
app.get('/api/meals', async (req, res) => {
  try {
    const rows = req.query.date
      ? await all('SELECT * FROM meals WHERE date = ? ORDER BY id DESC', [req.query.date])
      : await all('SELECT * FROM meals ORDER BY date DESC, id DESC');
    res.json(rows);
  } catch (error) { handleError(res, error); }
});

app.post('/api/meals/estimate', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: 'description is required' });
    if (!GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to the server environment.' });

    const prompt = `Estimate nutrition for this meal using the provided grams when available. Return realistic totals only. Meal: ${description.trim()}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              meal_name: { type: 'STRING' },
              calories: { type: 'INTEGER' },
              protein: { type: 'NUMBER' },
              carbs: { type: 'NUMBER' },
              fats: { type: 'NUMBER' },
            },
            required: ['meal_name', 'calories', 'protein', 'carbs', 'fats'],
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: 'Gemini estimation failed', detail });
    }

    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: 'Gemini returned no estimate' });
    const estimate = JSON.parse(text);
    res.json({ ...estimate, description: description.trim() });
  } catch (error) { handleError(res, error); }
});

app.post('/api/meals', async (req, res) => {
  try {
    const { date, meal_name, calories, protein = 0, carbs = 0, fats = 0, description = null, source = 'manual' } = req.body;
    if (!requireDate(date) || !meal_name || !Number.isFinite(asNumber(calories))) return res.status(400).json({ error: 'date, meal_name, and numeric calories are required' });
    const result = await run('INSERT INTO meals (date, meal_name, calories, protein, carbs, fats, description, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [date, meal_name.trim(), asNumber(calories), asNumber(protein), asNumber(carbs), asNumber(fats), description, source]);
    res.status(201).json(await get('SELECT * FROM meals WHERE id = ?', [result.lastID]));
  } catch (error) { handleError(res, error); }
});

app.put('/api/meals/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM meals WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Meal not found' });
    const next = { ...existing, ...req.body };
    if (!requireDate(next.date) || !next.meal_name || !Number.isFinite(asNumber(next.calories))) return res.status(400).json({ error: 'Invalid meal payload' });
    await run('UPDATE meals SET date = ?, meal_name = ?, calories = ?, protein = ?, carbs = ?, fats = ?, description = ?, source = ? WHERE id = ?', [next.date, next.meal_name.trim(), asNumber(next.calories), asNumber(next.protein), asNumber(next.carbs), asNumber(next.fats), next.description, next.source, req.params.id]);
    res.json(await get('SELECT * FROM meals WHERE id = ?', [req.params.id]));
  } catch (error) { handleError(res, error); }
});

app.delete('/api/meals/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM meals WHERE id = ?', [req.params.id]);
    if (!result.changes) return res.status(404).json({ error: 'Meal not found' });
    res.status(204).send();
  } catch (error) { handleError(res, error); }
});

app.get('/api/sleep', async (req, res) => {
  try { res.json(req.query.date ? await all('SELECT * FROM recovery WHERE date = ?', [req.query.date]) : await all('SELECT * FROM recovery ORDER BY date DESC')); }
  catch (error) { handleError(res, error); }
});
app.post('/api/sleep', async (req, res) => {
  try {
    const { date, sleep_hours } = req.body;
    if (!requireDate(date) || !Number.isFinite(asNumber(sleep_hours))) return res.status(400).json({ error: 'date and numeric sleep_hours are required' });
    await run('INSERT INTO recovery (date, sleep_hours) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET sleep_hours = excluded.sleep_hours', [date, asNumber(sleep_hours)]);
    res.status(201).json(await get('SELECT * FROM recovery WHERE date = ?', [date]));
  } catch (error) { handleError(res, error); }
});

app.get('/api/weight', async (req, res) => {
  try { res.json(req.query.date ? await all('SELECT * FROM biometrics WHERE date = ?', [req.query.date]) : await all('SELECT * FROM biometrics ORDER BY date DESC')); }
  catch (error) { handleError(res, error); }
});
app.post('/api/weight', async (req, res) => {
  try {
    const { date, weight, body_fat = null } = req.body;
    if (!requireDate(date) || !Number.isFinite(asNumber(weight))) return res.status(400).json({ error: 'date and numeric weight are required' });
    await run('INSERT INTO biometrics (date, weight, body_fat) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, body_fat = excluded.body_fat', [date, asNumber(weight), body_fat === null || body_fat === '' ? null : asNumber(body_fat)]);
    res.status(201).json(await get('SELECT * FROM biometrics WHERE date = ?', [date]));
  } catch (error) { handleError(res, error); }
});

app.get('/api/workouts', async (req, res) => {
  try {
    const rows = req.query.date ? await all('SELECT * FROM workouts WHERE date = ?', [req.query.date]) : await all('SELECT * FROM workouts ORDER BY date DESC');
    res.json(rows.map((row) => ({ ...row, muscles: parseMuscles(row.muscles_json), trained: parseMuscles(row.muscles_json).length > 0 })));
  } catch (error) { handleError(res, error); }
});
app.post('/api/workouts', async (req, res) => {
  try {
    const { date, muscles = [] } = req.body;
    if (!requireDate(date)) return res.status(400).json({ error: 'date is required' });
    const normalized = normalizeMuscles(muscles);
    await run('INSERT INTO workouts (date, muscles_json) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET muscles_json = excluded.muscles_json', [date, JSON.stringify(normalized)]);
    const workout = await get('SELECT * FROM workouts WHERE date = ?', [date]);
    res.status(201).json({ ...workout, muscles: normalized, trained: normalized.length > 0 });
  } catch (error) { handleError(res, error); }
});

app.get('/api/daily-log/:date', async (req, res) => {
  try {
    if (!requireDate(req.params.date)) return res.status(400).json({ error: 'Invalid date' });
    const [meals, sleep, weight, workout] = await Promise.all([
      all('SELECT * FROM meals WHERE date = ? ORDER BY id DESC', [req.params.date]),
      get('SELECT * FROM recovery WHERE date = ?', [req.params.date]),
      get('SELECT * FROM biometrics WHERE date = ?', [req.params.date]),
      get('SELECT * FROM workouts WHERE date = ?', [req.params.date]),
    ]);
    res.json({ date: req.params.date, meals, sleep, weight, workout: workout ? { ...workout, muscles: parseMuscles(workout.muscles_json), trained: parseMuscles(workout.muscles_json).length > 0 } : null });
  } catch (error) { handleError(res, error); }
});

app.get('/api/dashboard-summary', async (_req, res) => {
  try {
    const rows = await all(`
      WITH dates AS (
        SELECT date FROM meals UNION SELECT date FROM recovery UNION SELECT date FROM biometrics UNION SELECT date FROM workouts
      ), meal_totals AS (
        SELECT date, SUM(calories) AS total_calories, SUM(protein) AS total_protein FROM meals GROUP BY date
      )
      SELECT dates.date, COALESCE(meal_totals.total_calories, 0) AS total_calories, COALESCE(meal_totals.total_protein, 0) AS total_protein,
             recovery.sleep_hours, biometrics.weight, workouts.muscles_json
      FROM dates
      LEFT JOIN meal_totals ON meal_totals.date = dates.date
      LEFT JOIN recovery ON recovery.date = dates.date
      LEFT JOIN biometrics ON biometrics.date = dates.date
      LEFT JOIN workouts ON workouts.date = dates.date
      ORDER BY dates.date ASC
    `);
    const goals = await all('SELECT * FROM monthly_goals');
    const goalsByMonth = Object.fromEntries(goals.map((goal) => [goal.month, goal]));
    res.json(rows.map((row) => {
      const muscles = parseMuscles(row.muscles_json);
      const normalized = { ...row, day_label: dayLabel(row.date), muscles, trained: muscles.length > 0 ? 1 : 0 };
      const goal = goalsByMonth[monthForDate(row.date)];
      return { ...normalized, goal, ...scoreDay(normalized, goal) };
    }));
  } catch (error) { handleError(res, error); }
});

app.get('/api/exercise-summary', async (_req, res) => {
  try {
    const rows = await all('SELECT date, muscles_json FROM workouts ORDER BY date ASC');
    const parsed = rows.map((row) => ({ date: row.date, muscles: parseMuscles(row.muscles_json) }));
    const lastDate = parsed.at(-1)?.date || new Date().toISOString().slice(0, 10);
    const end = new Date(`${lastDate}T00:00:00Z`);
    const start = new Date(end); start.setUTCDate(end.getUTCDate() - 6);
    const weekly = Object.fromEntries(MUSCLE_GROUPS.map((muscle) => [muscle, 0]));
    parsed.filter((row) => new Date(`${row.date}T00:00:00Z`) >= start).forEach((row) => row.muscles.forEach((muscle) => { weekly[muscle] += 1; }));
    res.json({ daily: parsed.map((row) => ({ ...row, trained: row.muscles.length > 0 ? 1 : 0 })), weekly: MUSCLE_GROUPS.map((muscle) => ({ muscle, sessions: weekly[muscle], target: TARGET_MUSCLES.includes(muscle) ? 2 : null })) });
  } catch (error) { handleError(res, error); }
});

app.get('/api/export', async (_req, res) => {
  try {
    const payload = { exported_at: new Date().toISOString(), profile: await get('SELECT * FROM profile WHERE id = 1'), goals: await all('SELECT * FROM monthly_goals ORDER BY month ASC'), biometrics: await all('SELECT * FROM biometrics ORDER BY date ASC'), meals: await all('SELECT * FROM meals ORDER BY date ASC, id ASC'), recovery: await all('SELECT * FROM recovery ORDER BY date ASC'), workouts: await all('SELECT * FROM workouts ORDER BY date ASC'), productivity: await all('SELECT * FROM productivity ORDER BY date ASC, id ASC') };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="apex-os-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) { handleError(res, error); }
});

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, 'frontend', 'dist');
  if (fs.existsSync(frontendDist)) { app.use(express.static(frontendDist)); app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html'))); }
}

initializeDatabase().then(() => app.listen(PORT, () => console.log(`Apex OS API listening on http://localhost:${PORT}`))).catch((error) => { console.error('Failed to initialize database', error); process.exit(1); });
process.on('SIGINT', () => db.close(() => process.exit(0)));


