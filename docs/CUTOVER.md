# Production cutover: SQLite clans → the Postgres platform

Moving each production clan off its own `clan-<slug>` container (one SQLite file each) onto
the shared Postgres platform this repo now serves. Written to be executed step by step, with a
hard go/no-go gate before anything writes, and a rollback that costs nothing because the source
is never touched.

> **Standing rule:** every prod-touching step below is marked ⛔. Do not run a ⛔ step without an
> explicit go-ahead for that step. The dry-runs and backups (✅) are safe and are the whole point
> of reaching the gate informed.

---

## The safety model, in one paragraph

`import-clan.mjs`, `import-billing.mjs` and `migrate-blobs.mjs` are **dry-run by default** — without
`--apply` each does the entire job inside a transaction and rolls it back, printing exactly what it
*would* have written. The clan's SQLite file is **read-only to all of them**: nothing in the cutover
mutates the source. So rollback is not a database restore — it is repointing one Caddy route back at
a container that never changed. That property is what makes this runnable without a maintenance
weekend.

---

## What must survive verbatim (the importer already guards these)

- `users.plugin_token`, `plugin_links`, `plugin_device_codes`, `event_participants.player_token` —
  every member's RuneLite client holds one. Changing one forces a person to re-link by hand; it is
  the single most user-visible way to get this wrong. Copied as-is and checked afterward.
- `accounts.claimed_at` / `verified_at` / `verification_method` / `account_hash` / `is_primary` —
  an already-claimed prod account stays claimed and owned. **Only *unclaimed* prod members** land in
  the post-takeover-fix state (verify by XP once, or a mod approves — see `docs/` on the account
  gate). Members who already claimed are unaffected, and members who carry an `account_hash` re-link
  silently on their next plugin ping.

---

## Phase 0 — Pre-flight ✅ (safe; do this first, days ahead)

1. **Inventory the prod clans.** On the box: `docker ps --format '{{.Names}}' | grep '^clan-'`.
   For each, note its slug, its SQLite volume, and its host(s) in Caddy.
2. **Confirm the platform Postgres exists and is schema-current.** Point `DATABASE_URL` at the prod
   platform DB and run the migrations this repo ships:
   ```
   node scripts/migrate.mjs          # applies drizzle/*.sql through 0072_onboarding
   ```
   Verify the latest migration is present (`select tag from drizzle.__drizzle_migrations` or the
   journal) — a cutover onto a stale schema drops columns silently.
3. **Back up every clan's SQLite** (belt, not because we mutate it — we don't):
   ```
   docker cp clan-<slug>:/data/anvil.db ./backups/<slug>-preflight.db
   ```
4. **Grab the control-plane billing DB** (`anvil-admin.db`) — `import-billing.mjs` reads it to carry
   subscriptions across. Without it every imported clan lands on `free`, including paid ones.

---

## Phase 1 — Dry-run + the go/no-go gate ✅ (safe; the decision point)

Run **per clan**, without `--apply`. This is the evidence the cutover is safe.

```
node scripts/import-clan.mjs --source ./backups/<slug>-preflight.db --slug <slug> --name "<Name>"
```

Read the report and require **all** of:

- [ ] **No dropped columns.** The script copies by column intersection and prints anything it skips;
      an unexpected skip means the source schema drifted from what the importer knows.
- [ ] **Member / guest counts match source.** The verification pass compares `is_guest`→`kind`
      counts; a mismatch means the split lost or duplicated seats.
- [ ] **Zero dangling rows** — no seats without accounts, no accounts without people.
- [ ] **Token counts match** — `users.plugin_token`, `plugin_links`, `plugin_device_codes`,
      `event_participants.player_token` all carried.
- [ ] **A person in two clans is reported as one merge, not two people.** (Expected for anyone
      already imported, e.g. an owner who tests across clans.)

Then the billing dry-run:
```
node scripts/import-billing.mjs --source ./backups/anvil-admin.db
```
- [ ] Every paying clan's tier + cap is matched by slug and reported correctly.

**GATE:** if every box above is checked for a clan, that clan is cutover-ready. If any is not, stop
and fix the importer/data first — do not proceed to `--apply`.

