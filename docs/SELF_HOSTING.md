# Self-hosting Anvil

This guide walks a clan through standing up its **own** Anvil instance from scratch.
Anvil is single-tenant: **one deployment serves one clan**, with its own database and
its own Discord app. To run it for several clans, run it once per clan.

The supported shape is **one Docker container on a small VPS, with a SQLite file on a
mounted volume**. There is no database server to install, no managed DB to sign up for,
and no build step at deploy time — the container migrates its own schema on boot.

> **Scope:** this source-available project is the **clan app** (plus the shared RuneLite
> plugin). The billing + multi-clan provisioning **control plane** that powers the paid
> hosted service (`anvilosrs.com`) is a separate, **proprietary** app and is *not* part of
> what you self-host. Self-hosting means running the clan app yourself, one instance per
> clan — exactly what the hosted service runs for you, minus the automation around it.

> **Don't want to self-host?** I run and maintain Anvil for clans for a fee — no
> infrastructure on your end. [Reach out on Discord](https://discord.gg/p9NkrTQmxN) if
> you'd rather have it hosted (it's also what funds development).

---

## 1. What you need

| | |
| --- | --- |
| **A Linux box with Docker** | Anything from a €4/mo VPS up. One clan comfortably fits in 1 vCPU / 1 GB RAM. |
| **A domain** (or subdomain) | e.g. `bingo.yourclan.com`, pointed at the box. Discord OAuth needs a real HTTPS URL. |
| **A Discord application** | Free. Used for login, and optionally a bot for role/nickname sync and team channels. |
| **An S3-compatible bucket** | Only if you want **proof screenshots and fee proofs**. Cloudflare R2 (free egress) is the recommendation. Everything else works without it. |

You do **not** need: a managed database, Vercel, Turso, a Redis, or a queue.

> **Config note:** clan-specific settings (clan name, Discord invite, webhooks, role
> maps, tier bands) live in the in-app admin UI (the `settings` table). Env vars are only
> first-boot fallbacks. Nothing clan-specific is hardcoded.

---

## 2. Create the Discord application

1. Go to <https://discord.com/developers/applications> → **New Application**.
2. **OAuth2 → General**:
   - Copy the **Client ID** → `DISCORD_CLIENT_ID`.
   - **Reset Secret**, copy it → `DISCORD_CLIENT_SECRET`.
   - Under **Redirects**, add your callback URL and use the same value for
     `DISCORD_REDIRECT_URI`:
     - Production: `https://your-domain.com/api/auth/discord/callback`
     - Local dev: `http://localhost:3000/api/auth/discord/callback`
   - It must match **exactly** — scheme, host, and path.
3. The OAuth scope the app uses is `identify` (email optional).

### Optional: the Discord bot (role + nickname sync, team channels, auto-webhooks)

1. **Bot** tab → **Reset Token** → `DISCORD_BOT_TOKEN`.
2. **OAuth2 → URL Generator**: scope `bot`, permissions **Manage Roles** (plus **Manage
   Channels** for team channels, **Manage Nicknames** for RSN nickname sync, **Manage
   Webhooks** if you want Anvil to create its own webhooks). Open the generated URL to
   add the bot to your server.
3. In **Server Settings → Roles**, drag the bot's role **above** every role it manages
   (Discord hierarchy rule).
4. Everything else is configured in-app at `/admin/integrations` and `/admin/clan` — no
   redeploy needed.

---

## 3. Write your `.env`

Copy [`.env.example`](../.env.example) — every variable is documented there. On the box,
keep it next to your compose file (e.g. `/opt/anvil/.env`, mode `600`).

