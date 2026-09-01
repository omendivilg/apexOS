# Apex OS

A full-stack personal health and productivity tracker for logging biometrics, nutrition, sleep, workouts, and daily productivity — with AI-assisted goal setting and meal estimation powered by Google Gemini. **Fully dockerized** with a multi-stage build for one-command deployment.

## Features

- **Biometrics tracking** - weight and body fat over time
- **Nutrition logging** - manual meal entry or AI-estimated macros (calories, protein, carbs, fats) from a natural-language description via the Gemini API
- **Sleep & recovery** tracking
- **Workout logging** by muscle group with weekly training-volume targets
- **AI-generated monthly goals** - calorie, sleep, and target-weight targets tailored to the user's profile (age, height, sex, activity level) via Gemini
- **Daily scoring** - a composite score/verdict (good / mixed / poor) based on adherence to calorie, sleep, weight, and training goals
- **Dashboard & productivity views** for at-a-glance progress

## Tech Stack

**Backend:** Node.js, Express, SQLite3
**Frontend:** React, Vite, Tailwind CSS
**AI:** Google Gemini API (natural-language meal parsing, goal generation)
**Infrastructure:** Docker (multi-stage build), Docker Compose–ready

## Architecture

- REST API (Express) backed by a SQLite database, auto-migrating its schema on startup
- Single-page React frontend built with Vite and styled with Tailwind
- Multi-stage `Dockerfile`: the frontend is built in an isolated Node stage, then its static output is copied into a slim production image that serves both the API and the built frontend from a single container

## Running with Docker

```bash
docker build -t apex-os .
docker run -p 3000:3000 --env-file .env apex-os
```

## Running locally (without Docker)

```bash
npm run install:all   # installs backend + frontend dependencies
npm run dev            # runs backend (nodemon) and frontend (Vite) concurrently
```

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | API key for Google Gemini (enables AI meal estimation and goal generation) |
| `GEMINI_MODEL` | Optional override for the Gemini model (defaults to `gemini-2.5-flash`) |
| `PORT` | Server port (defaults to `3001` locally, `3000` in the Docker image) |
| `DB_PATH` | Optional override for the SQLite database file location |
