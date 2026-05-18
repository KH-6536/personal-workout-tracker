# Personal Workout Tracker

A mobile-first workout tracking app built with React, TypeScript, and Supabase.

## Features

- **Workout Splits**: Push / Pull / Legs / Upper / Lower templates with customizable exercises
- **Weekly Schedule**: Assign splits to days of the week — today's workout shows on the home screen
- **Active Workout Logging**: Log sets with weight/reps, see previous session data for progressive overload
- **Live Exercise Swapping**: Swap, add, or remove exercises mid-workout without leaving the active session
- **Workout History**: Calendar view to browse any past workout with full detail
- **Real-time Sync**: All data syncs across devices via Supabase

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend/Database**: Supabase (auth, Postgres, real-time)
- **Deployment**: Vercel
- **Styling**: Custom CSS (dark mode, mobile-first)

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd personal-workout-tracker
npm install
```

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to finish provisioning

### 3. Run the Database Migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Open and run the file `supabase/migrations/001_initial_schema.sql`
   - This creates all tables, RLS policies, indexes, and triggers

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Fill in your Supabase credentials (found in your Supabase dashboard under **Settings > API**):

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Run Locally

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

### 6. Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables in Vercel's project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Vite and builds accordingly

The `vercel.json` file handles SPA routing (all paths serve `index.html`).

---

## Environment Variables

| Variable | Description | Where to find |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Supabase Dashboard > Settings > API |

---

## Project Structure

```
├── index.html                    # Entry HTML
├── vercel.json                   # Vercel SPA routing
├── .env.example                  # Environment variable template
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Full database schema
├── src/
│   ├── main.tsx                  # App entry point
│   ├── App.tsx                   # Router + auth guard
│   ├── index.css                 # Global styles (dark theme)
│   ├── lib/
│   │   └── supabase.ts           # Supabase client
│   ├── types/
│   │   └── database.ts           # TypeScript types
│   ├── hooks/
│   │   ├── useAuth.ts            # Auth state + sign in/up/out
│   │   ├── useExercises.ts       # Exercise CRUD
│   │   ├── useTemplates.ts       # Split template management
│   │   ├── useSchedule.ts        # Weekly schedule
│   │   └── useWorkoutHistory.ts  # Session history + previous sets
│   ├── components/
│   │   ├── Layout.tsx            # Shell with bottom nav
│   │   └── LoadingSpinner.tsx    # Loading state
│   └── pages/
│       ├── AuthPage.tsx          # Login / Sign up
│       ├── HomePage.tsx          # Dashboard + Start Workout
│       ├── ActiveWorkoutPage.tsx # Live workout logging
│       ├── HistoryPage.tsx       # Calendar + session detail
│       └── TemplatesPage.tsx     # Split template editor + schedule
```

---

## Default Weekly Schedule

Once set up, configure your schedule in the **Splits** tab:

| Day | Split |
|---|---|
| Saturday | Upper |
| Sunday | Lower |
| Monday | Rest |
| Tuesday | Push |
| Wednesday | Pull |
| Thursday | Legs |
| Friday | Rest |