The essentials:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Defaulted | SQLite file. The image already sets `file:/data/anvil.db`; only set this if you want a different path or a remote libSQL endpoint. |
| `DATABASE_AUTH_TOKEN` | Remote DB only | Auth token for a remote libSQL/Turso endpoint. Not used by a local `file:` DB. |
| `ADMIN_SESSION_SECRET`, `CAPTAIN_SESSION_SECRET`, `PLAYER_SESSION_SECRET` | **Yes** | Session signing. The app throws on first request if any is missing in production. |
| `CODEWORD_SECRET` | **Yes** | Rotating 6-char plugin verification codeword. |
| `CRON_SECRET` | **Yes** | Bearer secret for the scheduled routes. In production the cron routes return **500** until it's set — they are not optional-auth. |
| `APP_URL` | Recommended | Your public origin (`https://your-domain.com`). Used for absolute links and the in-app setup guides. Falls back to the origin of `DISCORD_REDIRECT_URI`. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | **Yes** | Discord login. |
| `ADMIN_DISCORD_ID` | First run | Seeds your first admin, then remove it (see §6). |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | Optional | Role / nickname / channel sync. |
| `STORAGE_DRIVER`, `S3_*` | For uploads | Proof screenshots + fee proofs. See §7. |
| `S3_BACKUP_BUCKET` | Recommended | Private bucket for the daily off-box DB backup. See §9. |
| `CLAN_NAME`, `CLAN_INGAME_NAME`, `DISCORD_INVITE_URL`, `DISCORD_MEMBER_ROLE_ID` | Optional | First-boot fallbacks for values you'd otherwise set in the admin UI. |

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Settings vs env:** the Discord invite, member-ping role, webhooks, role maps and clan
> name are all editable in the **admin UI** (stored in the `settings` table). The matching
> env vars are only read when the DB setting is unset.

---

## 4. Run it

### Build the image

CI publishes prebuilt images to GHCR for the hosted fleet
(`ghcr.io/ahmedfathy2001/anvil-site`), but that package is **not public yet** — for now,
self-hosters build from source. It's one command and takes a couple of minutes:

```bash
git clone https://github.com/AhmedFathy2001/anvil.git
cd anvil
docker build -t anvil:local .
```

The build needs **no secrets** — they're all injected at runtime.

> When that package is published publicly you'll be able to skip the build and pull a
> pinned tag instead — the tag scheme CI already produces is `:1.2.3` (exact release),
> `:1.2` (latest patch of a minor), `:stable` (what the hosted fleet runs) and
> `:sha-<commit>` (immutable). Substitute it for `anvil:local` below.

### Option A — `docker run`

```bash
docker volume create anvil-data

docker run -d --name anvil \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v anvil-data:/data \
  --env-file /opt/anvil/.env \
  anvil:local
```

That's the whole database story: `/data/anvil.db` inside a Docker volume, WAL mode, one
file. Use a **named volume** rather than a bind mount — the container runs as uid `1001`,
and a root-owned host directory will be unwritable. If you do want a bind mount, create it
first and `chown -R 1001:1001 /srv/anvil/data`.

**Migrations run automatically on container start** (`scripts/migrate.mjs` executes before
the server). A fresh volume is built from `0000` into a complete schema; an existing one
gets only what it's missing. A migration failure **aborts boot** rather than serving a
half-built schema.

### Option B — Docker Compose (recommended: adds TLS)

`/opt/anvil/docker-compose.yml`:

```yaml
services:
  anvil:
    image: anvil:local          # or: build: .
    restart: unless-stopped
    env_file: ./.env
    volumes:
      - anvil-data:/data        # SQLite lives here (file:/data/anvil.db)
    expose:
      - "3000"

  caddy:                        # automatic HTTPS; skip if you already run a proxy
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config

volumes:
  anvil-data:
  caddy-data:
  caddy-config:
```

`/opt/anvil/Caddyfile`:

```caddyfile
bingo.yourclan.com {
	encode zstd gzip
	reverse_proxy anvil:3000
}
```

Then:

```bash
docker compose up -d
docker compose logs -f anvil     # look for "[migrate] up to date"
```

Point your domain's A/AAAA record at the box first — Caddy issues the certificate on the
first request. Behind any other proxy (nginx, Traefik, Cloudflare Tunnel), just forward to
port 3000 and pass through the `Host` header.

`GET /api/version` is a cheap, unauthenticated liveness probe — it returns the semver, the
exact build commit, and the plugin API capabilities this instance speaks.

---

## 5. Schedule the background jobs

**Nothing calls these for you.** Without them, stat tiles never refresh, weekly comps never
open or close, and queued Discord posts never send.

