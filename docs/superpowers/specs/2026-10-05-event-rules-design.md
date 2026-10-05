# Event rules + co-host Discord: rulebook, event-page card, co-host-aware bot, fan-out, logo fix

Date: 2026-10-05 · Status: approved design, pending implementation plan

## Problem

- Rules exist only as clan-wide house rules (`settings.board_rules` / `board_rules_url`) and are only
  reachable through `/bingo rules`, an ephemeral slash-command reply (Share button to post it).
- Nothing posts rules automatically, and the event page (`/events/[eventId]`) shows no rules at all.
- Co-hosted events are invisible to the bot in a co-host clan's Discord: `pickEvent` /
  `listLiveEvents` / `loadEvent` (`lib/discordContext.ts`) filter on `events.clanId`, so every
  `/bingo` subcommand in a co-host server answers about that clan's own boards only. Every automatic
  post (`sendBingoWebhook`) goes to the host clan alone.

## Decisions (from the user)

1. Co-host support covers **all of `/bingo`** (board / leaderboard / me / rules), not rules only.
2. On a co-hosted event everyone sees **the event's rules, authored by the host** — one board, one
   rulebook. A co-host's own clan house rules never appear for a board it doesn't own.
3. Rules are posted **manually (button)** and **automatically at event start**, to **every
   participating clan's** Discord (host + accepted co-hosts).

## Design

### 1. Data: the event rulebook

- New nullable column `events.rulebook` (text, markdown). Generated migration via
  `drizzle-kit generate` (never `db:push`).
- Effective rules for an event: `events.rulebook` if non-blank, else the **host clan's**
  `board_rules`. Link: always the host clan's `board_rules_url`.
- New module `lib/eventRulebook.ts`:
  `resolveEventRulebook(eventId) → { text: string | null; url: string | null; source: 'event' | 'clan' | 'none'; hostClanId; hostClanName }`.
  Reads settings by the **event's** `clanId` (the host), never by the asking guild's clan. The
  fallback choice is a pure function (`pickRulebook(eventText, clanText, clanUrl)`) so it is
  testable without a database.
- New flag in the `events.rules` JSON (`EventRules`, `lib/eventRules.ts`): `rulesAtStart: boolean`,
  **default true** (parseEventRules(null) → true).
- Admin editing: a "Rules" section on the event admin page (event settings form) — `rulebook`
  textarea with the same markdown preview as the House rules setting; placeholder shows the clan's
  house rules with "Leave empty to use your clan's house rules"; checkbox "Post rules to Discord when
  the event starts" (`rulesAtStart`). Saved through the existing event PATCH route (add both fields
  to its allow-list/validation; rulebook capped at e.g. 20 000 chars).

### 2. Shared mechanics builder

- Move `mechanicsLines` and `trackingLines` out of `lib/discordCommands.ts` into a pure module
  `lib/rulesMechanics.ts` (inputs: dictionary, event fields, parsed rules, pool, fee, mission counts,
  board tiles). Discord and the site render the same sentences from one source. No `@/db` import
  (pure-tests rule).

### 3. Event page: Rules card

- `/events/[eventId]` gets a collapsible **Rules** card (standard `border-card-border rounded-xl
  bg-card-bg` + gold section bar): "How this board works" (mechanics lines) and "Rules" (rulebook
  markdown via the existing `lib/guideMarkdown` renderer) plus the full-rules link.
- Shown in every phase (mechanics are not spoilers; tile names are never included). Hidden entirely
  only if there are neither mechanics nor rulebook (in practice always shown).
- Renders identically when the page is served under a co-host's `/c/<slug>` — the rulebook resolves
  from the event (host), not the viewing clan.
- English on the site (site i18n out of scope); Discord stays localized via its dictionary.

### 4. Co-hosts in the bot (all of `/bingo`)

- `pickEvent`, `listLiveEvents`, `loadEvent` in `lib/discordContext.ts` include events where the
  guild's clan holds an **accepted** `event_cohosts` row, in addition to its own. Ranking unchanged
  (running → upcoming → ended → draft). `loadEvent` accepts an event owned by the clan OR co-hosted
  by it (still refuses any other clan's event — shared buttons can't reach across).
- `EventContext` gains `hostClanId` / `hostClanName` / `cohosted: boolean`.
- Links in a co-host server point at the **co-host's own** origin (`clan.origin/events/<id>`) — the
  existing `eventUrl(clan, id)` already does this since `clan` is the guild's clan; co-hosts play
  from home.
- `contextLine` adds "Hosted by **X**" when `cohosted`.
- `/bingo rules` uses `resolveEventRulebook` (host rules), titled with the host clan's name.
- `/bingo me` resolves the invoker through the guild clan's roster and finds their team on the
  shared event — verify by test, no expected change.
- Clan write subcommands (coffer etc.) are unaffected: they operate on the guild's clan, not events.

### 5. Posting rules to Discord

- `lib/eventRulesPost.ts`: `postEventRules(eventId, { clanIds? }) → { clanId, clanName, status:
  'posted' | 'no-webhook' | 'failed' }[]`.
  - Targets: default host + all accepted co-hosts; `clanIds` narrows it.
  - Per target clan: build a `ClanContext` for that clan (its `discord_language`, origin, name),
    build embeds with the shared rules-embed builder (extracted from `rulesEmbeds`, taking the
    resolved rulebook), send via `sendBingoWebhook(clanId, { embeds })`.
  - Never throws; logs `event-rules.post` per clan.
