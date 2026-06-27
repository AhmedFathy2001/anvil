# Anvil

**Where your clan's events get forged.** Anvil is a clan-operations platform for Old
School RuneScape that runs bingo events, weekly Skill-of-the-Week / Boss-of-the-Week
competitions, and keeps a live clan roster synced straight from the in-game clan tab
via a companion RuneLite plugin.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **Drizzle ORM** on SQLite via **libSQL / Turso**
- **Tailwind CSS 4** (custom gold/brown theme)
- **Discord OAuth** for login, **HMAC-signed tokens** for admin/captain/player sessions
- Deployed on **Vercel**; scheduled refresh jobs via `vercel.json`
- Companion **RuneLite plugin** (Java / Gradle) in `plugin/` that auto-submits drops
  and syncs the clan roster

## Repository layout

```
src/
  app/                Next.js routes (server components + API)
  components/         Shared React components
  db/                 Drizzle schema + client
  lib/                auth, discord, weekly, clan helpers
  hooks/              Client-side hooks (polling, countdowns)
  middleware.ts       Edge middleware: admin/captain/player route protection
drizzle/              Generated SQL migrations + meta snapshots
scripts/              Node scripts runnable via `npx tsx`
plugin/               RuneLite plugin sources (separate Gradle project)
```

## Prerequisites