| Route | Cadence | Does |
| --- | --- | --- |
| `/api/cron/stats` | every 15 min | One Hiscores sweep: refreshes event stat tiles **and** weekly SotW/BotW values (one fetch per member). Self-bounded — it works oldest-first within a time budget and picks up where it left off. |
| `/api/cron/weekly` | every 15 min | Weekly competition lifecycle (open / close / enrollment / rename review). Stat *values* come from the stats sweep, not here. |
| `/api/cron/flush-notifications` | every minute | Drains queued Discord webhook posts. |
| `/api/cron/backup` | daily | Off-box DB backup. No-op (200) unless `S3_BACKUP_BUCKET` is configured. |

All four require `Authorization: Bearer $CRON_SECRET`, and all four **fail with 500 in
production if `CRON_SECRET` is unset**.

A plain crontab on the box is fine (`crontab -e`):

```cron
CRON_SECRET=your-cron-secret-here
SITE=https://bingo.yourclan.com

*/15 * * * * curl -fsS -m 300 -H "Authorization: Bearer $CRON_SECRET" $SITE/api/cron/stats  > /dev/null
*/15 * * * * curl -fsS -m 120 -H "Authorization: Bearer $CRON_SECRET" $SITE/api/cron/weekly > /dev/null
*   * * * * curl -fsS -m 60  -H "Authorization: Bearer $CRON_SECRET" $SITE/api/cron/flush-notifications > /dev/null
17  4 * * * curl -fsS -m 600 -H "Authorization: Bearer $CRON_SECRET" $SITE/api/cron/backup  > /dev/null
```

Any scheduler works — systemd timers, GitHub Actions, a Kubernetes CronJob, an uptime
pinger with custom headers.

> How the hosted fleet does it (reference only — this control plane is proprietary and not
> something you run): one every-minute host cron POSTs to the control plane, which decides
> per minute which clans and jobs are due — stats staggered across the hour, weekly across
> each 15-minute window, flush every minute — and enqueues them on a governed worker pool.
> You need none of that for one instance.

---

## 6. Bootstrap your first admin

Login is **Discord OAuth only** — there is no username/password flow.

1. Set `ADMIN_DISCORD_ID` to **your own Discord user ID** (Discord → Settings → Advanced →
   Developer Mode, then right-click your name → Copy User ID) and restart the container.
2. Visit `/login` and sign in with Discord. The first sign-in matching that ID is promoted
   to `admin`.
3. **Remove `ADMIN_DISCORD_ID`** and restart, so nobody else can self-promote.
4. Manage everyone else from `/admin/clan/staff`.

The first admin is also stamped as the instance **owner** — an undemotable flag that only
transfers deliberately, so an instance can never be left with nobody in charge.

---

## 7. Media storage (proof screenshots)

Uploads go through one adapter (`src/lib/storage.ts`) with two drivers:

- **`s3`** — any S3-compatible store. **This is the self-host path.** Cloudflare R2 is the
  recommendation (free egress).
- **`vercel-blob`** — `@vercel/blob`, for the Vercel path only.

Selection: `STORAGE_DRIVER` if set, otherwise auto — `s3` when `S3_BUCKET` is set, else
Vercel Blob. **With neither configured, the site runs fine but every image upload fails**
(drop proofs, fee proofs, clip screenshots). Set these:

```dotenv
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_BUCKET=my-clan-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=auto
S3_PUBLIC_BASE_URL=https://media.yourclan.com    # R2 custom domain or r2.dev URL
```

The media bucket must be **publicly readable** (image URLs are stored in the DB and
rendered in the browser). Keep it separate from the backup bucket in §9, which must stay
private.

---

## 8. Configure your instance in the admin UI

`/admin/setup` is a guided checklist that walks through the below; the direct routes:

- `/admin/clan` → **Clan Settings**: two independent names.
  - **Display name** — what the site, plugin sidebar and Discord posts call your clan.
    Rename it whenever you like.
  - **In-game clan name** — the exact OSRS clan name. The plugin's clan-sync rejects roster
    pushes whose reported clan name doesn't match it; leave it blank to accept any clan.
- `/admin/integrations`:
  - **Clan identity**: Discord invite URL and member-ping role ID.
  - **Webhooks**: channel webhook URLs for clan updates, bingo, weekly, sign-ups, and the
    plugin notification channels (rare drops, deaths, combat achievements, PvP kills,
    clips, achievements). With the bot's **Manage Webhooks** permission, Anvil can create
    them for you instead.
  - Optional: role/nickname sync, team channels, tier bands, taunt lines.

