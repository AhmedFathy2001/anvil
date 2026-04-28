# Plugin Backlog — Site ↔ RuneLite Plugin Work

Tracked here so the parallel plugin-polish session stays in sync with site-side changes.
Endpoints listed below are being/have been built in the site session; plugin is the consumer.

---

## 1. Admin-plugin linking (verification flow) — ✅ shipped (plugin side)

Required so admin roster-sync actions can be attributed to a verified clan admin.

- [x] Add plugin config field: **"Site admin link code"** (string, 6 chars) — lives under collapsed "Admin link" section in plugin settings (`OsrsBingoConfig.adminLinkCode`)
- [x] On code submit, POST `/api/plugin/link`
      Body: `{ code: string, rsn: string }` — plugin supplies `rsn` from `Client.getLocalPlayer().getName()`
      Response: `{ token: string, userId: number, rsn: string }` on success
- [x] Store returned `adminPluginToken` in plugin secure/config storage (`OsrsBingoConfig.adminPluginToken`, marked `secret=true`)
      **Kept separate from the existing per-event `playerToken`** — an admin can simultaneously be a bingo player.
- [x] Show link status in plugin sidebar: `Linked as <RSN>` + last sync relative time + **Unlink** button (clears local token only — site-side revoke is separate)
- [x] Handle 400 (bad/expired code) and 409 (clan mismatch) — plugin surfaces server error text via a JOptionPane dialog

## 2. Clan roster scrape + sync — ✅ shipped (plugin side)

Admin pushes the button → plugin reads the in-game clan UI → POSTs the roster.

- [x] **Sync clan** button — visible only when `adminPluginToken` is present AND `ClanSettings` is loaded (button is disabled with tooltip otherwise)
- [x] Reads clan name via `ClanSettings.getName()`
- [x] Reads each member: `{ rsn, rank, joinedDays }` where:
      - `rank` = `ClanSettings.titleForRank(m.getRank()).getName()` (falls back to rank integer if no title is set)
      - `joinedDays` = days since `ClanMember.getJoinDate()` (answers open question below: reliable)
- [x] POST `/api/plugin/clan-sync` with `Authorization: Bearer <adminPluginToken>`
- [x] Handle responses:
      - `401` → clear local token, prompt re-link
      - `409 clanMismatch` → show "Clan name doesn't match site config (<serverClanName>)"
      - `200 { added, updated, markedLeft }` → panel shows `+N added · N updated · N left` + chat confirmation

## 3. Plugin "hello" (self-registration as guest) — ✅ shipped (plugin side)

Any plugin user who isn't already in `clanMembers` becomes a guest automatically.

- [x] On `GameStateChanged → LOGGED_IN` (3s delayed so RSN is populated), POST `/api/plugin/hello`
      Body: `{ rsn: <localPlayerName> }` (no auth required)
      Response: `{ knownMember: boolean, isGuest: boolean }`
- [x] If `knownMember === false`: one-time chat message + passive yellow banner in the side panel ("You're tracked as a guest — a clan admin can promote you.")

## 4. Auto-enroll in the live weekly competition — ✅ shipped (plugin side)

- [x] Added plugin setting `autoEnrollWeekly` (default on) in `OsrsBingoConfig`
- [x] On `GameStateChanged → LOGGED_IN`, after `/api/plugin/hello` resolves, plugin calls `GET /api/plugin/active-weekly` → `ActiveWeekly | null`
- [x] When non-null and `autoEnrollWeekly` is on, plugin POSTs `/api/plugin/weekly/enroll` with `{ rsn }`
- [x] Handles all three response shapes:
      - `{ enrolled: true, compTitle, baselineValue }` → chat message `Enrolled in <compTitle> — baseline locked at <baseline>.` + green "Enrolled — baseline N" line in side panel
      - `{ enrolled: true, alreadyEnrolled: true }` → silent, panel shows neutral "Already enrolled in <title>"
      - `{ enrolled: false, reason: ... }` → ignored (logged at debug)
- [x] Active comp is shown in the side panel under a "Weekly comp" section (title + metric/type), even before enrollment resolves
- [x] Enrollment is attempted once per login; `LOGIN_SCREEN` resets the flag

## 5. Retire WOM integration on plugin side — ✅ nothing to do

Confirmed via repo-wide grep: no `wom|WOM|wiseoldman` references in `plugin/`. The plugin never shipped WOM integration.

## 6b. Detect RSN renames on the plugin side

The site handles renames via an admin-initiated **Rename** action in `/admin/clan` that
cascades through `clan_members`, `players`, `weekly_participants`, and `plugin_links`.
The plugin only needs a light prompt:

- [ ] When an admin is linked (`adminPluginToken` present) and `localPlayerName` differs
      from `adminLinkedRsn` on login, show an in-panel banner: *"Your RSN changed from
      &lt;old&gt; to &lt;new&gt;. Unlink and re-link to refresh your admin token binding."*
      The site's rename endpoint already follows admin links through a rename, so this
      prompt is optional polish — it only matters for the plugin's displayed status.
