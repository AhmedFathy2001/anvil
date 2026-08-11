# Anvil

**Where your clan's events get forged.** Anvil is a clan-operations platform for Old
School RuneScape. It runs bingo boards and ladders, weekly Skill-of-the-Week /
Boss-of-the-Week competitions, and keeps a live clan roster synced straight from the
in-game clan tab — with a companion RuneLite plugin that submits drops, kills and stats
automatically, so nobody screenshots a boss log at 3am.

One instance serves **one clan**. Run it yourself on a small VPS
([`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md)), or [have it hosted](https://anvilosrs.com).

Questions, bug reports or setup help: **[join the Anvil Discord](https://discord.gg/p9NkrTQmxN)**.

## What it does

- **Events.** Classic N×N bingo, Leagues-style point boards, tile races, and hidden-tile
  formats (Showdown, Lucky draw, Bounty) plus a **Ladder** individual leaderboard. Boards
  can be revealed on a schedule, drawn at random, or dropped mid-event as **missions**.
- **Tiles that verify themselves.** Item drops, boss/NPC kill counts, XP and KC gains,
  timed raids (with party size and raid mode), collection-log unlocks, achievement diaries,
  combat achievements, PvP kills, LMS, loot value, and deathless runs — credited by the
  plugin as they happen, with a live in-game overlay and a 15-minute Hiscores sweep behind it.
- **Teams and drafts.** Sign-up forms, a live draft that reads each player's frozen sign-up
  answers, captains, per-team Discord channels, and a board-balance auditor that flags a
  lopsided board before you run it.
- **Weekly comps.** SotW / BotW with auto-enrollment, stale-baseline protection, and
  standings that update between sweeps.
- **Discord, everywhere.** OAuth login, role and nickname sync, rich embeds for drops,
  deaths, achievements, kills and clips, event announcements, and per-channel webhooks.
- **After the event.** Frozen contribution splits, a post-event survey, and a recap of
  superlatives (MVP, biggest drop, most kills, best rate).
- **Optional federation.** Opt into a shared directory + identity broker so members can
  reach several clans with one Discord login — your data never leaves your box.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript 5
- **Drizzle ORM** on **SQLite** (libSQL) — a local file by default, or any libSQL endpoint
- **Tailwind CSS 4** (custom gold/brown theme)
- **Discord OAuth** for login; HMAC-signed cookies for admin/captain/player sessions
- Ships as a **single Docker image** (Next.js standalone) that migrates its own schema on boot
- Media (proof screenshots) via an **S3/R2** adapter, or Vercel Blob on the serverless path
- Companion **RuneLite plugin** (Java / Gradle) in a
  [separate repo](https://github.com/AhmedFathy2001/anvil-plugin)

## Repository layout

```
src/
  app/                Next.js routes — pages, /api, /admin, /guide
  components/         Shared React components
  db/                 Drizzle schema + client
  lib/                auth, discord, weekly, stats, events, federation, storage…
  hooks/              Client-side hooks (live refresh, countdowns)
  middleware.ts       Edge middleware: role-gated /admin routing
drizzle/              Generated SQL migrations + meta snapshots (the source of truth)
scripts/              Boot migrator, dataset builders, one-off maintenance scripts
docs/                 Self-hosting, plugin setup, wire contracts, tile authoring
tests/                node:test suites (`npm run test:*`)
```

## Run it

### With Docker (what production runs)

```bash
docker build -t anvil:local .
docker volume create anvil-data
docker run -d --name anvil --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v anvil-data:/data \
  --env-file .env \
  anvil:local
```

The database is a SQLite file on the volume (`DATABASE_URL=file:/data/anvil.db`, already
set in the image) and **migrations apply automatically on container start** — a fresh
volume becomes a complete schema, and a migration failure aborts boot rather than serving a
half-built one. Put it behind a reverse proxy for TLS, schedule the cron routes, and you're
done: [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) has the full walkthrough (compose +
Caddy, Discord app, storage, backups, troubleshooting).

### Local development

**Prerequisites:** Node 22 (what CI and the image use), npm.

```bash
npm install
cp .env.example .env.local     # every variable is documented in the file
npm run db:migrate             # builds ./local.db from the migration chain
npm run dev                    # http://localhost:3000
```

For local dev you mainly need `DATABASE_URL` (defaults to `file:./local.db`) and the
Discord OAuth vars. Session secrets fall back to labelled `dev-*` placeholders in
development and are **required in production**.

To seed the first admin, set `ADMIN_DISCORD_ID` to your Discord user ID and sign in at
`/login` — the first sign-in matching that ID becomes `admin` (and the instance owner).
Unset it afterwards.

## Key flows

### Roles and the admin panel
`admin` > `treasurer` > `moderator` > `member`, plus `editor` for tile authoring (global,
or scoped to specific boards via per-event grants). Middleware gates `/admin` pages by
role; every API route re-checks the live role from the DB. Staff are managed at
`/admin/clan/staff`, and `/admin/setup` is a guided checklist for a new instance.

### Clan roster + plugin linking
The roster at `/admin/clan` is the source of truth for "who is in the clan". Membership
comes from:
1. **An in-game roster sync.** On `/admin/clan`, click **Generate Link Code**, paste the
   6-char code into the plugin's **Admin link code**, then **Link as admin** in the side
   panel. Open the clan tab in game and click **Sync clan** — the plugin POSTs the full
   roster to `/api/plugin/clan-sync`. The site rejects the push if the reported clan name
   doesn't match **In-game clan name** in Clan Settings (blank = accept any clan).
2. **An admin adding a member by hand.**

Anyone who merely links the plugin or verifies an RSN lands as a **guest** until promoted —
verification alone never grants membership.

### Events
Admins create events from `/admin/events/new` (format-first wizard) and manage each one
through its tabs: `/admin/events/[eventId]{,/tiles,/teams,/signups,/stats,/survey,/payouts}`. Tiles can be
authored in the UI, imported from CSV/`.xlsx` ([`docs/tile-authoring.md`](docs/tile-authoring.md)),
or pulled from the shared task library. Members live at `/team`; captains get
`/captain/[teamId]`.

### Weekly competitions (SotW / BotW)
Created at `/admin/weekly`; every active clan member is enrolled at creation, and plugin
users with `autoEnrollWeekly` are enrolled on login. Values come from the same 15-minute
Hiscores sweep that feeds stat tiles.

### Scheduled jobs
Four routes must be hit on a schedule — nothing calls them for you:

| Route | Cadence | Does |
| --- | --- | --- |
| `/api/cron/stats` | every 15 min | Unified Hiscores sweep: event stat tiles + weekly values |
| `/api/cron/weekly` | every 15 min | Weekly competition lifecycle |
| `/api/cron/flush-notifications` | every minute | Drains queued Discord posts |
| `/api/cron/backup` | daily | Off-box DB backup (no-op unless configured) |

All require `Authorization: Bearer $CRON_SECRET`, and all return **500 in production if
`CRON_SECRET` is unset**. The repo ships no `vercel.json` — use system cron, systemd timers,
or your platform's scheduler. See [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md#5-schedule-the-background-jobs).

## Migrations

The chain in `drizzle/` is the source of truth and **must always apply cleanly from `0000`
against an empty database** — every fresh instance boots by replaying it. Schema lives in
`src/db/schema.ts`.

```bash
# Edit src/db/schema.ts, then:
npm run db:generate   # creates drizzle/NNNN_<name>.sql + updates drizzle/meta
npm run db:migrate    # applies the chain (NOT drizzle-kit push)
```

Commit the generated SQL and `drizzle/meta/` alongside the schema change. Verify against a
fresh DB (`DATABASE_URL=file:/tmp/fresh.db npm run db:migrate` → `up to date`), then re-run
`npm run db:generate` (must print *"No schema changes"*). **Never `db:push` a database you
intend to keep** — it drifts the DB out of sync with `drizzle/` and breaks future migrate
runs. Full policy: [CONTRIBUTING.md](CONTRIBUTING.md#database-changes).

## Scripts

Run with `npx tsx` (`.ts`) or `node` (`.mjs`); each loads `.env` / `.env.local` itself.

- `npm run db:migrate` — apply the migration chain (this is what the container runs on boot)
- `npm run data:clog` / `data:ca` / `data:rates` / `data:efficiency` — rebuild the bundled
  wiki-derived datasets
- `npm run test:events` / `test:embeds` / `test:federation` / `test:recap` — node:test suites
- `scripts/backfill-clan-members.ts` — populate `clan_members` from legacy `players` /
  `weekly_participants` rows (idempotent)
- `scripts/prune-player-snapshots.ts` — trim historical hiscores snapshots
- `scripts/bootstrap-migrations-table.ts --mark-all` — one-time reconcile for a pre-migration
  `db:push` database

## Versioning

Semver, reported at `GET /api/version` (version, exact build commit, plugin API level and
capabilities) and shown in the site footer. The plugin gates features on **capabilities**, never
on version comparison, so an older self-hosted site keeps working with the always-latest
Hub plugin — it just doesn't show newer features. Contract:
[`docs/PLUGIN_WIRE.md`](docs/PLUGIN_WIRE.md).

## Documentation

| Doc | What's in it |
| --- | --- |
| [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) | Standing up your own instance, end to end |
| [`docs/PLUGIN_SETUP.md`](docs/PLUGIN_SETUP.md) | The member-facing plugin walkthrough |
| [`docs/tile-authoring.md`](docs/tile-authoring.md) | CSV / spreadsheet tile authoring spec |
| [`docs/PLUGIN_WIRE.md`](docs/PLUGIN_WIRE.md) | Site ↔ plugin contract and compatibility rules |
| [`docs/ECOSYSTEM.md`](docs/ECOSYSTEM.md) | Joining the optional federation network |
| [`docs/FEDERATION*.md`](docs/FEDERATION.md) | Federation design, wire spec, security model |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Local setup, migration workflow, PR process |

Your own instance also serves in-app guides at `/guide/plugin` and `/guide/admin`, prefilled
with your domain — those are the links to hand your clan.

## Conventions

- API routes use async params (`{ params: Promise<{ id: string }> }`) per Next.js 16
- Dates stored as ISO UTC text strings
- Discord notifications are fire-and-forget (`.catch(() => {})`)
- Gold is the accent colour; section headers use `<span className="w-1 h-5 bg-gold rounded-full" />`
- **No hardcoded clan-specific values.** Clan names, Discord IDs/invites, webhooks and role
  maps live in the `settings` table (admin-editable) or in env as first-boot fallbacks.

## Contributing

Contributions land on **`beta`** first and are promoted to `main` after baking on canary
clans — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for local setup, the migration workflow,
and PR guidelines.

## Managed hosting & support

Don't want to run the infrastructure yourself? I **host and maintain Anvil for your clan** —
your own instance on your own subdomain, provisioned automatically, no servers to touch.
Plans start with a 30-day free trial at [anvilosrs.com](https://anvilosrs.com), and paying
for hosting is what funds continued development. Questions?
[Come say hi on Discord](https://discord.gg/p9NkrTQmxN).

## License

Released under the [PolyForm Noncommercial License 1.0.0 with an Attribution
requirement](LICENSE). Anvil is **source-available, not open source**: you're free to
self-host, modify, and redistribute it for **noncommercial** use — running it for your own
clan is explicitly permitted, including collecting contributions from your own members to
cover hosting. Two conditions: the **"Built by Ahmed Fathy"** credit in the site footer
stays visible, and you may not offer Anvil (or a service based on it) to third parties for a
fee — that includes reselling it as hosting. Want a commercial licence? Get in touch.

Built by [Ahmed Fathy](https://github.com/AhmedFathy2001). If Anvil saved your clan some
time, the best support is [hosting with me](https://anvilosrs.com) 🔨.