**Roster membership** comes from the in-game clan roster sync (an admin links the plugin as
admin on `/admin/clan`, opens the clan tab in game, and clicks **Sync clan**) or from adding
members by hand. Anyone who just links the plugin lands as a **guest** until you promote
them — verifying an account never grants membership on its own.

---

## 9. Backups and restore

Three layers, in increasing durability:

1. **Pre-migration snapshots (automatic).** Before applying any pending migration, the boot
   migrator writes a consistent `VACUUM INTO` copy next to the DB
   (`/data/anvil.db.premigrate-<timestamp>`), keeping the newest 3
   (`MIGRATE_SNAPSHOT_KEEP`). Same volume — this covers a bad migration, not a dead box.
2. **Off-box daily backup (recommended).** Point `/api/cron/backup` at a **private**
   bucket and it uploads a gzipped, point-in-time-consistent copy each day, pruned to
   `BACKUP_RETAIN` (default 14). It reuses `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` /
   `S3_SECRET_ACCESS_KEY` and needs `S3_BACKUP_BUCKET` set to a bucket that is **not** your
   public media bucket. Missing config = feature off (the route returns 200 and does
   nothing); it also no-ops on a remote DB.
3. **Continuous replication (optional).** Run **Litestream** alongside the container to
   stream the SQLite file to object storage continuously.

**Restore:** stop the container, `gunzip` the backup over `/data/anvil.db` (remove any
stale `-wal` / `-shm` siblings), start it again. It's a standalone SQLite file — the boot
migrator applies anything newer on next start.

---

## 10. Updating

Anvil follows **semver**; `GET /api/version` reports the running version, the exact build
commit, and the plugin capabilities this instance speaks — the same values shown in the
footer. Quote them when reporting a bug.

```bash
cd anvil && git pull
docker build -t anvil:local .
docker compose up -d anvil       # or: docker rm -f anvil && docker run ... (same volume)
```

Track the **`main`** branch. Changes land on `beta` first and are promoted to `main` only
after baking on canary clans, so `main` is the tested line.

- **Back up first** (§9) — one gzip is enough.
- **Pending migrations run automatically on boot;** a failure aborts boot rather than
  serving a half-built schema.
- **Migrations are forward-only.** Rolling back means restoring the pre-upgrade DB and
  starting the old build — never run an older build against a newer database.
- Skipping versions is fine (the chain replays), but skim the release notes in between:
  breaking changes and plugin-API notes are called out there.

**Staying compatible with the plugin:** members install the shared Anvil plugin from the
RuneLite Hub, which is always the latest version. The plugin gates features on the
**capabilities** your site advertises, never on version comparison (see
[`PLUGIN_WIRE.md`](./PLUGIN_WIRE.md)) — so an older site keeps working, it just doesn't
show newer features. Staying within ~2 minor versions of current is the supported window;
update at least a couple of times a year.

---

## 11. Point the RuneLite plugin at your instance

The companion plugin is published to the RuneLite Plugin Hub as **Anvil** — one shared
plugin serves every clan, you don't publish your own. Your members:

1. Install **Anvil** from the RuneLite Plugin Hub.
2. In **RuneLite → Configuration → Anvil → Site URL**, enter your instance's URL (e.g.
   `https://bingo.yourclan.com`, no trailing slash). **This is required for self-hosters** —
   the field ships **empty**, with no built-in default pointing at any reference instance.
3. Leave **Account Token** blank and hit **Sign in with Discord** in the side panel — a
   device-code flow pinned to your own domain fills it in (nothing goes through the broker
   on a self-host with its own Discord app). Copy/pasting the token from **Profile →
   RuneLite plugin → Reveal → Copy** also works. One token covers every event they're
   signed up for; after that the account they log in on links to their profile
   automatically.

See [`PLUGIN_SETUP.md`](./PLUGIN_SETUP.md) for the member walkthrough, the "is it working?"
signals, and troubleshooting. A public copy of the same guide is served by your own
instance at `/guide/plugin` (and `/guide/admin` for staff), already filled in with your
domain — that's the link to hand your clan.