- Manual: `POST /api/admin/events/[eventId]/post-rules` body `{ clanIds?: number[] }`.
  - Host clan staff (moderator+ / event editors per existing event-admin auth): any target subset.
  - Accepted co-host staff: only their own clan id (any other target → 403).
  - UI: "Post rules to Discord" button in the event admin Rules section (host) showing per-clan
    results; same button (own server only) on the co-hosted board entry in the co-host's admin.
- At start: in `lib/eventLifecycle.ts` and the start-now path in `app/api/events/[eventId]/route.ts`,
  right after `notifyEventStart`, call `postEventRules(eventId)` when `rules.rulesAtStart` — fire and
  forget. The existing `startNotified` atomic flip guarantees one post per event.
- Target webhook per clan comes from the co-host fan-out resolver (section 6), so a co-host's
  "co-hosted boards" channel receives the rules too.

### 6. Co-host fan-out of bingo progress ("both ways")

Every clan on a co-hosted board gets the board's bingo posts in its own Discord — the host's server
for boards it co-hosts elsewhere, and co-hosts' servers for the boards it hosts. Symmetric by
construction: the fan-out is keyed on the event, not on who is host.

- `lib/discord.ts`: new `sendEventBingoWebhook(eventId, hostClanId, build: (targetClanId) =>
  Promise<DiscordWebhookPayload>)`. Targets = host + accepted co-hosts (`acceptedCohostClanIds`).
  Built per target so each clan gets **its own member-role ping** (`memberPing(targetClanId)`). The
  embed content (including the host's crest and author) is shared. Sends in parallel; a missing
  webhook for a target is skipped silently; returns true if the host post succeeded (preserves
  existing caller semantics).
- Webhook for a co-host target: new setting `discord_webhook_cohost` ("Co-hosted boards" channel),
  falling back to `discord_webhook_bingo` → `discord_webhook_url`. Host target unchanged
  (`sendBingoWebhook`). Toggle `discord_cohost_posts_enabled` (default on): off means the clan
  receives no fan-out posts for boards it doesn't own (its own boards are unaffected).
  Both keys added to the settings allow-list and to the Webhooks panel in Admin → Integrations
  (webhook field + toggle, with copy explaining "posts from boards you co-host, and boards you host
  that other clans co-host, land here").
- Fanned out (board progress everyone on the board cares about): `notifySubmission`,
  `notifyMergedSubmission`, `notifySubmissionDeleted`, `notifyTileCompletion`,
  `notifyTilesRevealed`, `notifyBountyClaim`, `notifyMissionPrize`, `notifyDraftStart`,
  `notifyDraftComplete`, `notifyTeamWin`, `notifyEventStart`, `notifyEventForceEnd`,
  `notifyEventEnd`, and the rules post (section 5).
- Host only (staff/money/clan-scoped): `notifyEventStartHeld`, `notifyPayout`,
  `notifySignupApproved`, `notifyMonthlyChampion`, weekly posts.
- Params: fanned-out notifiers that lack `eventId` gain it (callers already have it).
- Links inside fanned-out embeds stay as today (event URL by id); per-target link rewriting is out of
  scope.

### 7. Clan logo in Discord posts (bug)

Symptom: a clan with an uploaded logo (theafkspot) still shows the generated crest as the embed
author icon. `/api/og/crest/<slug>` already serves the logo (verified live 2026-10-05), but its URL
never changes when the logo does, so Discord's media proxy keeps the image it cached when the clan
had only the crest.

- New helper `clanMarkUrl(base, slug, logoUrl)` in `lib/crestImage` (or a small pure sibling):
  `${base}/api/og/crest/${slug}?v=${shortHash(logoUrl ?? 'crest')}`. The version changes exactly
  when the logo changes, so Discord refetches.
- Replace the three hand-built URLs: `clanCrestIcon` (`lib/discord.ts`), `authorOf`
  (`lib/discordCommands.ts`), the clan-command author (`lib/discordClanCommands.ts`), and the crest
  fallback in `lib/discordIdentity.ts`. Each caller must have `logoUrl` (add it to the clan selects /
  `ClanContext`).
- The routes ignore `?v`; nothing else changes.

## Testing

- Pure: `pickRulebook` fallback (event text wins; blank event text → clan text; never a co-host's);
  `rulesMechanics` output for a few rule combos; `parseEventRules` default `rulesAtStart = true`.
- DB-backed: co-host guild `pickEvent` / `loadEvent` resolve the co-hosted event; a non-co-host and a
  pending/declined co-host do not; `resolveEventRulebook` reads the host clan's settings; post-rules
  route rejects a co-host targeting the host's clan.
- Fan-out: `sendEventBingoWebhook` targets host + accepted co-hosts only, skips a co-host with
  `discord_cohost_posts_enabled` off, prefers `discord_webhook_cohost` for co-host targets, pings
  each target's own member role (webhook send mocked).
- Pure: `clanMarkUrl` version changes with `logoUrl`, stable otherwise.
- Run suites one at a time, `--maxWorkers=4`.

## Risks

- `discordCommands.ts` refactor (moving mechanics out) — keep function signatures and dictionary keys
  unchanged; existing command tests must stay green.
- Concurrent sessions edit `beta` and `db/schema.ts`; implement in a worktree and regenerate the
  migration on top of whatever number is current when merging.