- [ ] Non-admins: nothing to do — `plugin/hello` auto-registers the new name as a guest;
      admins resolve the duplicate by pressing **Rename** on the old row, which
      auto-merges unused guest rows.

## 6. Surface the /admin/schedule calendar in-game — ✅ shipped (both sides)

- [x] Site: `GET /api/plugin/schedule` (unauth) returns `{ bingos: [{id,title,startDate,endDate,status}], weeklies: [{id,title,type,metric,status,startDate,endDate}] }` — filtered to active + upcoming, capped at 10 of each, sorted by start date ascending, excludes force-ended bingo and completed weeklies.
- [x] Plugin: `BingoApiClient.fetchSchedule()` + `ScheduleResponse`/`ScheduledBingo`/`ScheduledWeekly` POJOs.
- [x] Plugin fetches schedule once on login (after hello) and piggy-backs the existing 30s refresh loop. Panel Refresh button also triggers it.
- [x] Side panel renders an **Upcoming** section with per-row kind badge (green=active, gold=upcoming-bingo, blue=upcoming-weekly, muted=otherwise) and right-aligned date (shows "ends <date>" for active, start date for upcoming).

---

## Launch-readiness audit (2026-04-20)

### Blockers fixed this session
- [x] `POST /api/plugin/link` — atomic consume-on-check via conditional `UPDATE … RETURNING`, 409 on RSN conflict with existing un-revoked link, dedup same-RSN links.
- [x] Event PATCH — ISO-string validation + `endDate > startDate` enforcement.
- [x] Submissions — `imageUrl` allowlist restricted to Vercel Blob hostnames (prevents Discord phishing embeds).
- [x] Tile PATCH — clearing `itemRequirements` now also clears `trackedItemIds` (unless the same request sets both explicitly) so per-item validation doesn't get stuck on empty.
- [x] Clan sync — members with `source='manual'` keep their `leftAt` through a plugin sync (admins' manual removals are no longer auto-revived).
- [x] `src/db/index.ts` — throws at boot on missing DB URL; requires auth token for remote Turso in production.
- [x] `/api/cron/stats` + `/api/cron/weekly` — hard-fail in production when `CRON_SECRET` is unset; `x-vercel-cron` header bypass only in dev.
- [x] Plugin — 3-second dedup window on per-(tileId,itemId) loot events to suppress `NpcLootReceived`+`LootReceived` double-fire.
- [x] Plugin `LinkResponse` — added `username` field to match site response shape.

### Outstanding launch risks (not yet fixed — need decisions)
- **Rate limiting posture** — only `/api/plugin/link` is rate-limited (brute-force protection via a tiny DB-backed fixed-window limiter in `src/lib/rate-limit.ts`, backed by the `rate_limits` table added in migration `0017`). `/api/plugin/hello`, `/api/plugin/weekly/enroll`, `/api/plugin/active-weekly`, `/api/plugin/schedule`, and `/api/upload` are intentionally unlimited at clan scale (all idempotent or read-only). Revisit if the site is exposed to the broader internet.
- ~~**Hiscores cron timeout** — no fetch timeout inside `fetchParticipantStat`~~. **Fixed**: 8s `withTimeout` + one retry with 1.5s backoff in `src/lib/weekly.ts`; failures return null and the next cron tick reprocesses.
- ~~**Discord webhook 429 retry** — current fire-and-forget loses notifications under bursts.~~ **Fixed**: `sendDiscordWebhook` now honors `Retry-After` (header or body `retry_after`) and retries once, capped at 5s.
- ~~**Observability** — no structured logger or Sentry; cron failures + webhook misconfig are silent in production.~~ **Fixed**: `src/lib/logger.ts` emits JSON-line logs (pretty in dev) and optionally forwards warn/error to Sentry via a dynamic `@sentry/nextjs` import when `SENTRY_DSN` is set. Install the package only if you plan to use Sentry.
- **Design/UX polish** — Tile detail modal a11y, error boundaries (`error.tsx` / `not-found.tsx`), loading/error state coverage — see audit for full list.
- **Plugin Hub submission** — push `plugin/` to public repo + tag, then open PR against `runelite/plugin-hub` per `docs/PLUGIN_SUBMISSION.md` (kept out of `plugin/` so it's not published with the plugin repo).

### Recommended launch posture
- **Soft launch (invite-only, trusted admins only)**: ready after a full smoke test against a disposable event.
- **Public launch**: fix the rate-limiting + Discord retry + observability items first.

---

## Open questions for the plugin session

- ~~Does RuneLite's clan API expose `joinedDays` reliably, or only `rank` + `rsn`?~~ **Answered:** `ClanMember.getJoinDate()` returns a `LocalDate`; plugin computes `joinedDays` from it and sends it on every sync.
- ~~Is the plugin already doing any polling heartbeat?~~ **Answered:** yes, the 30s config-refresh loop — but per the backlog spec, `/api/plugin/hello` fires once on `GameStateChanged → LOGGED_IN` rather than piggy-backing the refresh, so the site only sees it when a player actually logs in.

---

Last updated by site session: initial draft.