- **Node 20+**, **npm** (or pnpm / bun — the examples below use npm)
- A **Turso** database (free tier works) — or any libSQL-compatible endpoint
- For production: a **Vercel** project with a Blob store (for screenshot uploads)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create `.env.local`** by copying `.env.example` and filling in values. Every
   variable is documented in that file. Required for local dev:
   - `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
   - `BLOB_READ_WRITE_TOKEN` (only if you'll test image uploads)
   - Session secrets can be left blank in dev — the app uses labelled
     `dev-*-secret` placeholders. They're **required in production**.

3. **Run migrations**
   ```bash
   npx drizzle-kit push
   ```
   This applies every file in `drizzle/*.sql` against the database. After any
   schema change, run `npx drizzle-kit generate` to produce a new migration file.

4. **Seed a first admin**. Login is **Discord OAuth only**. Set
   `ADMIN_DISCORD_ID` in `.env.local` to your own Discord user ID, configure the
   Discord OAuth vars (see `.env.example`), then sign in at `/login`. The first
   sign-in matching that ID is promoted to `admin`. Unset `ADMIN_DISCORD_ID`
   afterward so nobody else can self-promote. Full walkthrough in
   [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

5. **Start the dev server**
   ```bash
   npm run dev
   ```
   The app runs on `http://localhost:3000`.

## Key flows

### Admin / user management
- `/admin/users` — create moderator/admin accounts
- Moderators are restricted to `/admin/weekly*`, `/admin/clan*`, `/admin/schedule*`
- Admins can do everything

### Clan roster + plugin linking
The roster at `/admin/clan` is the source of truth for "who is in the clan".
It's populated three ways:
1. **Admin manually adds** a member from the `+ Add Manually` button.
2. **Any plugin user** who logs in gets self-registered as a guest via
   `POST /api/plugin/hello`. Admins can promote guests to members.
3. **An admin syncs** the in-game clan roster via the plugin:
   - On `/admin/clan`, click **Generate Link Code** — you get a 6-char code.
   - In RuneLite, open the Anvil plugin settings → paste the code into
     **Admin link code** → open the side panel → click **Link as admin**.
     The site issues a long-lived admin token, bound to your user account + RSN.
   - In-game, open the clan tab (so RuneLite loads the roster), then click
     **Sync clan** in the plugin side panel. The plugin POSTs the full roster
     to `/api/plugin/clan-sync`.
   - The site rejects the sync if the reported clan name doesn't match
     `Clan Settings → Clan Name` on `/admin/clan` (or `CLAN_NAME` env fallback).
     Leave the clan name blank to accept any clan.

### Bingo events
- Admins create events at `/admin/dashboard`, add tiles, teams, and players
  (`/admin/events/[id]`)
- Players enroll via a personal token link (generated per-event)
- Captains have a per-team dashboard at `/captain/[teamId]`
- The RuneLite plugin auto-submits drops for tracked item tiles

### Weekly competitions (SotW / BotW)
- Admins/mods create comps at `/admin/weekly`
- `enrollAllPlayers()` auto-enrolls every active clan member at creation time
- Plugin users with `autoEnrollWeekly` on are enrolled automatically on login
  via `POST /api/plugin/weekly/enroll`
- Two cron jobs run via Vercel cron (`vercel.json`):
  - `/api/cron/stats` at `:00` — refreshes event stat tiles
  - `/api/cron/weekly` at `:30` — refreshes weekly leaderboards
- Both cron routes require `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set

### Schedule
`/admin/schedule` shows a unified month view of bingo events + weekly comps with
an "upcoming & active" list underneath.

## Migrations

Schema lives at `src/db/schema.ts`. To add or change a column:

```bash
# Edit src/db/schema.ts, then:
npx drizzle-kit generate   # creates drizzle/NNNN_<name>.sql + updates meta
npx drizzle-kit push       # applies against the DB in env
```

Review the generated SQL — for `ALTER TABLE ... ADD NOT NULL` on existing tables,
SQLite requires a default; hand-edit the migration to include a backfill if so
(see `drizzle/0016_acoustic_hiroim.sql` for an example).

## Scripts

- `scripts/backfill-clan-members.ts` — populates `clan_members` from existing
  `players` + `weekly_participants` rows. Safe to re-run. Runs the normalize-rsn
  upsert so case variants are deduplicated.

```bash
npx tsx scripts/backfill-clan-members.ts
```

## RuneLite plugin

The plugin source lives in `plugin/`. Build with `./gradlew build`. The built
jar lands in `plugin/build/libs/`. Drop it into RuneLite's sideloaded-plugins
directory to test locally. See `plugin/README.md` for the plugin-specific
install notes and `PLUGIN_BACKLOG.md` for the shared feature backlog between
the two sessions.

## Deployment

On Vercel:
1. Import the repo.
2. Set every variable from `.env.example` in the project's **Environment Variables**
   (Production + Preview).
3. Create a Blob store and copy `BLOB_READ_WRITE_TOKEN` into the env.
4. Add your Turso database URL + auth token.
5. Deploy. On first deploy, set `ADMIN_DISCORD_ID` to your Discord user ID and
   sign in at `/login` to seed the first admin (then unset it).
6. Run migrations: `npx drizzle-kit push` (either locally with prod creds or via
   a CI step). Migrations are not auto-applied on deploy.

See [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) for the full clan-by-clan
deployment walkthrough, including non-Vercel hosting notes.

Cron jobs are declared in `vercel.json` and are scheduled automatically.

## Conventions

- API routes: async params (`{ params: Promise<{ id: string }> }`) per Next.js 16
- Dates stored as ISO UTC text strings
- Discord notifications fire-and-forget (`.catch(() => {})`)
- Gold is the accent colour. Section headers use `<span className="w-1 h-5 bg-gold rounded-full" />`.
- **No hardcoded clan-specific values.** Discord IDs/invites, the clan name,
  webhooks, and role maps are all admin-editable (`settings` table) or env-driven.

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for local
setup, the database-migration workflow, and PR guidelines.

## License

Released under the [MIT License with an Attribution requirement](LICENSE). You're
free to self-host, modify, and redistribute Anvil; the only condition is that the
**"Built by Ahmed Fathy"** credit in the site footer stays visible. The optional
"Buy me a coffee" link may be removed or replaced.

Built by [Ahmed Fathy](https://github.com/AhmedFathy2001). If Anvil saved your
clan some time, you can [buy me a coffee](https://buymeacoffee.com/ahmedfathy2001) ☕.
