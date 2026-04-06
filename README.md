# Family NFL Pick'em (MVP)

A private family-friendly NFL pick'em website built with:
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + Postgres)

## Features

- Email/password sign up + login via Supabase.
- Exactly one regular-season pick per user per week.
- Admin creates/manages seasons.
- Admin chooses season rule mode:
  - `WINNER_NO_REPEAT`: pick one winner weekly, no team repeats in regular season.
  - `LOSER`: pick one losing team weekly.
- Playoff mode allows one pick **for every playoff game**, tracked separately.
- Standings for regular season, playoffs, and overall.
- Admin enters weekly games and final results manually.
- Server-side validation in both Next.js server actions and database trigger logic.
- Seed script with sample users/teams/weeks/games/picks.

## Folder structure

```txt
.
├─ supabase/
│  ├─ schema.sql        # Full DB schema, constraints, RLS, functions, standings view
│  └─ seed.sql          # Sample data for local/manual testing
├─ src/
│  ├─ app/
│  │  ├─ actions.ts     # Server actions: picks, season creation, game result updates
│  │  ├─ admin/page.tsx
│  │  ├─ dashboard/page.tsx
│  │  ├─ login/page.tsx
│  │  ├─ picks/page.tsx
│  │  ├─ standings/page.tsx
│  │  ├─ globals.css
│  │  └─ layout.tsx
│  ├─ components/
│  │  ├─ auth-form.tsx
│  │  └─ top-nav.tsx
│  ├─ lib/
│  │  ├─ auth.ts
│  │  ├─ queries.ts
│  │  ├─ supabase/client.ts
│  │  └─ supabase/server.ts
│  ├─ middleware.ts
│  └─ types/db.ts
└─ README.md
```

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Create Supabase project

1. Create a new project in Supabase.
2. Copy your project URL and anon key.
3. Create `.env.local`:

```bash
cp .env.example .env.local
```

Fill values:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3) Apply schema + seed

In Supabase SQL Editor:
1. Run `supabase/schema.sql`
2. Run `supabase/seed.sql`

> Note: `seed.sql` inserts test users directly into `auth.users` for convenience in MVP/local setups. In production, prefer creating users through normal sign-up flows or secure admin tooling.

### 4) Run app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Database schema explanation

Core entities:
- `profiles`: app profile linked 1:1 to `auth.users`; includes `is_admin`.
- `teams`: NFL teams.
- `seasons`: one active season at a time (`one_active_season_idx` partial unique index).
- `weeks`: belongs to a season, tracks `is_playoff` and `lock_at`.
- `games`: belongs to a week, contains home/away and winner when finalized.
- `picks`: user picks. Supports:
  - regular picks (`pick_type='REGULAR'`, `game_id` null)
  - playoff picks (`pick_type='PLAYOFF'`, `game_id` required)

Important constraints:
- Unique `(user_id, week_id)` for regular picks => exactly one per week.
- Unique `(user_id, game_id)` for playoff picks => one per playoff game.
- Unique `(user_id, season_id, team_id)` for regular picks => no-repeat team rule support.
- Trigger `validate_pick_rules()` enforces lock dates and playoff/regular consistency.

Scoring:
- Function `grade_game_picks(game_id)` computes correctness from results.
  - `WINNER_NO_REPEAT`: regular pick is correct if team = winner.
  - `LOSER`: regular pick is correct if team != winner.
  - Playoff picks always score team = winner.
- `standings_view` aggregates regular/playoff/overall points.

## Tradeoffs (MVP decisions)

1. **Manual game/result entry by admin**
   - Pro: simplest and reliable for family usage.
   - Con: no automatic sync with sports APIs.

2. **Server actions + DB trigger validation**
   - Pro: defense-in-depth. UI cannot bypass rules by tampering client requests.
   - Con: logic duplicated in app and DB; more maintenance.

3. **Simple scoring (1 point per correct pick)**
   - Pro: easy to explain and audit.
   - Con: no confidence points or tie-breaker logic.

4. **Single active season**
   - Pro: UX stays focused.
   - Con: limits multi-league/multi-season concurrent usage.

## Next improvements

- Add explicit admin CRUD screens for weeks/games entry.
- Add transactional result updates + batch grade job.
- Add optimistic UI/error handling on forms.
- Add comprehensive tests (unit + integration + RLS policy tests).
- Add invitation-only sign-up flow.