---

## Phase 2 — Cutover a clan ⛔ (writes prod; per-clan, reversible)

Do one clan end-to-end before the next. A window of a few minutes each; no site-wide downtime.

1. **Quiesce the clan** ⛔ — put its container in maintenance so no new writes land in the SQLite
   you are about to freeze (stop the container, or its cron, so the plugin/webhooks stop writing).
2. **Final snapshot** ✅ — `docker cp clan-<slug>:/data/anvil.db ./backups/<slug>-final.db`. This is
   the exact file the apply reads, so apply and snapshot see identical data.
3. **Apply the import** ⛔:
   ```
   node scripts/import-clan.mjs --source ./backups/<slug>-final.db --slug <slug> --name "<Name>" --apply
   node scripts/import-billing.mjs --source ./backups/anvil-admin.db --apply
   ```
4. **Media** ⛔ (only if the clan has Vercel-Blob images not yet on R2): build the TSV, run
   `migrate-blobs.mjs`, apply the emitted `updates.sql` against the platform DB.
5. **Repoint routing** ⛔ — move the clan's host(s) in Caddy from `clan-<slug>` to the platform app
   (Caddy admin API, the same injection custom domains use). `/c/<slug>` on the platform now serves.
6. **Verify** (checklist below). Leave the old `clan-<slug>` container **stopped but present** — it
   is the rollback.

---

## Phase 3 — Verify each cutover clan ✅

- [ ] `https://<clanhost>/` and `/c/<slug>` render the clan's real name (not "Anvil") and its home.
- [ ] A known member signs in with Discord and lands on their locker with their history intact.
- [ ] Roster count on `/members` matches the source.
- [ ] A plugin ping (a real member playing, or a crafted authenticated `stats` call) resolves and
      does **not** get refused — confirms their token carried and the account resolves.
- [ ] A past event's board renders with its tiles and standings.
- [ ] The clan's subscription tier/cap is correct (a paid clan is not on `free`).
- [ ] Discord webhooks still post (trigger a test from the settings page).

---

## Rollback ⛔ (costs nothing — the source never changed)

If verification fails for a clan:

1. Repoint its Caddy host back to the `clan-<slug>` container.
2. Start the container. It resumes on its untouched SQLite — no data was lost because the apply only
   ever wrote to Postgres and the SQLite was read-only throughout.
3. Remove the clan's rows from the platform (its `clan_id` cascade) before retrying, so a second
   apply is clean.

The only data that could be lost is writes that would have landed during the quiesce window — which
is why the window is minutes, and why the plugin buffers and retries.

---

## Phase 4 — Decommission ✅ (after a soak)

Once a clan has run on the platform for a soak period (suggest ~1 week) with no rollback:

- Remove the `clan-<slug>` service from the box compose / provisioner.
- Keep the `<slug>-final.db` backup archived (cheap insurance, not a live dependency).
- Fold the clan into the platform cron sweep + rollout channels (it already is, via the shared app).

---

## Still needed before the FIRST cutover (not blockers for readiness, but for the front door)

The tooling is ready; these make the apex a complete destination for the clans you move onto it:

- **`/pricing`** — data already exists in `src/lib/plans.ts` (`PLANS`); needs the page.
- **`/about`** — what Anvil is; can draw from `ApexLanding`.
- **`/legal/*`** (privacy / terms / refunds) — **operator-authored copy required**; do not ship
  fabricated terms. Scaffold + real text from you.
- **`/portal`** — customer billing dashboard. Needs a decision: reuse Discord login, or the
  magic-link-keyed-to-Gumroad-email flow the memory notes describe.

These four are the "admin/marketing absorption" the plan pairs with H1.

---

## Quick reference — the scripts

| Script | Moves | Dry-run default | Match key |
|---|---|---|---|
| `import-clan.mjs` | roster, events, tiles, history, tokens | yes (`--apply` to write) | per-source |
| `import-billing.mjs` | subscription tier + cap | yes (`--apply` to write) | slug |
| `migrate-blobs.mjs` | media Vercel-Blob → R2 | emits `updates.sql` | — |
| `migrate.mjs` | platform schema (drizzle) | applies on run | — |
