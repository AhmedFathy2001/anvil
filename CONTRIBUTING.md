# Contributing to Anvil

Thanks for your interest in improving Anvil — the source-available clan-operations
platform for Old School RuneScape clans. Contributions of all sizes are welcome:
bug fixes, features, docs, and plugin improvements.

## Ground rules

- Be respectful. This is a hobby project run by and for the OSRS community.
- The author attribution in the site footer is required by the [LICENSE](LICENSE)
  and must stay in place. Everything else is fair game to change.
- Keep PRs focused — one logical change per pull request is easier to review.

## Project layout

This repo is the **web app** (Next.js 16 / React 19 / Drizzle ORM on SQLite via
libSQL). The **RuneLite plugin** (Java / Gradle) lives in its own repository —
[anvil-plugin](https://github.com/AhmedFathy2001/anvil-plugin) — and is not part of
this tree; changes that span both need a PR in each.

See the [README](README.md) for the full repository map and stack details.

## Local development

1. **Prerequisites:** Node 22 (what CI and the Docker image use) and npm. No database
   server needed — the default is a local SQLite file.
2. **Install:** `npm install`
3. **Configure:** copy `.env.example` to `.env.local` and fill in the values.
   Every variable is documented in that file. For local dev you mainly need
   `DATABASE_URL` (defaults to `file:./local.db`) and, if you're touching login, the
   Discord OAuth vars; session secrets fall back to dev placeholders.
4. **Migrate:** `npm run db:migrate` applies the committed migrations to your
   database (works against an empty DB — this is the same path the app runs on boot).
5. **Run:** `npm run dev` — the app serves on http://localhost:3000.

Test suites run on `node:test`: `npm run test:events`, `test:embeds`,
`test:federation`, `test:recap`.

A full self-hosting / deployment guide lives in
[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Database changes

**Migrations are the source of truth, and the chain must always apply cleanly from
`0000` against an empty database.** Every self-hosting clan boots by replaying the
`drizzle/` migrations from scratch (`scripts/migrate.mjs` runs on container start),
so a broken or skipped migration breaks every fresh install — even if it happens to
match your already-migrated dev DB. Treat the migration chain as a public contract.

The schema lives in `src/db/schema.ts`. After editing it, **always**:

```bash
npm run db:generate   # creates a new drizzle/NNNN_*.sql migration + meta snapshot
npm run db:migrate    # applies the chain to your DB (use this, not db:push)
```

Then **commit the generated `drizzle/NNNN_*.sql` and the updated `drizzle/meta/`
snapshot in the same commit as the `schema.ts` change.** A schema change without its
migration is an incomplete change and will be sent back in review.

Rules, non-negotiable:

- **Never use `db:push` to evolve a schema you intend to keep** (shared/staging/prod).
  `db:push` diffs and mutates the DB *without* writing a migration or updating the
  ledger, so the DB silently drifts ahead of `drizzle/`. That drift is what forces a
  painful history squash later. `db:push` is only acceptable for a throwaway local
  scratch DB you're about to delete.
- **One change, one migration, one commit.** Don't batch unrelated schema edits, and
  don't hand-rename generated files (the `drizzle/meta/_journal.json` tag must match).
- **Verify before you push the PR:** run `npm run db:migrate` against a *fresh empty*
  DB (e.g. `DATABASE_URL=file:/tmp/fresh.db npm run db:migrate`) and confirm it
  reports `up to date`. Then run `npm run db:generate` again — it must print
  *"No schema changes"*, proving `schema.ts` and the migration chain are in sync.
- For `ALTER TABLE ... ADD ... NOT NULL` on existing tables, the generated migration
  needs a `DEFAULT` (SQLite requirement). Drizzle adds one for column defaults. If the
  value must be backfilled from another column, hand-edit the migration to do it in
  three steps in one file: add the column with a placeholder default, `UPDATE` to
  backfill, then add the index/constraint — keep each step on its own
  `--> statement-breakpoint` line.

## Making clan-specific values configurable

Anvil is built to be self-hosted by any clan, so **don't hardcode clan-specific
values** (Discord server/role IDs, invite links, clan names, RSNs). Put them
behind:

- the `settings` table (admin-editable at `/admin/integrations` or `/admin/clan`),
  exposed via the whitelist in `src/app/api/admin/settings/route.ts`, **or**
- an environment variable documented in `.env.example`.

## Code style

- TypeScript throughout. Run `npm run lint` before opening a PR.
- API routes use async params (`{ params: Promise<{ id: string }> }`) per
  Next.js 16.
- Dates are stored as ISO UTC text strings.
- Match the surrounding code's conventions (the gold accent theme, section header
  bars, fire-and-forget Discord notifications, etc.).

## Branching & releases

Anvil ships canary-first through two long-lived branches:

- **`beta`** — the integration branch. **All contributions land here first.** On the
  hosted service, `beta` auto-deploys to opt-in *beta clans* that volunteer to run
  pre-release builds, so changes get real-world canary testing before the whole fleet
  gets them.
- **`main`** — the stable release everyone runs. Changes are promoted here from `beta`
  by maintainers once they've held up on the canary clans (promotion ships the exact
  tested build — see the control-plane docs).

So the normal path for a change is **PR → `beta` → (bakes on beta clans) → promoted to
`main`**. Self-hosters tracking `main` therefore only ever pull builds that have already
been canary-tested. The staged-rollout machinery itself (release channels, image pinning,
promote, deploy notifications) lives in the control plane, not this repo.

## Submitting a pull request

1. Fork the repo and create a branch off **`beta`**.
2. Make your change, including any docs and migrations.
3. Run `npm run lint` and `npm run build` to confirm it compiles.
4. Open a PR **into `beta`** describing **what** changed and **why**. Screenshots help
   for UI changes.

## Reporting bugs / requesting features

Open a GitHub issue with clear reproduction steps (for bugs) or a description of
the use case (for features). For plugin issues, mention your RuneLite version and
which clan instance / Site URL you're pointing at.

## Getting help

Faster than an issue when you're stuck mid-setup, or unsure whether something is a
bug at all: **[the Anvil Discord](https://discord.gg/p9NkrTQmxN)**. Self-hosters, managed clans and
plugin users all land in the same place.