If you'd rather ship a build whose **Site URL** defaults to your domain, change the
`apiUrl()` default in `src/main/java/com/anvil/AnvilConfig.java` in the
[plugin repo](https://github.com/AhmedFathy2001/anvil-plugin) and build with
`./gradlew build`. That means running your own Hub listing instead of the shared **Anvil**
plugin — see [`PLUGIN_SUBMISSION.md`](./PLUGIN_SUBMISSION.md).

---

## Other hosting shapes

The Docker path above is what's tested and what the hosted fleet runs. These also work:

### Bare Node (no Docker)

```bash
npm ci
npm run build
export DATABASE_URL=file:/srv/anvil/anvil.db
npm run db:migrate     # you own this step — run it before every start
npm start              # or run the standalone bundle, as the image does
```

Node 22 is what CI and the image use. The build emits `.next/standalone` (that's what the
container runs, via `node server.js` with `.next/static` and `public/` alongside it) — use
whichever you prefer, but wire `db:migrate` into your service unit or deploy script, since
nothing else will run it for you.

### Serverless (Vercel) + a remote libSQL database

Workable, but it's the *less* maintained path and needs more moving parts:

- The repo ships **no `vercel.json`** — add one with a `crons` block yourself (§5), or
  drive the routes from an external scheduler.
- Nothing runs migrations for you: run `npm run db:migrate` locally against the production
  credentials (or as a CI step) on every schema-changing deploy.
- Serverless has no local disk, so you need a remote libSQL endpoint
  (`DATABASE_URL=libsql://…` + `DATABASE_AUTH_TOKEN`, e.g. [Turso](https://turso.tech)) and
  `STORAGE_DRIVER=vercel-blob` with `BLOB_READ_WRITE_TOKEN` from a Blob store.
- `/api/cron/backup` no-ops on a remote DB — use your provider's backups instead.

Set every other variable from §3 in **Project → Settings → Environment Variables**, then
bootstrap the first admin exactly as in §6.

---

## Migrations, in one paragraph

`npm run db:migrate` (which is what the container runs on boot) replays `drizzle/*.sql`
from `0000` and is idempotent — already-applied migrations are skipped via the
`__drizzle_migrations` ledger. **Never use `db:push` on a database you intend to keep:** it
mutates the schema without writing to the ledger, so the DB drifts ahead of `drizzle/` and
future `db:migrate` runs break. It's for throwaway scratch DBs only.

> **Reconciling an old `db:push` database** (an early install predating the migration
> chain). It has no ledger, so `db:migrate` would try to recreate tables it already has.
> Reconcile it **once**:
>
> 1. Confirm the live schema matches `src/db/schema.ts` (`npx drizzle-kit check`).
> 2. With the DB credentials in the environment, stamp the squashed baseline as applied:
>    ```bash
>    npx tsx scripts/bootstrap-migrations-table.ts --mark-all
>    ```
> 3. From then on `db:migrate` runs only *future* migrations. Fresh instances need none of
>    this — they migrate from `0000` cleanly.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Container exits at boot, logs `[migrate] failed` | A migration couldn't apply. The DB is untouched past that point — read the error, restore the newest `/data/anvil.db.premigrate-*` if needed, and report it. |
| `SQLITE_CANTOPEN` / read-only DB errors | The `/data` mount isn't writable by uid 1001. Use a named volume, or `chown -R 1001:1001` the bind-mount directory. |
| `Missing required env var "…"` on first request | A production secret is unset — see §3. The app fails loudly by design rather than running on dev defaults. |
| Cron routes return **500** | `CRON_SECRET` is unset in production. Set it and restart. |
| Cron routes return **401** | The `Authorization: Bearer …` header doesn't match `CRON_SECRET`. |
| Discord login bounces with `invalid_redirect_uri` | `DISCORD_REDIRECT_URI` and the URL registered in the Discord app must match character-for-character, including `https://` and the trailing path. |
| Uploads fail, everything else works | No storage driver configured — see §7. |
| Plugin says it can't reach the site | **Site URL** is empty or has a trailing slash / wrong scheme. Check `GET /api/version` in a browser first. |
| Clan sync rejected | The in-game clan name reported by the plugin doesn't match **In-game clan name** in `/admin/clan`. Blank it to accept any clan. |

