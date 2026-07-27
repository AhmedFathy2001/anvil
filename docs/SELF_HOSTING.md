# Self-hosting Anvil

This guide walks a clan through standing up its **own** Anvil instance from
scratch. Anvil is single-tenant: one deployment serves one clan. To run Anvil for
several clans, deploy it once per clan (each with its own database and Discord app).

> **Scope:** this source-available project is the **clan app** (and the shared RuneLite
> plugin). The automated billing + multi-clan provisioning **control plane** that
> powers the paid hosted service (`anvilosrs.com`) is a separate, **proprietary**
> app and is *not* part of what you self-host. Self-hosting means running the clan
> app yourself, one instance per clan — exactly what the hosted service runs for you,
> minus the automation around it.

> **Don't want to self-host?** I can run and maintain Anvil for your clan for a fee —
> no infrastructure to manage on your end. [Reach out on Discord](https://discord.gg/nqTxCQAbv4)
> if you'd rather have it hosted for you (or just want to support the project).

## Choose a hosting path

Anvil runs the same either way — pick the one that fits you:

- **A · Dedicated VPS with Docker** (recommended) — one container + a local SQLite
  file + Cloudflare R2 for media. Full control, predictable cost, no per-request
  pricing. Jump to [**Self-hosting with Docker**](#self-hosting-with-docker), then
  do the shared **Discord** (§3) and **admin bootstrap** (§6) steps.
- **B · Serverless on Vercel + Turso** — zero servers to manage, generous free
  tiers. Follow steps **§2–§8** below.

Either way you'll need a **Discord application** (login; optionally a bot for role
sync) and your clan's Discord server. The **plugin** setup (§8) is identical.

> Config note: clan-specific settings (clan name, Discord invite, webhooks, role
> maps) live in the in-app admin UI (`settings` table) — env vars are only first-boot
> fallbacks. Nothing clan-specific is hardcoded.

---

## 1. Prerequisites

For **A (Docker/VPS)**: a Linux box with Docker, a domain, and a Cloudflare R2 (or
any S3-compatible) bucket for media. For **B (serverless)**: a **GitHub** account
(fork this repo), a **[Vercel](https://vercel.com)** account, and a
**[Turso](https://turso.tech)** account (free tier is plenty). Both paths need a
**Discord application** and your clan's Discord server.

---

## 2. Create the database (Turso)

```bash
# Install the Turso CLI, then:
turso db create my-clan-anvil
turso db show my-clan-anvil --url          # -> TURSO_DATABASE_URL
turso db tokens create my-clan-anvil       # -> TURSO_AUTH_TOKEN
```

Keep both values for the env config below.

---

## 3. Create the Discord application (login)

1. Go to <https://discord.com/developers/applications> → **New Application**.
2. **OAuth2 → General**:
   - Copy the **Client ID** → `DISCORD_CLIENT_ID`.
   - **Reset Secret**, copy it → `DISCORD_CLIENT_SECRET`.
   - Under **Redirects**, add your callback URL and set it as
     `DISCORD_REDIRECT_URI`:
     - Production: `https://your-domain.com/api/auth/discord/callback`
     - Local dev: `http://localhost:3000/api/auth/discord/callback`
   - The URL must match `DISCORD_REDIRECT_URI` **exactly**.
3. OAuth2 scope used by the app is `identify` (email optional).

### Optional: Discord bot (role + nickname sync, team channels)

1. **Bot** tab → **Reset Token** → `DISCORD_BOT_TOKEN`.
2. **OAuth2 → URL Generator**: scopes `bot`, permissions **Manage Roles**
   (and **Manage Channels** / **Manage Nicknames** if you want team channels and
   nickname sync). Open the generated URL to add the bot to your server.
3. In Discord **Server Settings → Roles**, drag the bot's role **above** every
   role it should manage (Discord hierarchy rule).
4. The rest is configured in-app at `/admin/integrations` and `/admin/clan` — no
   redeploy needed.

---

## 4. Configure environment variables

Copy `.env.example` to `.env.local` (local) or set these in **Vercel → Project →
Settings → Environment Variables** (production). Every variable is documented in
`.env.example`; the essentials:

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Yes | Database connection |
| `ADMIN_SESSION_SECRET`, `CAPTAIN_SESSION_SECRET`, `PLAYER_SESSION_SECRET` | Yes (prod) | Session signing — generate random 32-byte hex each |
| `CODEWORD_SECRET` | Yes (prod) | Rotating plugin verification codeword |
| `CRON_SECRET` | Recommended | Protects the cron endpoints |
| `BLOB_READ_WRITE_TOKEN` | Yes for uploads | Vercel Blob (drop-proof screenshots) |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | Yes | Discord login |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | Optional | Role/nickname/channel sync |
| `ADMIN_DISCORD_ID` | First run | Seeds your first admin (see below) |
| `CLAN_NAME` | Optional | Fallback clan name (prefer the admin UI) |
| `DISCORD_INVITE_URL` | Optional | Fallback Discord invite (prefer the admin UI) |
| `DISCORD_MEMBER_ROLE_ID` | Optional | Fallback member-ping role (prefer the admin UI) |
| `SENTRY_DSN` | Optional | Error reporting (requires `npm i @sentry/nextjs`) |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Settings vs env:** clan-specific things like the Discord invite, member-ping
> role, webhooks, role maps and clan name are all editable in the **admin UI**
> (stored in the `settings` table). The matching env vars are just fallbacks for
> first boot. Nothing clan-specific is hardcoded in the source.

---

## 5. Apply database migrations

With your production (or local) database creds in the environment, replay the
committed migration chain:

```bash
npm run db:migrate
```

This applies `drizzle/` from `0000` onward, creating every table, index, and
trigger. It is idempotent and safe to re-run — already-applied migrations are
skipped via the `__drizzle_migrations` ledger. The Docker image runs this same
command automatically on container start (see §7), so a containerised deploy needs
nothing here.

> **Don't use `db:push` to provision or upgrade a real database.** It bypasses the
> migration ledger and drifts the DB out of sync with `drizzle/`, which breaks future
> `db:migrate` runs. `db:push` is for throwaway local scratch DBs only.

---

## 6. Deploy

### On Vercel (recommended)

1. **Import** your fork in the Vercel dashboard.
2. Set all the env vars from step 4 (Production + Preview).
3. **Storage → Blob**: create a Blob store and copy its token into
   `BLOB_READ_WRITE_TOKEN`.
4. Deploy.
5. Schedule the refresh routes (see [§ Cron / scheduled refreshes](#cron--scheduled-refreshes)
   below). On Vercel, add a `vercel.json` with `crons` entries; the repo no longer
   ships one because the reference deployment drives crons from an external
   dispatcher. Recommended cadence:
   - `/api/cron/stats` (every ~15 min) — refreshes event stat tiles + weekly
     values from the OSRS Hiscores in one sweep.
   - `/api/cron/weekly` (every 15 min) — weekly SotW/BotW lifecycle.
   - `/api/cron/flush-notifications` (every minute) — drains queued Discord posts.
   Each requires `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.

### Bootstrap your first admin

1. Set `ADMIN_DISCORD_ID` to **your own Discord user ID** (enable Developer Mode
   in Discord → right-click your name → Copy User ID).
2. Visit `/login` and sign in with Discord. The first sign-in matching that ID is
   promoted to `admin`.
3. **Remove `ADMIN_DISCORD_ID`** afterward so nobody else can self-promote.
4. You can now manage other admins/moderators from the admin panel.

> Login is **Discord OAuth only** — there is no username/password flow.

---

## 7. Configure your instance in the admin UI

- `/admin/clan` → **Clan Settings**: set your **Clan Name** (the plugin's
  clan-sync rejects roster pushes whose in-game clan name doesn't match; leave
  blank to accept any clan).
- `/admin/integrations`:
  - **Clan identity**: your **Discord invite URL** and **member-ping role ID**.
  - **Webhooks**: paste channel webhook URLs for clan updates, bingo, weekly,
    sign-ups, and the plugin notification channels (rare drops, deaths, combat
    achievements, PvP kills, clips).
  - Optional: role/nickname sync, team channels, tier bands, taunt lines.

---

## 8. Point the RuneLite plugin at your instance

The companion plugin is published to the RuneLite Plugin Hub as **Anvil** (one
shared plugin serves every clan; you don't publish your own). Your members:

1. Install **Anvil** from the RuneLite Plugin Hub.
2. In **RuneLite → Configuration → Anvil → Site URL**, enter your instance's URL
   (e.g. `https://your-domain.com`, no trailing slash). **This is required for
   self-hosters** — the field ships **empty** (there is no built-in default
   pointing at any reference instance), so every member of a self-hosted clan
   must set it to your domain.
3. Paste their **Account Token** (Profile → Plugin on your site → Reveal → Copy).
   One token works across every event they're signed up for. After that they just
   play — the account they log in on links to their profile automatically.

See [`PLUGIN_SETUP.md`](./PLUGIN_SETUP.md) for the full member walkthrough, the
"is it working?" signals, and troubleshooting.

If you'd rather ship a build that defaults **Site URL** to your own domain (so
members don't have to type it), change the `apiUrl()` default in
`Anvil.Plugin/src/main/java/com/anvil/AnvilConfig.java` and rebuild with
`./gradlew build` (see `docs/PLUGIN_SUBMISSION.md` for Hub publishing). Note this
means running your own Hub listing rather than the shared **Anvil** plugin.

---

## Self-hosting with Docker

Anvil ships a `Dockerfile` that builds a self-contained image (Next.js standalone
output) — the recommended path for running on your own box (Hetzner, a VPS, etc.).

```bash
docker build -t anvil .
docker run -d --name my-clan \
  -p 3000:3000 \
  -v /srv/my-clan/data:/data \                # SQLite DB lives here (file:/data/anvil.db)
  --env-file .env \                            # secrets + S3/R2 + Discord config
  anvil
```

- **Database.** Defaults to a local SQLite file at `file:/data/anvil.db` (WAL mode,
  on the mounted volume). Override `TURSO_DATABASE_URL` to point at remote Turso.
- **Migrations are applied automatically on container start** (`scripts/migrate.mjs`
  runs before the server). A migration failure aborts boot rather than serving a
  half-built schema — no manual schema step needed for a fresh instance.
- **Media storage.** Set `STORAGE_DRIVER=s3` plus the `S3_*` vars to send drop-proof
  screenshots + fee proofs to Cloudflare R2 (or any S3-compatible store). See
  `.env.example`. Leave it unset on Vercel to use `@vercel/blob`.
- **Back up the SQLite file.** Snapshot the `/data` volume, or run **Litestream**
  alongside the container to stream the DB continuously to R2.

> **Reconciling an existing `db:push` database** (e.g. an early Vercel + Turso install
> set up before the migration chain existed). It has no `__drizzle_migrations` ledger,
> so `db:migrate` would try to recreate tables it already has and fail. Reconcile it
> **once** before switching onto `db:migrate`:
>
> 1. Confirm the live schema already matches `src/db/schema.ts` (`npx drizzle-kit check`).
> 2. Stamp the squashed `0000_init` baseline as already-applied, with prod creds in env:
>    ```bash
>    npx tsx scripts/bootstrap-migrations-table.ts --mark-all
>    ```
>    This creates the `__drizzle_migrations` ledger and records the baseline as done.
> 3. From then on `db:migrate` runs only *future* migrations. Fresh instances need none
>    of this — they migrate from `0000` cleanly.

## Cron / scheduled refreshes

Anvil has three refresh routes that must be hit on a schedule — nothing calls them
for you:

| Route | Cadence (recommended) | Does |
| --- | --- | --- |
| `/api/cron/stats` | every ~15 min | One Hiscores sweep: refreshes event stat tiles **and** weekly SotW/BotW values (one fetch per member). |
| `/api/cron/weekly` | every 15 min | Weekly competition lifecycle (open/close/enrollment/rename review). Stat *values* come from the stats sweep, not here. |
| `/api/cron/flush-notifications` | every minute | Drains queued Discord webhook posts. |

Send `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set. Any scheduler
works — system cron, GitHub Actions, a Kubernetes CronJob, or (on Vercel) a
`vercel.json` `crons` block. There is also a `/api/cron/backup` route for off-box
DB snapshots if you want them.

> How the hosted fleet does it (for reference — this control plane is proprietary
> and not something you run when self-hosting): a single every-minute host cron
> POSTs to it, and it decides per minute which clans + jobs are due
> — stats staggered across the hour, weekly across each 15-min window, flush every
> minute — and enqueues them on a governed worker pool. You don't need any of that
> for one instance; a plain crontab is fine.

All Discord integrations work from any host.

## Joining the Anvil ecosystem (optional)

Your instance is fully standalone, but you can opt into the shared network at
`anvilosrs.com` — a **directory + identity broker** (not a data server) that lets
members and other clans discover your instance and, optionally, connect to several
clans with one Discord login. Your board and player data never leave your box. See
[`ECOSYSTEM.md`](./ECOSYSTEM.md) for how to register and prove domain ownership.
