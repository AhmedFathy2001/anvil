import { sqliteTable, text, integer, real, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  boardSize: integer('board_size').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  draftStatus: text('draft_status').default('none').notNull(),
  draftOrder: text('draft_order'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  startNotified: integer('start_notified').default(0),
  endNotified: integer('end_notified').default(0),
  // Set once when the "start held" warning is posted (scheduled start reached while the event
  // wasn't startable — draft mid-way / no teams assigned; see lib/eventReadiness). The lifecycle
  // cron keeps nudging startDate forward while blocked, but warns exactly once. Cleared whenever
  // an admin edits startDate so a rescheduled start can warn again.
  startHoldNotified: integer('start_hold_notified').default(0),
  // Set once when the draft-complete roster is posted to Discord, so the pick auto-complete
  // and the manual "End draft" action can't both fire the same embed (idempotency). Cleared
  // by a draft reset. `resend-roster` intentionally bypasses it.
  draftNotified: integer('draft_notified').default(0),
  // Set once when the "Draft started" embed is posted to Discord (draft `start` action), so a
  // retried request or a start-from-paused can't double-post it. Cleared by a draft reset.
  draftStartNotified: integer('draft_start_notified').default(0),
  forceEndedAt: text('force_ended_at'),
  originalEndDate: text('original_end_date'),
  // Sign-up flow. signupFee is in gp; null = free event. Deadlines are ISO UTC strings;
  // null = signups open as soon as the event exists / no captain-selection cutoff.
  signupFee: integer('signup_fee'),
  // Host-added bonus to the prize pool, in gp; null = nothing added. The displayed
  // total pool is this plus signupFee × (count of approved signups) — see lib/prizePool.ts.
  addedPrizePool: integer('added_prize_pool'),
  signupOpensAt: text('signup_opens_at'),
  signupDeadline: text('signup_deadline'),
  // Grace cutoff for paying the fee. While unpassed, players may keep editing their
  // sign-up answers (and pay) even after signupDeadline / event start. Null = no grace;
  // editing then follows the normal sign-up window. See lib/signup.ts signupEditState.
  paymentDeadline: text('payment_deadline'),
  captainSelectionDeadline: text('captain_selection_deadline'),
  // Scoring mode. 'tiles' (default, classic) = a team's score is the count of
  // completed required tiles. 'points' (Leagues/Grid-Master style) = each tile
  // carries a `points` weight and a team's score is the sum of those weights for
  // the tiles it has completed. Completion mechanics are identical in both modes;
  // only how standings are tallied/displayed differs.
  scoringMode: text('scoring_mode').default('tiles').notNull(),
  // Board layout / event format, orthogonal to scoringMode:
  //   'bingo'    = a square N×N grid of tiles (classic) — or the Leagues-style points
  //                accordion when scoringMode='points'.
  //   'tilerace' = an ordered linear track; teams race along the tile sequence and the
  //                furthest-reached tile is each team's position.
  // The RuneLite plugin's Anvil clog tab branches its in-game view on this column.
  format: text('format').default('bingo').notNull(),
  // Discord team-channel provisioning (bot-driven, see lib/discord-teams.ts). The
  // category channel that holds every team's locked text + voice channels for this
  // event. Null = not yet provisioned. Cleared on teardown.
  discordCategoryId: text('discord_category_id'),
  // Member-facing tile visibility. 0 = tiles are hidden from non-staff: the web board
  // renders a "tiles not revealed yet" placeholder and the plugin returns empty tile
  // lists. 1 = revealed to everyone. Admin-only toggle on the event Overview tab. New
  // events start hidden so tiles can be authored privately; staff (admin/treasurer/
  // moderator) always see the board regardless. Existing events were backfilled to 1
  // so their current (visible) behavior is preserved.
  tilesRevealed: integer('tiles_revealed').default(0).notNull(),
  // Multi-account enrollment (all of a person's picked accounts land on ONE team). Set at create.
  //   maxAccountsPerPerson — how many of their linked accounts a person may enter for THIS event.
  //     1 (default) = classic one-account-per-person; existing events keep exactly that behaviour.
  //   accountSlotMode — how a person's N accounts count for team size, board balance AND the MVP
  //     rollup: 'per-person' (N accounts = 1 slot; MVP aggregates the person) or 'per-account'
  //     (N accounts = N slots; MVP lists each account). Moot while maxAccountsPerPerson = 1.
  //   feeMode — 'per-person' (one fee per person) or 'per-account' (a fee per entered account).
  // Scoring is unaffected: each account is its own `players` row, so drop/kill/stat tiles already
  // credit the team per account (team stat tiles sum; individual-mode tiles take the best account).
  maxAccountsPerPerson: integer('max_accounts_per_person').default(1).notNull(),
  accountSlotMode: text('account_slot_mode').default('per-person').notNull(),
  feeMode: text('fee_mode').default('per-person').notNull(),
  // Set when the payout summary (winners + amounts) is posted to the bingo Discord webhook.
  // Guards the auto-announce (fired once every payout is marked paid) from double-posting; the
  // manual "Announce" button re-stamps it. Null = not yet announced. See lib/discord notifyPayout.
  payoutsAnnouncedAt: text('payouts_announced_at'),
  // The prize-per-placement structure, as a JSON array of gp amounts indexed by place
  // (`[firstPlaceGp, secondPlaceGp, …]`). Set on the Payouts tab independently of generating the
  // per-player payout rows, shown on the public event page, and used as the reward per place when
  // payouts are generated (manually or auto-generated at event end). Null = not configured yet.
  placementPrizes: text('placement_prizes'),
  // Optional per-event game rules as JSON (see lib/eventRules.ts EventRules). Adds a third axis on
  // top of (format, scoringMode): HOW tiles become playable and how points are awarded —
  //   revealPolicy: 'all' (default; every tile visible once tilesRevealed flips) | 'scheduled'
  //     (per-tile revealAt times) | 'interval' (a timed random/sequential draw) | 'bounty'
  //     (exactly one open tile; first completion closes it and draws the next),
  //   plus firstBonus / decay / lockout scoring modifiers.
  // NULL = classic behaviour everywhere; parseEventRules(null) returns the defaults.
  rules: text('rules'),
  // Post-finish edit lock override. Finished events (past endDate / force-ended) refuse every
  // event-content mutation (teams, players, draft, tiles, completions, submissions — see
  // lib/eventLock.ts). Setting this ISO stamp re-opens editing for corrections; clearing it locks
  // again. NULL = locked once finished (the default for every event).
  editUnlockedAt: text('edit_unlocked_at'),
});

export const tiles = sqliteTable('tiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  label: text('label').notNull(),
  icon: text('icon'),
  description: text('description'),
  tileType: text('tile_type').default('standard').notNull(),
  requiredAmount: integer('required_amount'),
  trackedStat: text('tracked_stat'),
  statType: text('stat_type'),
  statGoal: integer('stat_goal'),
  // 'team' (default) = every member's progress sums toward the goal; 'individual' ('solo' is the
  // legacy spelling of the same thing) = ONE member has to reach it alone. Honoured for hiscores
  // stat tiles (lib/statTracking) and for submission-backed count tiles (lib/countProgress), which
  // then measure the best single member rather than the team sum. Only the kinds whose editor shows
  // the Team/Solo control ever store anything but 'team'.
  trackingMode: text('tracking_mode').default('team').notNull(),
  optional: integer('optional').default(0),
  // Admin kill-switch for a single tile's automatic crediting. When set (1), the site stops
  // auto-completing this tile: the hiscores stats cron, the plugin-pushed stat route, and the
  // submission threshold check all skip it — a captain/admin completes it manually instead.
  // For when a tile's auto-tracking is broken/unreliable. Unlike the tile KIND, this stays
  // editable mid-event so a live board can be fixed without a plugin release. Submissions and
  // hiscores polling still happen (evidence keeps flowing); only the auto-credit is suppressed.
  autoTrackDisabled: integer('auto_track_disabled').default(0).notNull(),
  trackedItemIds: text('tracked_item_ids'), // JSON array of OSRS item IDs for RuneLite plugin, e.g. '[13576]'
  // JSON array of per-item requirements, e.g. [{"itemId":25859,"name":"Enhanced weapon seed","requiredAmount":1}].
  // A row may carry `group` (set name) and `groupRequire` (how many distinct items in that set count
  // as satisfying it; absent = all of them) — see lib/collectionSets for what the two mean together.
  itemRequirements: text('item_requirements'),
  // How a collection tile's groups combine (lib/collectionSets). NULL/'any' = the OR-ed reading every
  // pre-existing collection has: satisfy ONE set. 'all' = AND-ed, every set must be satisfied — which
  // with groupRequire=1 per set is "one of many from EACH source" (a unique from each DT2 boss).
  groupMode: text('group_mode'),
  // JSON array of accepted loot sources for this tile. NULL = accept any source
  // (back-compat). Possible values: "npc" (mob kills), "event" (raid/barrows/wt
  // chests, clue caskets, implings — generic LootReceived), "pvp" (PK loot piles
  // + loot keys). e.g. '["npc","event"]' for "from CoX or any NPC, not PvP"
  // or '["pvp"]' for a PK-only tile.
  acceptedSources: text('accepted_sources'),
  // JSON array of specific NPC/source NAMES this drop tile must come from, e.g.
  // '["Tekton"]' for "onyx, but only from Tekton". NULL = any source (subject to
  // acceptedSources category filtering). Matched case-insensitively against the loot
  // source name the RuneLite plugin reports. Drop tiles only. Important for Leagues-style
  // boards where the same item is obtainable from many places but only one should count.
  sourceNpcs: text('source_npcs'),
  // KILL tiles (tile_type='kill'). JSON array of NPC names the RuneLite plugin counts
  // kills for — e.g. '["Chicken"]' or '["Cow","Cow calf"]' for "kill any of these".
  // Matched case-insensitively against the NPC the plugin reports on death. These NPCs
  // need NOT be on the OSRS hiscores (that's the whole point — chickens, cows, etc.).
  // The kill count needed is stored in `requiredAmount`; `trackingMode` decides whether
  // kills accumulate across the team or any single member's kills count. NULL for non-kill tiles.
  // Reused per-tileType (like diary/CA selectors): PVP tiles (tile_type='pvp') store
  // '["team:other"]' (any rival team member counts) or '["rsn:<name>", ...]' bounties here.
  targetNpcs: text('target_npcs'),
  // TIMED tiles (tile_type='timed'). Free-text activity identifier the plugin maps to an
  // internal timer — e.g. "Inferno", "Chambers of Xeric", "Fortis Colosseum", or a boss
  // name. The plugin times a clear (region-enter → boss-death/completion) and bakes the
  // duration onto the screenshot. NULL for non-timed tiles.
  timedActivity: text('timed_activity'),
  // TIMED tiles. The completion-time cap in seconds. The tile completes when a submission
  // reports a duration ≤ this value (pass/fail, not a leaderboard). NULL for non-timed tiles.
  timeThresholdSeconds: integer('time_threshold_seconds'),
  // TIMED raid tiles — require exactly this many players in the raid instance (NULL = any).
  // Deathless and drop tiles keep their party gates in the overloaded timeThresholdSeconds
  // column (plugin back-compat); timed tiles can't reuse it since it already holds the cap.
  partySize: integer('party_size'),
  // PVP tiles (tile_type='pvp'). Minimum loot value in gp a kill must yield to count toward the
  // tile — an anti-farm floor so killing naked alts/teammates doesn't credit. NULL/0 = no minimum
  // (every attributed kill counts, matching legacy behaviour and still crediting loot-key kills).
  // When > 0 the plugin defers the credit until it prices the kill's loot and only counts kills
  // worth at least this much — so a positive floor cannot credit loot-key / no-loot kills. A gp
  // value (not seconds) so it needs its own column rather than reusing timeThresholdSeconds.
  pvpMinLootValue: integer('pvp_min_loot_value'),
  // Free-text grouping label (e.g. "Zulrah", "Slayer", "Skilling", "GWD") used to
  // filter tasks by boss/skill/category in the RuneLite plugin's collection-log tab.
  // NULL = uncategorised.
  category: text('category'),
  // Point weight for this tile in a 'points'-scoring event (ignored when the
  // event's scoringMode is 'tiles'). Harder tiles carry more points. Defaults to
  // 1 so a points event behaves like a tile-count event until weights are set.
  points: integer('points').default(1).notNull(),
  // Optimistic-concurrency stamp: bumped on every config edit (PUT/import). The editor
  // sends the value it loaded as `baseUpdatedAt`; a mismatch means someone else saved in
  // between and the write is rejected (409) instead of silently clobbering theirs.
  // Nullable: legacy rows have no stamp until their first post-migration edit.
  updatedAt: text('updated_at'),
  // Per-tile reveal state — only meaningful when the event's rules.revealPolicy != 'all'
  // (see lib/eventRules.ts); NULL on classic events. All ISO UTC strings.
  //   revealAt   — the PLANNED reveal time ('scheduled' policy; admin-set on the Tiles tab).
  //   revealedAt — when the tile actually went live (stamped by the reveal engine — scheduled
  //                due-times, interval/bounty draws). A tile is member-visible iff this is set.
  //   closedAt   — when a 'bounty' tile was claimed (first completion) and stopped accepting
  //                further completions. Closed tiles stay visible on the board.
  revealAt: text('reveal_at'),
  revealedAt: text('revealed_at'),
  closedAt: text('closed_at'),
  // MISSION tiles (DMM-All-Stars-style objectives dropped mid-event). A mission is hidden until
  // ANNOUNCED (which stamps revealedAt, the decay anchor) — independent of the board's revealPolicy,
  // so a classic bingo can still drop missions while its normal tiles stay visible. Announced from
  // their own pool (event rules.mission: manual / interval / scheduled, random or in order); each
  // mission carries its own scoring in `rules` and can auto-expire.
  mission: integer('mission').default(0).notNull(),
  // Per-MISSION scoring JSON (null on normal tiles): { lockout?, firstBonus?, decay?:{targetPct,hours},
  // expiryHours? } — parsed by lib/eventRules.parseTileMissionRules and merged over the event rules in
  // the completion gate. Decay/first-bonus only bite in a points-scoring event; lockout works anywhere.
  rules: text('rules'),
}, (table) => [
  index('tiles_event_id_idx').on(table.eventId),
]);

// Advisory per-tile edit locks: opening the tile editor acquires one (TTL + heartbeat),
// so a second admin opening the same tile is warned who's already in it. Purely advisory —
// the hard guard against clobbering is tiles.updatedAt above. Expired rows are reaped on
// the next acquire attempt; tile deletion cascades the lock away.
export const tileLocks = sqliteTable('tile_locks', {
  tileId: integer('tile_id').primaryKey().references(() => tiles.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull(),
  username: text('username').notNull(),
  acquiredAt: text('acquired_at').notNull(),
  expiresAt: text('expires_at').notNull(),
});

// Append-only history of tile config changes: who created / updated / deleted / imported /
// reordered tiles on an event's board, and what changed. Scoped by `eventId` so the event's
// Tiles tab can render a timeline. `tileId` is a plain int (NOT an FK) so a row survives the
// tile being deleted; `tileLabel` snapshots the name so the history stays readable afterwards.
// Mirrors the clan_audit_log conventions (free-text action, JSON old/new snapshots, actor).
export const tileAuditLog = sqliteTable('tile_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  tileId: integer('tile_id'), // no FK — history outlives the tile it describes
  tileLabel: text('tile_label'), // label snapshot at the time of the change
  // What happened: 'created' | 'updated' | 'deleted' | 'duplicated' | 'imported' | 'reordered'.
  action: text('action').notNull(),
  // For 'updated': JSON array of { field, label, from, to } for each changed column.
  changedFields: text('changed_fields'),
  // JSON field snapshots: newValue for created, oldValue for deleted, summary counts for import.
  oldValue: text('old_value'),
  newValue: text('new_value'),
  actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  occurredAt: text('occurred_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('tile_audit_log_event_id_idx').on(table.eventId),
  index('tile_audit_log_occurred_at_idx').on(table.occurredAt),
  index('tile_audit_log_tile_id_idx').on(table.tileId),
]);

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  // Captains are Discord-linked users — `captainUserId` references `users.id` and is the
  // sole captain identifier. The legacy `captain_password` column was retired once
  // Discord login became required to participate; the column stays in DDL only because
  // SQLite makes drops painful, but no code reads or writes it.
  captainPassword: text('captain_password'),
  captainUserId: integer('captain_user_id').references(() => users.id, { onDelete: 'set null' }),
  // Discord team-channel provisioning (bot-driven, see lib/discord-teams.ts). The
  // dedicated role gating this team's locked channels, plus the channels themselves.
  // All null until provisioned; cleared on teardown. The role is what contestants on
  // this team are given so they can see/join the team's text + voice channels.
  discordRoleId: text('discord_role_id'),
  discordTextChannelId: text('discord_text_channel_id'),
  discordVoiceChannelId: text('discord_voice_channel_id'),
}, (table) => [
  index('teams_event_id_idx').on(table.eventId),
  index('teams_captain_user_id_idx').on(table.captainUserId),
]);

export const completions = sqliteTable('completions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  tileId: integer('tile_id').notNull().references(() => tiles.id, { onDelete: 'cascade' }),
  completedAt: text('completed_at').default(sql`(datetime('now'))`).notNull(),
  // The player who finished it: a stat tile (boss KC / skilling) that completed via the hiscores
  // sweep or a live push and so has NO submission to attribute, or a Solo count tile, where one
  // member reaching the count alone IS the completion (lib/countProgress). NULL for team-total
  // tiles and admin manual completions — the activity feed attributes those from the latest
  // submission instead. Lets the feed read "Kayle completed 500 Zulrah KC", not "Team …".
  creditPlayerId: integer('credit_player_id').references(() => players.id, { onDelete: 'set null' }),
  // Frozen per-member KC/XP split, captured at the instant a STAT tile completes. JSON:
  // {"goal":500,"total":512,"split":[{"playerId":12,"gained":300},{"playerId":34,"gained":212}]}.
  // Locks "who contributed what %" to completion time — the underlying hiscores stat keeps climbing
  // afterwards, but a finished tile's attribution (and its display) must not drift. NULL for
  // submission-backed / manual / non-stat completions (those already have stable per-submission
  // amounts) and for legacy stat completions that predate this column (reads fall back to live).
  statContributions: text('stat_contributions'),
  // Points this completion actually earned, FROZEN at completion time — only stamped on
  // points-mode events whose rules add per-completion modifiers (first-team bonus, reveal
  // decay). NULL = no modifier applied; standings fall back to the tile's live weight, which
  // keeps legacy events (and admin mid-event point re-tuning) exactly as they were.
  awardedPoints: integer('awarded_points'),
}, (table) => [
  uniqueIndex('team_tile_unique').on(table.teamId, table.tileId),
  index('completions_tile_id_idx').on(table.tileId),
  index('completions_team_id_idx').on(table.teamId),
]);

export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // clanMemberId is the source of truth for identity; `name` is kept as a per-event
  // display override (useful if an RSN changes mid-event). New enrollments should
  // always supply clanMemberId; legacy rows have it backfilled.
  clanMemberId: integer('clan_member_id').references(() => clanMembers.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  discord: text('discord'),
  timezone: text('timezone'),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  pickNumber: integer('pick_number'),
  pickedAt: text('picked_at'),
  statsSnapshot: text('stats_snapshot'),
  snapshotAt: text('snapshot_at'),
  playerToken: text('player_token'),
  cachedStats: text('cached_stats'),
  lastStatsFetch: text('last_stats_fetch'),
  // Real-time boss KC pushed by the plugin, as a flat JSON map of hiscores boss key -> absolute
  // count ({"zulrah":1250}). Separate from cachedStats so the hourly hiscores cron never clobbers
  // it; reads take max(cachedStats, pluginStats) per key, and the cron prunes an entry once
  // hiscores catches up. Lets boss-KC tiles complete instantly instead of waiting on hiscores lag.
  pluginStats: text('plugin_stats'),
  // Bench / sub-out. When set, the player is frozen: the hiscores sweep stops fetching them and their
  // stat gain is pinned to `frozenStats` (below) instead of climbing off live hiscores/plugin pushes.
  // Their frozen gains STILL count toward team-mode tiles that complete later, and they keep showing in
  // the member breakdown with their locked contribution — a sub-in gets a fresh baseline and stacks on
  // top. NULL = actively tracked. Cleared on unfreeze and on progress-reset.
  frozenAt: text('frozen_at'),
  // Snapshot of `cachedStats` taken at the moment of freeze — the authoritative "current" for a frozen
  // player everywhere gains are computed (cron team-sum seeding, standings, gains API), so their gain =
  // frozenStats − statsSnapshot stays fixed. NULL when not frozen.
  frozenStats: text('frozen_stats'),
  // Fun end-of-event "recap" counters, pushed by the plugin as ABSOLUTE per-event totals and max-merged
  // (idempotent — a retry / client restart can't double-count). `deaths` = the player's own deaths this
  // event; `lootGpGained` = GE value of ALL loot the plugin saw this event (not just value-tile hauls);
  // `pvpKills` = every "You have defeated" the plugin saw this event, so the PKer superlative works
  // even when the board has no pvp tile. Purely cosmetic (superlatives — "Most Deaths", "Loot Lord",
  // "PKer"); never feeds scoring. See lib/eventRecap.
  deaths: integer('deaths').default(0),
  lootGpGained: integer('loot_gp_gained').default(0),
  pvpKills: integer('pvp_kills').default(0),
  // Same contract, added later: `biggestHit` = hardest single hitsplat landed this event
  // ("Heavy Hitter"); `minutesPlayed` = minutes actually logged in during it, counted from game
  // ticks. Play time is the one that turns every other counter into a rate — "most kills" is
  // usually just "played most". Older plugins never send either; the columns simply stay 0 and
  // their awards are omitted from the recap.
  biggestHit: integer('biggest_hit').default(0),
  minutesPlayed: integer('minutes_played').default(0),
}, (table) => [
  uniqueIndex('player_token_unique').on(table.playerToken),
  index('players_event_id_idx').on(table.eventId),
  index('players_event_team_idx').on(table.eventId, table.teamId),
  index('players_clan_member_id_idx').on(table.clanMemberId),
]);

export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tileId: integer('tile_id').notNull().references(() => tiles.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  playerId: integer('player_id').references(() => players.id, { onDelete: 'set null' }),
  creditPlayerId: integer('credit_player_id').references(() => players.id, { onDelete: 'set null' }),
  amount: integer('amount').default(1).notNull(),
  imageUrl: text('image_url'),
  note: text('note'),
  itemId: integer('item_id'), // which specific tracked item this submission is for (per-item tracking)
  // TIMED-tile submissions only: the measured completion time in seconds, as reported
  // (and baked onto the screenshot) by the plugin. NULL for drop/kill submissions. The
  // tile completes when any submission's durationSeconds ≤ tile.timeThresholdSeconds.
  durationSeconds: integer('duration_seconds'),
  // FEDERATION_SECURITY.md §3 — the instanceId of the REMOTE home that relayed this credit in via
  // POST /api/federation/v1/events. NULL for every native (non-federated) submission. Its presence
  // makes a relayed write auditable + reversible by this clan (the receiver never trusts the relay
  // itself, only the token + content, so a mis-relay can be traced to its source and undone).
  federatedSource: text('federated_source'),
  // FEDERATION_SECURITY.md §9 / decision #3 — for a FEDERATED relayed (cross-clan) submission the proof
  // image lives on the ORIGIN clan's media host, which fails THIS clan's own-media check and must NOT be
  // auto-fetched (no auto-loaded federated media — IP-leak / tracking-pixel / SSRF). We keep the origin
  // URL here as an AUDIT-ONLY, reversible reference (never rendered or fetched by us); the trusted-home-
  // bounded credit proceeds off the token + content. NULL for native submissions and the origin's own
  // (managed-media) proof, which continues to use `imageUrl`.
  federatedProofUrl: text('federated_proof_url'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('submissions_tile_id_idx').on(table.tileId),
  index('submissions_team_id_idx').on(table.teamId),
  index('submissions_tile_team_idx').on(table.tileId, table.teamId),
]);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

/**
 * Device-code sign-in for the plugin (RFC 8628 shape, home-native — no broker involved). The plugin
 * POSTs /api/plugin/auth/start, opens THIS site's /link-device page in the member's browser (URL
 * pinned plugin-side to the configured home origin), and polls /api/plugin/auth/poll until the
 * logged-in member approves the code — then the poll returns the account token exactly once.
 * Works identically for hosted, self-hosted-networked, and fully-standalone instances.
 */
export const pluginDeviceCodes = sqliteTable('plugin_device_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // SHA-256 of the long random device_code the plugin holds; the raw value is never stored.
  deviceCodeHash: text('device_code_hash').notNull(),
  // Short human-typeable code shown in the plugin and confirmed on /link-device. Unambiguous
  // alphabet, formatted XXXX-XXXX.
  userCode: text('user_code').notNull(),
  // pending → approved (member confirmed; user_id bound) → redeemed (token issued ONCE, single-use)
  // | denied (member rejected) | expired (TTL elapsed, stamped lazily on poll).
  status: text('status').notNull().default('pending'),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  // Minimum seconds between polls (slow_down pacing if the plugin polls faster).
  interval: integer('interval').notNull().default(5),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  expiresAt: text('expires_at').notNull(),
  lastPolledAt: text('last_polled_at'),
}, (t) => [
  uniqueIndex('plugin_device_codes_hash_unique').on(t.deviceCodeHash),
  uniqueIndex('plugin_device_codes_user_code_unique').on(t.userCode),
  index('plugin_device_codes_expires_idx').on(t.expiresAt),
]);

// Tiny fixed-window rate-limit bucket store. Rows are self-garbage-collected
// by an opportunistic DELETE on each write; nothing else needs scheduling.
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(), // "<scope>:<ident>:<window-start-ms>"
  count: integer('count').default(1).notNull(),
  expiresAt: text('expires_at').notNull(),
}, (table) => [
  index('rate_limits_expires_at_idx').on(table.expiresAt),
]);

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Dead legacy columns (username + password_hash). Discord OAuth is the only auth path now;
  // these are left in the table to keep migrations cheap. Stop reading/writing them.
  username: text('username').unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash'),
  // 'admin' | 'treasurer' | 'editor' | 'moderator' | 'member'. Treasurer and editor are
  // mod-tier roles with one extra capability each (fee collection / tile authoring).
  //   admin > {treasurer, editor} > moderator > member.
  role: text('role').notNull().default('member'),
  // Editor reach. Only meaningful for role 'editor':
  //   'all'      — global editor: can author tiles on EVERY event (the classic editor behavior).
  //   'assigned' — board-scoped editor: can author tiles only on events they hold an event_editors
  //                grant for, and only sees those events in the admin list.
  // Defaults to 'all' so every pre-existing editor keeps global reach. Non-editor roles ignore it.
  // A plain member auto-provisioned via a board grant is set to role 'editor' + scope 'assigned';
  // revoking their last grant reverses that back to 'member' + 'all'. See lib/eventEditors.
  editorScope: text('editor_scope').notNull().default('all'),
  // Tile authoring as a CAPABILITY rather than a role. `role` is the base tier (member <
  // moderator < treasurer < admin) and this rides on top of any of them, so "a moderator who
  // builds boards" or "a treasurer who does fees AND tiles" is one checkbox instead of a new role
  // per combination. Admins always have it implicitly; per-board `event_editors` grants are the
  // narrower version for someone who should only touch one event.
  //
  // The legacy `editor` role predates this and meant "member with global authoring" — migration
  // 0048 converts those rows, and nothing new should ever write role='editor'.
  canEditTiles: integer('can_edit_tiles', { mode: 'boolean' }).notNull().default(false),
  // The clan owner — the person who provisioned this instance. Exactly one user has this set.
  // Owner == admin for every permission gate (their role stays 'admin'); the flag only adds
  // *protections*: the owner cannot be demoted or deleted by anyone, and only the owner can
  // transfer ownership. Granted once at genesis to the ADMIN_DISCORD_ID user on a fresh
  // instance; never auto-reassigned afterwards. See transfer-ownership route.
  isOwner: integer('is_owner', { mode: 'boolean' }).notNull().default(false),
  // Site ban. A banned user gets no authenticated session (verifyUser → null) and is refused on
  // Discord login, so they can't act as a member/staff. The owner can never be banned. (Public,
  // logged-out pages stay public — blocking those is an IP/Caddy concern, not this flag.)
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  bannedAt: text('banned_at'),
  bannedReason: text('banned_reason'),
  bannedByUserId: integer('banned_by_user_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  createdBy: integer('created_by'),
  // Discord OAuth identity (the primary login path for non-staff users)
  discordId: text('discord_id').unique(),
  discordUsername: text('discord_username'),
  discordAvatar: text('discord_avatar'),
  email: text('email'),
  lastLoginAt: text('last_login_at'),
  // Long-lived per-user plugin token. The RuneLite plugin stores this once and uses it
  // across events — the server resolves the active event/team/player row at request
  // time using the user's clan_members + the current in-game RSN sent with each call.
  // Rotated by the user from /profile if leaked. Nullable for legacy users; lazily
  // generated the first time the user opens the plugin section.
  pluginToken: text('plugin_token'),
  // When the member last established a federation identity via the broker device-code login
  // (WIRE §10.3). Set on a completed login even if it yielded zero remote clans, so the plugin
  // can show a durable "signed in / Disconnect" state instead of re-offering "Connect clans" on
  // every reload; cleared on POST /federation/disconnect. NULL = never federated.
  federationLinkedAt: text('federation_linked_at'),
  // The member's broker session token (30-day, WIRE §9.2), encrypted at rest like the cached
  // remote-clan tokens. Persisted after a completed device login so /state can periodically re-run
  // the /me/instances relay — a clan the member connects LATER shows up here without a manual
  // re-login. NULL until the first login; nulled when the broker rejects it or on disconnect.
  federationBrokerSession: text('federation_broker_session'),
  // Last successful connection-set sync via the relay — throttles the background refresh.
  federationSyncedAt: text('federation_synced_at'),
}, (table) => [
  uniqueIndex('users_plugin_token_unique').on(table.pluginToken),
]);

// Board-scoped tile-editing grants. A row means `userId` may author tiles on `eventId` even though
// they aren't a global editor — the per-board alternative to the all-events 'editor' role. Enforced
// by verifyTileEditorForEvent (auth.ts) and managed via lib/eventEditors. Cascades away with either
// the event or the user. See [[editor-role-tile-authoring]] for the global-role counterpart.
export const eventEditors = sqliteTable('event_editors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  // The admin who granted this (audit only; nullable for system/backfill rows).
  grantedByUserId: integer('granted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  uniqueIndex('event_editors_event_user_unique').on(table.eventId, table.userId),
  index('event_editors_user_idx').on(table.userId),
]);

export const weeklyCompetitions = sqliteTable('weekly_competitions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // 'skill' | 'boss'
  metric: text('metric').notNull(), // e.g. 'attack', 'zulrah'
  title: text('title').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('upcoming'), // 'upcoming' | 'active' | 'completed'
  // Whether auto-enrollment sweeps in guests (clan_members.is_guest = 1) alongside full members.
  // Per-competition, set at creation and default ON — a weekly is a clan-wide activity and most
  // clans want everyone on the roster racing. Turn it off for a members-only comp. Supersedes the
  // old clan-wide `weekly_track_guests` setting, which now only seeds the create form's default;
  // competitions that predate this column were backfilled from it (migration 0043).
  includeGuests: integer('include_guests').notNull().default(1),
});

export const weeklyParticipants = sqliteTable('weekly_participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competitionId: integer('competition_id').notNull().references(() => weeklyCompetitions.id, { onDelete: 'cascade' }),
  // clanMemberId links back to the global roster so leaderboards can deduplicate
  // when an RSN is renamed. Kept nullable to support legacy rows and guest-only participants.
  clanMemberId: integer('clan_member_id').references(() => clanMembers.id, { onDelete: 'set null' }),
  rsn: text('rsn').notNull(),
  // Lowercased/whitespace-collapsed copy used for uniqueness. OSRS names are case-insensitive,
  // so two casings of the same name would otherwise create duplicate enrollments.
  rsnNormalized: text('rsn_normalized').notNull(),
  baselineValue: integer('baseline_value'),
  currentValue: integer('current_value'),
  lastUpdated: text('last_updated'),
  // Set when a single stat fetch records an implausibly large jump (XP/KC gained in
  // one tick that exceeds the max plausible rate — see src/lib/gainsValidation.ts).
  // The usual cause is OSRS hiscores flushing a pre-event grind on logout, sweeping
  // pre-comp progress into the gain. Flag persists until an admin corrects the
  // baseline. flagReason carries a human-readable summary for the admin UI tooltip.
  flagged: integer('flagged').notNull().default(0),
  flagReason: text('flag_reason'),
  // Admin override: when 1, keep this participant on the leaderboard even if their clan_member
  // has left the CC. Default 0 means a leaver is dropped from the standings (and the headcount)
  // for the rest of the comp. Lets mods re-include someone who left by accident.
  keepIfLeft: integer('keep_if_left').notNull().default(0),
}, (table) => [
  uniqueIndex('weekly_participant_unique').on(table.competitionId, table.rsnNormalized),
  index('weekly_participants_comp_id_idx').on(table.competitionId),
  index('weekly_participants_clan_member_id_idx').on(table.clanMemberId),
]);

// Global clan roster. Source of truth for "who is in the clan" across all events.
// Per-event enrollment lives in `players` (and `weeklyParticipants`) and references a row here.
export const clanMembers = sqliteTable('clan_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rsn: text('rsn').notNull(),                 // display casing
  rsnNormalized: text('rsn_normalized').notNull(), // lowercased for uniqueness (OSRS is case-insensitive)
  discordId: text('discord_id'),              // legacy column; prefer joining via userId → users.discordId
  rank: text('rank'),                         // clan rank name as reported by RuneLite (e.g. 'general', 'captain')
  isGuest: integer('is_guest').default(0).notNull(),
  source: text('source').notNull().default('manual'), // 'manual' | 'plugin-self' | 'plugin-roster'
  joinedAt: text('joined_at').default(sql`(datetime('now'))`).notNull(),
  leftAt: text('left_at'),                    // soft-delete timestamp; null = active
  lastSeenInClan: text('last_seen_in_clan'),  // bumped on each roster sync that includes this rsn
  notes: text('notes'),
  // Owner — the human/Discord account behind this RSN. Null = ghost (unclaimed).
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  // Stable Jagex identity captured during plugin handshake. Survives RSN changes.
  // Null for ghost members and for members verified via stat-delta or manual approval.
  accountHash: text('account_hash'),
  // JSON array of historical RSNs. Appended whenever a rename is detected for this account.
  previousRsns: text('previous_rsns'),
  // Marks the user's "primary" account when they have multiple alts.
  isPrimary: integer('is_primary').default(0).notNull(),
  verifiedAt: text('verified_at'),
  verificationMethod: text('verification_method'), // 'plugin' | 'stat_delta' | 'manual'
  verifiedByUserId: integer('verified_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  // Watchlist flag — set to 1 when stat-delta succeeds (proves account control but
  // a coincidental match is theoretically possible). A mod must confirm before this
  // clears. Plugin and manual verification skip the watchlist (provisional = 0 from
  // the start). The audit log records who confirmed and when.
  provisional: integer('provisional').default(0).notNull(),
  // When a ghost record was claimed by a Discord-linked user.
  claimedAt: text('claimed_at'),
  // Pre-assigned role applied to the linked user when this member's verification
  // is finalized. Plugin-verified claims apply immediately; stat-delta/manual
  // claims wait for mod approval before promoting the user. Cleared once applied.
  // Values: 'admin' | 'moderator' | null.
  pendingRole: text('pending_role'),
  // Tracking lifecycle. `active` = normal polling. `unranked` = hiscores returned
  // 404 (renamed, banned, or genuinely not on hiscores yet) — skipped by the cron
  // until a re-probe job lifts them back. `banned` / `archived` = manual flags.
  // The cron's queue health depends on this: without it, a renamed account 404s
  // every tick forever and steals a slot from healthy rows.
  status: text('status').notNull().default('active'), // 'active' | 'unranked' | 'banned' | 'archived'
  statusLastChecked: text('status_last_checked'),
  // Member-scoped real-time overlay: the plugin's absolute boss-KC / skill-XP pushes as a flat
  // JSON map ({"zulrah":1250,"mining":4210000}), max-merged per key. The single source the unified
  // stat sweep reads as max(hiscores, live) and prunes as hiscores catches up — shared by bingo
  // tiles AND weekly SOTW/BOTW. Keyed on the member (not a per-event player row) so it survives
  // renames and works with no active bingo event. Replaces the per-event players.plugin_stats.
  liveStats: text('live_stats'),
  liveStatsAt: text('live_stats_at'), // last push timestamp (staleness / observability)
  // Per-KEY last-rose timestamps: JSON map ({"fishing":"2026-07-16T…","zulrah":"…"}) stamped only when
  // a pushed value actually INCREASED. Lets "Active now" say a member is grinding a SPECIFIC stat tile
  // (its stat rose within the window) instead of every tile they've ever progressed — liveStatsAt alone
  // is per-member, so one fishing push otherwise lit them up on every tile. Pruned to the recent window.
  liveStatKeyTimes: text('live_stat_key_times'),

  // ── Adaptive hiscores polling ──────────────────────────────────────────────────────────────────
  // The sweep used to poll every participating member every tick, whether or not they had played —
  // a 200-member clan spending 19k requests a day to learn that 160 people were offline. These three
  // let it poll on evidence instead: after a fetch that changed nothing, the member's next fetch is
  // pushed further out; any change (or any plugin push, which means they're online right now) snaps
  // them back to hot. See nextDueAfterMiss() in the stats cron for the ladder.
  //
  // This matters more per clan we host than per member: every clan container polls Jagex from the
  // same box IP, so the per-clan rate limit composes into a per-box one.
  statsOverallXp: integer('stats_overall_xp'),      // last observed total XP — the change detector
  statsMissStreak: integer('stats_miss_streak').notNull().default(0),
  statsNextDueAt: text('stats_next_due_at'),        // null = due now
  // The member's last seen full snapshot, so the daily rollup can say WHICH metrics moved rather than
  // just how much total XP did. One row per member, overwritten — bounded, unlike a per-day archive —
  // and only rewritten on a tick where something actually changed.
  statsLastSnapshot: text('stats_last_snapshot')
}, (table) => [
  uniqueIndex('clan_members_rsn_normalized_unique').on(table.rsnNormalized),
  uniqueIndex('clan_members_account_hash_unique').on(table.accountHash),
  index('clan_members_left_at_idx').on(table.leftAt),
  index('clan_members_user_id_idx').on(table.userId),
  index('clan_members_provisional_idx').on(table.provisional),
  index('clan_members_status_idx').on(table.status),
]);

// Append-only history of what happened to clan_members rows: joined, left, returned,
// renamed, verified, claimed, merged, promoted, demoted. Powers the admin audit view
// and the Discord audit pings.
export const clanAuditLog = sqliteTable('clan_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clanMemberId: integer('clan_member_id').references(() => clanMembers.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  // Snapshots of relevant fields before/after the event, JSON-encoded. Examples:
  //   renamed: {"rsn":"OldName"}, {"rsn":"NewName"}
  //   verified: null, {"method":"plugin","accountHash":"…"}
  //   merged: {"mergedFromMemberId":42}, {"intoMemberId":17}
  oldValue: text('old_value'),
  newValue: text('new_value'),
  actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  occurredAt: text('occurred_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('clan_audit_log_member_id_idx').on(table.clanMemberId),
  index('clan_audit_log_occurred_at_idx').on(table.occurredAt),
  index('clan_audit_log_event_type_idx').on(table.eventType),
]);

// Stat-delta verification: a Discord-linked user claims an RSN, we snapshot Hiscores XP
// per skill, ask them to gain ≥minDelta XP in any skill within the window, then re-poll.
// On success we mark the corresponding clanMember verified with method='stat_delta'.
export const verificationAttempts = sqliteTable('verification_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rsn: text('rsn').notNull(),
  rsnNormalized: text('rsn_normalized').notNull(),
  // JSON: {"overall": 12345, "attack": 1000, ...}
  baselineSnapshot: text('baseline_snapshot').notNull(),
  minDelta: integer('min_delta').default(1000).notNull(),
  expiresAt: text('expires_at').notNull(),
  completedAt: text('completed_at'),
  succeeded: integer('succeeded').default(0).notNull(),
  failureReason: text('failure_reason'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('verification_attempts_user_id_idx').on(table.userId),
  index('verification_attempts_rsn_normalized_idx').on(table.rsnNormalized),
  index('verification_attempts_expires_at_idx').on(table.expiresAt),
]);

// Opt-in inbox for plugin-detected accounts. When a user authenticates the plugin with
// their Account Token and plays a RuneScape account that isn't yet attributed to anyone,
// the site records a suggestion here (it never auto-claims). The user then Adds (claims +
// verifies the clan_member) or Ignores (status → 'dismissed', so it isn't re-suggested) the
// account from /profile. One row per (user, rsn); accountHash captured when the plugin
// reports it so an Add survives a later in-game rename.
export const detectedAccounts = sqliteTable('detected_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rsn: text('rsn').notNull(),                       // display casing as last reported in-game
  rsnNormalized: text('rsn_normalized').notNull(),  // lowercased for the per-user uniqueness guard
  accountHash: text('account_hash'),                // stable Jagex id when the plugin reports it
  status: text('status').notNull().default('pending'), // 'pending' | 'dismissed'
  detectedAt: text('detected_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),       // bumped each time we see them play it
}, (table) => [
  uniqueIndex('detected_accounts_user_rsn_unique').on(table.userId, table.rsnNormalized),
  index('detected_accounts_user_id_idx').on(table.userId),
  index('detected_accounts_status_idx').on(table.status),
]);

// Long-lived plugin tokens issued to an admin after they've verified via the link flow.
// Distinct from per-event `players.playerToken` (which scopes a player to one event/team).
// Used to authenticate admin-only plugin actions (clan-sync, etc). Not RSN-bound — the
// admin can use this token from any in-game character on their account.
export const pluginLinks = sqliteTable('plugin_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
}, (table) => [
  uniqueIndex('plugin_links_token_unique').on(table.token),
  index('plugin_links_user_id_idx').on(table.userId),
]);

// Per-event sign-up. One row per (event, user) — a Discord account can only sign up once
// per event but may own multiple clanMembers; `clanMemberId` is the single RSN they chose
// to play this event with (the bingo only tracks that account). `profileData` is a frozen
// snapshot of the responses captured at submit time, editable by the user up until
// `events.signupDeadline`. New signups prefill from the user's most recent prior signup so
// they don't re-type unchanged answers.
export const eventSignups = sqliteTable('event_signups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // Nullable: a "guest" sign-up for an in-game roster member who has no linked site user yet
  // (e.g. added by an admin / by name). Linked members carry their user id. A person may now enter up
  // to events.maxAccountsPerPerson accounts, so there's no one-per-user unique any more; dedup is per
  // ACCOUNT via the (eventId, clanMemberId) unique below, which covers guests (NULL userId) too.
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMembers.id, { onDelete: 'restrict' }),
  // JSON: { dailyHours, weeklyHours, bosses[], skills[], notes, ...customFields }. One profile PER
  // PERSON: when someone enters several accounts, the answers live on their PRIMARY account's row and
  // the sibling rows carry '{}' — the read-time join backfills them (see lib/draftProfiles).
  profileData: text('profile_data').notNull().default('{}'),
  // pending = awaiting fee/admin review, approved = eligible for draft, rejected = denied,
  // withdrawn = user opted out before the deadline.
  status: text('status').notNull().default('pending'),
  // When set, this approved sign-up does NOT count toward the entry-fee prize pool (lib/prizePool).
  // For non-paying entries — a mid-event sub-in replacing someone who already paid, a comped player,
  // a staff freebie — so swapping the roster doesn't inflate the displayed pool past the real money in.
  excludeFromPrizePool: integer('exclude_from_prize_pool', { mode: 'boolean' }).notNull().default(false),
  signedUpAt: text('signed_up_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  // Multi-account: a person (userId) may now enter up to events.maxAccountsPerPerson accounts, so the
  // old one-per-user unique is gone. Dedup is per ACCOUNT instead — one sign-up per (event, clanMember)
  // — which also naturally covers guest rows (userId NULL). The (event, user) lookup stays a plain index.
  uniqueIndex('event_signup_member_unique').on(table.eventId, table.clanMemberId),
  index('event_signup_event_user_idx').on(table.eventId, table.userId),
  index('event_signups_event_id_idx').on(table.eventId),
  index('event_signups_user_id_idx').on(table.userId),
  index('event_signups_clan_member_id_idx').on(table.clanMemberId),
]);

// Sign-up fee tracking. One row per signup. Status flow:
//   pending → reported (player names who they paid) → collected (mod claims + uploads proof)
//   → confirmed (admin clears; proof blob is then deleted to save storage)
// disputed = collector claim and player report disagree; surfaces an admin badge.
export const signupFees = sqliteTable('signup_fees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  signupId: integer('signup_id').notNull().references(() => eventSignups.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('pending'),
  // Mod/admin who claims they collected the fee. Site role (moderator/admin) is what
  // grants this ability — clan rank is irrelevant.
  collectedByUserId: integer('collected_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  collectedAt: text('collected_at'),
  // Player's self-report of who they paid. Used to detect disputes against collectedByUserId.
  reportedCollectorUserId: integer('reported_collector_user_id').references(() => users.id, { onDelete: 'set null' }),
  reportedAt: text('reported_at'),
  // Vercel Blob URL of the proof screenshot. Nulled out after admin confirmation as
  // part of the cleanup-on-confirm flow.
  proofBlobUrl: text('proof_blob_url'),
  confirmedByUserId: integer('confirmed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  confirmedAt: text('confirmed_at'),
  // JSON array of distinct confirmers: [{ userId, at }]. Backs the admin-configurable
  // "require N confirmations" flow — the fee only flips to 'confirmed' (and its proof is
  // deleted) once this reaches the `fee_confirmations_required` setting. confirmedByUserId /
  // confirmedAt keep pointing at the final confirmer for back-compat.
  confirmations: text('confirmations'),
  notes: text('notes'),
}, (table) => [
  uniqueIndex('signup_fees_signup_unique').on(table.signupId),
  index('signup_fees_status_idx').on(table.status),
]);

// Prize payouts to event winners — the outbound mirror of signup_fees. One row per RECIPIENT
// (per-player split: the winning team's prize divides equally across its members, one editable row
// each). Amounts are auto-suggested from the prize pool at generation time, then admin-editable.
// Status flow: pending → paid (a treasurer/admin marks it, optionally attaching a screenshot). When
// every payout for the event is paid, the winners+amounts are announced to the bingo webhook.
export const payouts = sqliteTable('payouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // Recipient identity. clanMemberId is the stable link (set null if the member is later deleted or
  // for free-form manual rows); `rsn` is the display name captured when the row was created.
  clanMemberId: integer('clan_member_id').references(() => clanMembers.id, { onDelete: 'set null' }),
  rsn: text('rsn').notNull(),
  // Which team they won with + finishing place (1 = first). Null for free-form manual entries.
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  teamName: text('team_name'),
  place: integer('place'),
  amount: integer('amount').notNull().default(0), // gp
  // pending → paid. Kept as text (not a boolean) for parity with fee statuses and future states.
  status: text('status').notNull().default('pending'),
  // Storage URL of the optional payment-proof screenshot (key prefix `payouts/`). Deleted when the
  // payout is reverted to pending or the row is removed.
  proofBlobUrl: text('proof_blob_url'),
  paidByUserId: integer('paid_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  paidAt: text('paid_at'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('payouts_event_id_idx').on(table.eventId),
  index('payouts_status_idx').on(table.status),
  // One auto-generated payout per (event, member). NULL clanMemberId rows (free-form) are exempt —
  // SQLite treats NULLs as distinct in a unique index — so multiple manual entries are allowed.
  uniqueIndex('payouts_event_member_unique').on(table.eventId, table.clanMemberId),
]);

// User-submitted RSN rename requests, reviewed by a cron pass that mirrors WOM's
// auto-reviewer heuristic (negative-gains check + new-name reachability). Covers the
// gap where a user renames in-game but doesn't re-open the plugin — without this, the
// `clan_members` row 404s forever and the user disappears from comps silently.
//
// Lifecycle: pending → approved (clan_member renamed, weekly_participants reconciled)
// or → denied (resolution column has the reason). Re-submissions with the same target
// RSN are allowed once a prior attempt is resolved; a unique partial-style guard is
// enforced at the application layer at submit time.
export const pendingRenames = sqliteTable('pending_renames', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMembers.id, { onDelete: 'cascade' }),
  oldRsn: text('old_rsn').notNull(),
  newRsn: text('new_rsn').notNull(),
  oldRsnNormalized: text('old_rsn_normalized').notNull(),
  newRsnNormalized: text('new_rsn_normalized').notNull(),
  // JSON snapshot of the old RSN's hiscores at submission time. The reviewer compares
  // each skill xp against the new-name fetch — any decrease is the WOM-canonical
  // "different account took the old name" signal and forces a denial.
  oldSnapshot: text('old_snapshot').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'denied'
  // Human-readable reason filled in when status leaves 'pending'.
  resolution: text('resolution'),
  submittedByUserId: integer('submitted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: text('reviewed_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('pending_renames_status_idx').on(table.status),
  index('pending_renames_member_idx').on(table.clanMemberId),
]);

// Append-only snapshot history. One row per successful hiscores fetch for a clan
// member. Two roles: (1) recompute leaderboards for any comp window without trusting
// the per-comp `currentValue` cache; (2) catch negative-gain anomalies retroactively.
// Payload is JSON to avoid a 200-column table for ~150 members.
export const playerSnapshots = sqliteTable('player_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMembers.id, { onDelete: 'cascade' }),
  // Competition this snapshot belongs to. Snapshots are scoped to a weekly competition so we
  // keep exactly two per (member, competition): a frozen 'baseline' at event start and a
  // 'current' overwritten every cron tick until the event ends. NULL only for legacy/orphan
  // rows the backfill keeps purely as a member's most-recent stats (rename detection).
  weeklyCompetitionId: integer('weekly_competition_id').references(() => weeklyCompetitions.id, { onDelete: 'cascade' }),
  // 'baseline' (insert-once, frozen at enrollment) | 'current' (upserted each tick).
  kind: text('kind').notNull().default('current'),
  capturedAt: text('captured_at').default(sql`(datetime('now'))`).notNull(),
  // JSON: { skills: { attack: {xp,level,rank}, ... }, bosses: { zulrah: {score,rank}, ... } }
  payload: text('payload').notNull(),
  // Denormalized for cheap ORDER BY and the rename detector's "latest overall XP" probe.
  overallXp: integer('overall_xp'),
}, (table) => [
  index('player_snapshots_member_captured_idx').on(table.clanMemberId, table.capturedAt),
  // One baseline + one current per member per competition. NULLs are distinct in SQLite, so
  // legacy/orphan rows (NULL competition) never collide here.
  uniqueIndex('player_snapshots_member_comp_kind_idx').on(table.clanMemberId, table.weeklyCompetitionId, table.kind),
]);

// One materialized row per PERSON per finished event — the longitudinal evidence the player
// profile folds over (balance-engine plan). Written once at event end (idempotent re-write on
// demand), backfillable for past events. A person = linked user ('u<id>') > clan member
// ('m<id>') > bare RSN ('n<rsn>') — durable across events, unlike per-event player ids.
export const playerEventFacts = sqliteTable('player_event_facts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  personKey: text('person_key').notNull(),
  clanMemberId: integer('clan_member_id').references(() => clanMembers.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  rsn: text('rsn').notNull(), // lead-account display name at event time
  accounts: integer('accounts').default(1).notNull(),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  // Outcome facts (points via the same split the scoreboard/MVP math uses).
  points: real('points').default(0).notNull(),
  tilesContributed: integer('tiles_contributed').default(0).notNull(),
  tilesFinished: integer('tiles_finished').default(0).notNull(),
  submissions: integer('submissions').default(0).notNull(),
  xpGained: integer('xp_gained').default(0).notNull(),
  kcGained: integer('kc_gained').default(0).notNull(),
  deaths: integer('deaths').default(0).notNull(),
  lootGpGained: integer('loot_gp_gained').default(0).notNull(),
  pvpKills: integer('pvp_kills').default(0).notNull(),
  // Timeline / reliability. Days are 1-based from event start; lastActiveDay NULL = never active.
  // July lesson: WHEN someone went dark matters as much as whether — a mid-event drop-off on a
  // collapsed team is environmental, not personal.
  activeDays: integer('active_days').default(0).notNull(),
  lastActiveDay: integer('last_active_day'),
  eventDays: integer('event_days'),
  subbedOut: integer('subbed_out').default(0).notNull(),
  // Team context, so the profile fold can discount demoralized-team events: the team's final
  // rank/points next to the winner's lets "gave up once buried" read differently from "no-show".
  teamRank: integer('team_rank'),
  teamsTotal: integer('teams_total'),
  teamPoints: real('team_points'),
  topTeamPoints: real('top_team_points'),
  // Extensible extras (timed PBs, per-domain rates) as JSON — additive without migrations.
  detail: text('detail'),
  computedAt: text('computed_at').notNull(),
}, (table) => [
  uniqueIndex('player_event_facts_event_person_idx').on(table.eventId, table.personKey),
  index('player_event_facts_person_idx').on(table.personKey),
]);

// Short-lived one-time codes an admin generates on the site and pastes into the plugin.
// Plugin exchanges {code, rsn} for a pluginLinks row.
export const pluginLinkCodes = sqliteTable('plugin_link_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  expiresAt: text('expires_at').notNull(),
  consumedAt: text('consumed_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  uniqueIndex('plugin_link_codes_code_unique').on(table.code),
  index('plugin_link_codes_user_id_idx').on(table.userId),
]);

// Server-side debounce buffer for bingo submission notifications. The plugin auto-submits drop/kill
// proof per event, which naively posts one Discord embed per submission — spammy for kill tiles that
// tick once per NPC (a boss with downtime flushes one post per kill). Instead each submission upserts
// a bucket here keyed by (tile, team); a flush — opportunistic on the next request plus a per-minute
// cron backstop — posts ONE merged embed per quiet window, or immediately when a submission completes
// the tile. The submission row itself is always written first, so nothing here is load-bearing: a
// dropped bucket loses a cosmetic post, never progress. Rows are deleted on flush.
export const pendingNotifications = sqliteTable('pending_notifications', {
  tileId: integer('tile_id').notNull().references(() => tiles.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // Sum of submission amounts buffered since the last flush (the "+N" in the merged post).
  pendingAmount: integer('pending_amount').notNull().default(0),
  // Latest team total + the tile's required amount, for the "(current/required)" line.
  latestTotal: integer('latest_total'),
  requiredAmount: integer('required_amount'),
  // Latest proof image (count-only kill pings carry none; the completion submission supplies one),
  // plus the latest note and credited player name — names/colours are re-joined at flush time.
  latestImageUrl: text('latest_image_url'),
  latestNote: text('latest_note'),
  latestCreditName: text('latest_credit_name'),
  // 1 once a buffered submission completed the tile — forces an immediate flush.
  completed: integer('completed').notNull().default(0),
  firstQueuedAt: text('first_queued_at').notNull(),
  lastEventAt: text('last_event_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.tileId, table.teamId] }),
  index('pending_notifications_last_event_idx').on(table.lastEventAt),
]);

// Admin-saved event templates. Capturing an existing event's shape (format/scoring/size) plus its
// tiles-as-CSV lets staff re-launch a proven board in one click from the create gallery. `tiles` is
// the canonical tile CSV (same format as the bulk importer) so applying a preset reuses the tested
// import pipeline verbatim.
export const eventPresets = sqliteTable('event_presets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  format: text('format').notNull(),
  scoringMode: text('scoring_mode').notNull(),
  boardSize: integer('board_size').notNull(),
  tiles: text('tiles'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('event_presets_created_at_idx').on(table.createdAt),
]);

// The clan's reusable task catalogue — individual tiles rather than whole boards (that's
// event_presets above). A board can be GENERATED from it: "8 easy, 10 medium, 5 hard" draws that
// many at random and the create form hands them to the existing tile importer.
//
// Rows arrive two ways and the clan owns both: seeded once from the curated starter pool shipped in
// the repo (data/tile-library.seed.json — `seedKey` records which entry a row came from, so a later
// release can offer the tasks a clan hasn't seen without touching what they edited), or harvested
// off a past board with "Add to library".
//
// `config` is a canonical tile CSV row (lib/csvTiles TileCsvRow) — the same shape the bulk importer
// and templates already speak, so a drawn tile keeps its drop targets, thresholds and item lists
// instead of degrading to a bare label. Tier is NOT stored: it's derived from `points` through the
// clan's own tier_bands at draw time, so retuning the bands re-tiers the catalogue with it.
export const tileLibrary = sqliteTable('tile_library', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
  description: text('description'),
  tileType: text('tile_type').default('standard').notNull(),
  points: integer('points').default(0).notNull(),
  category: text('category'),
  /** Full TileCsvRow JSON — everything the importer needs to rebuild the tile. */
  config: text('config').notNull(),
  /** Stable id of the seed entry this row came from; NULL for clan-authored / harvested rows. */
  seedKey: text('seed_key'),
  /** Which board it was harvested from, when it was. Kept for provenance, not enforced. */
  sourceEventId: integer('source_event_id').references(() => events.id, { onDelete: 'set null' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('tile_library_points_idx').on(table.points),
  index('tile_library_category_idx').on(table.category),
  // One row per seed entry — makes "import the starter tasks" idempotent and lets a later release
  // diff what's new without duplicating anything the clan already has.
  uniqueIndex('tile_library_seed_key_idx').on(table.seedKey),
]);

// User-submitted bug reports & feedback. Lives in EACH clan instance; the clan's admins triage it
// here. An admin can ELEVATE a report to the central Anvil.Admin so the operator sees it across
// clans — available on managed hosting only (elevation is disabled on self-hosted instances, which
// have no ANVIL_ADMIN_FEEDBACK_URL configured).
export const feedback = sqliteTable('feedback', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind').notNull().default('bug'), // 'bug' | 'feedback'
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'resolved' | 'closed'
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  contact: text('contact'), // optional handle/RSN the reporter left
  pageUrl: text('page_url'), // where they were when reporting (context)
  adminNotes: text('admin_notes'),
  elevated: integer('elevated', { mode: 'boolean' }).notNull().default(false),
  elevatedAt: text('elevated_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('feedback_status_idx').on(table.status),
  index('feedback_created_at_idx').on(table.createdAt),
]);

// ── Post-event participant surveys ──────────────────────────────────────────────────────────────
// A per-event questionnaire an admin builds (from scratch or by loading a default template) and that
// anyone with an approved sign-up fills out once the event ends. Questions are ordered rows; each
// response stores all its answers as one JSON blob keyed by question id. Responses are attributed to
// the submitting user but STAFF-ONLY (never surfaced publicly). This is unrelated to the app-level
// `feedback` bug/support table above.
export const surveyQuestions = sqliteTable('survey_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  // 'rating' (1–5 scale), 'text' (free response), 'single' (choose one), 'multi' (choose many).
  type: text('type').notNull().default('text'),
  prompt: text('prompt').notNull(),
  // JSON string[] of choices for 'single' / 'multi'; NULL for 'rating' / 'text'.
  options: text('options'),
  required: integer('required', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  index('survey_questions_event_id_idx').on(table.eventId),
]);

export const surveyResponses = sqliteTable('survey_responses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // The participant who submitted (attributed, staff-only). set null on user delete keeps the response
  // in the aggregate counts (just detached). One row per (event, user) — enforced below.
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  // { [questionId]: number | string | string[] } — one blob per submission. Keys map to
  // survey_questions.id; answers for since-deleted questions are ignored when results are rendered.
  answers: text('answers').notNull(),
  submittedAt: text('submitted_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  uniqueIndex('survey_responses_event_user_unique').on(table.eventId, table.userId),
  index('survey_responses_event_id_idx').on(table.eventId),
]);

// ===========================================================================
// Federation (Layer 0/1). See docs/FEDERATION.md + docs/FEDERATION_WIRE.md.
// ===========================================================================

// Opaque, hashed, long-lived + revocable plugin credential minted by THIS instance
// (own /token issuance now; broker /exchange mints the same shape at L2). Per WIRE §4 the raw
// 256-bit bearer token is shown to the client exactly once at mint time — only its SHA-256 hash
// is persisted here, so a DB leak can't be replayed as a bearer credential.
export const federationTokens = sqliteTable('federation_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Public identifier used by /token/revoke and the "Connected plugins" UI. NOT the secret.
  tokenId: text('token_id').notNull(),
  // SHA-256 (hex) of the opaque bearer token. The raw token is never stored.
  tokenHash: text('token_hash').notNull(),
  // Subject identity (WIRE §4: memberId/discordId). `userId` is the owning site user and drives the
  // profile "Connected plugins" list; `discordId` snapshots the Discord identity a broker assertion
  // maps onto at L2; `memberId` optionally pins a specific clan_member.
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  discordId: text('discord_id'),
  memberId: integer('member_id').references(() => clanMembers.id, { onDelete: 'set null' }),
  // JSON string array — a subset of ['board:read','events:write'] (WIRE §4).
  scopes: text('scopes').notNull().default('["board:read"]'),
  // Human label shown in the UI (e.g. "RuneLite on desktop"). Optional.
  label: text('label'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  lastUsedAt: text('last_used_at'),
  // Long-lived + revocable (decision 3): revoke = set revokedAt. A revoked token 401s at /board.
  revokedAt: text('revoked_at'),
}, (table) => [
  uniqueIndex('federation_tokens_token_id_unique').on(table.tokenId),
  uniqueIndex('federation_tokens_token_hash_unique').on(table.tokenHash),
  index('federation_tokens_user_id_idx').on(table.userId),
  index('federation_tokens_discord_id_idx').on(table.discordId),
]);

// Sticky federation denylist (decision 4). Keyed on discord_id: once an admin bans an identity, the
// broker /exchange path (L2) must refuse to re-create an auto-guest for it — Remove alone is
// whack-a-mole; this stops the re-spawn.
export const federationBans = sqliteTable('federation_bans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  discordId: text('discord_id').notNull(),
  reason: text('reason'),
  at: text('at').default(sql`(datetime('now'))`).notNull(),
  byUserId: integer('by_user_id').references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  uniqueIndex('federation_bans_discord_id_unique').on(table.discordId),
]);

// Single-use assertion replay guard (WIRE §2 step 7). Every broker assertion carries a UUIDv4 `jti`;
// /exchange records it here on first sight and 409s any re-presentation. `expiresAt` mirrors the
// assertion's `exp` (≤90s out) so the row is short-lived — the table self-cleans via an opportunistic
// DELETE on write, exactly like `rate_limits`, so it never grows unbounded. The PK collision on a
// replayed jti is what makes single-use detection atomic (INSERT … ON CONFLICT DO NOTHING → 0 rows).
export const federationJti = sqliteTable('federation_jti', {
  jti: text('jti').primaryKey(),
  expiresAt: text('expires_at').notNull(),
}, (table) => [
  index('federation_jti_expires_at_idx').on(table.expiresAt),
]);

// ---------------------------------------------------------------------------
// Site-relayed federation (WIRE §10). THIS site is the single thing the plugin
// talks to; it relays to the broker + to other clan sites server-to-server.
// ---------------------------------------------------------------------------

// The member's cached OUTBOUND connections to OTHER clans (WIRE §10.3/§10.4). Unlike
// federation_tokens (tokens OTHERS present to us, stored hashed), these are tokens WE hold as a
// client to present to a remote clan's /board + /events — so the raw token is stored (it's an API
// credential we must replay). Keyed by (user_id, instance_id): one live connection per remote clan
// per home member. Populated by /api/plugin/federation/connect after a broker vouch/assert →
// remote-clan /exchange; read by /state (aggregate board+activity) and the /events fan-out relay.
export const federationConnections = sqliteTable('federation_connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // The HOME site user this connection belongs to (the federating member).
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // The REMOTE clan's stable instanceId (WIRE §1) — never our own.
  instanceId: text('instance_id').notNull(),
  // The remote clan's public base URL (server-to-server target; never sent to the plugin).
  baseUrl: text('base_url').notNull(),
  // Remote clan display name (for the plugin sidebar). From the broker directory / vouch.
  name: text('name'),
  // The federation token the REMOTE clan minted at its /exchange (a secret we hold to act as this
  // member there). Raw, not hashed — we must replay it as a Bearer. See note above.
  token: text('token').notNull(),
  // What the remote said this member IS to them at /exchange (WIRE §7): 1 = an auto-created federation
  // guest, 0 = a real member of that clan. Re-stamped on every re-sync, so a guest promoted to member
  // there flips here within the sync window. The plugin uses it to land the sidebar on the clan the
  // player actually belongs to instead of always the configured home.
  isGuest: integer('is_guest').default(0).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  lastUsedAt: text('last_used_at'),
}, (table) => [
  uniqueIndex('federation_connections_user_instance_unique').on(table.userId, table.instanceId),
  index('federation_connections_user_id_idx').on(table.userId),
]);

// In-flight self-host device-code login (WIRE §9.1/§10.3). A self-host home can't have the broker
// vouch for its members (forge risk), so the member does a one-time device-code Discord login on the
// broker's domain. The plugin polls /connect repeatedly; each poll is a fresh server request, so the
// broker's `device_code` handle must persist between them. One in-flight login per member (keyed on
// user_id); cleared on completion/expiry.
/**
 * Per-ACCOUNT federation shares ("Share my RSN with this clan"). The member owns their identity:
 * each linked account (clan_members row) is shared with each remote clan individually, by an
 * explicit action from the plugin while logged into THAT account — never clan-wide, never implied.
 * The exchange relay attaches only the accounts shared with the target instance; deleting a row
 * revokes (the next exchange carries the reduced set and the remote prunes). RSNs never reach the
 * broker — this is strictly home → chosen-remote.
 */
export const federationAccountShares = sqliteTable('federation_account_shares', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Owner (for revocation/authz checks) — the user whose account is shared.
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // The specific shared account. Cascades away if the account link is ever deleted.
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMembers.id, { onDelete: 'cascade' }),
  // The remote instance (its stable UUID) this account is shared with.
  instanceId: text('instance_id').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
}, (t) => [
  uniqueIndex('federation_account_shares_unique').on(t.clanMemberId, t.instanceId),
  index('federation_account_shares_user_idx').on(t.userId),
]);

export const federationDeviceSessions = sqliteTable('federation_device_sessions', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  // The broker's secret poll handle from POST /device/start (WIRE §9.1).
  deviceCode: text('device_code').notNull(),
  // The broker page the member opens in a browser to enter the user code + Discord-login.
  verificationUrl: text('verification_url').notNull(),
  // Poll cadence (s) and absolute expiry the broker declared; used to pace/expire polling.
  interval: integer('interval').default(5).notNull(),
  expiresAt: text('expires_at').notNull(),
  // finding #15: the broker member-session token, captured once the device poll returns `complete`.
  // The device_code is SINGLE-USE (spent by that `complete` poll), so if the subsequent /assert+/exchange
  // relay then fails, we CANNOT re-poll to recover — we'd strand the login. Persisting the brokerToken
  // (encrypted at rest, §4) lets the next /connect|/state RETRY the exchange directly, no re-login. Null
  // until the poll completes.
  brokerToken: text('broker_token'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

/**
 * One compact row per member per day they actually played — the history behind gains-over-time,
 * best-ever records and dated milestones.
 *
 * Deliberately NOT a snapshot archive. Keeping the full skills+bosses payload daily is what grew the
 * old player_snapshots table to 1.2 GB; this stores the totals plus a delta of only what moved, so a
 * day of Zulrah is `{"bosses":{"zulrah":140}}` rather than 3 KB of unchanged numbers. A day nobody
 * played writes nothing at all, and the whole thing costs a clan single-digit MB a year.
 *
 * Written by the stats sweep from the snapshot it already holds — no extra hiscores traffic — and
 * because that read merges the plugin's live overlay, a member running the plugin lands accurate
 * same-session numbers here without any additional push.
 *
 * Records (best day / week / month) are NOT stored: they're a query over these rows, which is at most
 * 365 tiny rows per member. Nothing to maintain incrementally, nothing to drift.
 */
export const memberDailyStats = sqliteTable('member_daily_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMembers.id, { onDelete: 'cascade' }),
  // UTC calendar day, 'YYYY-MM-DD'. UTC because every other date in the app is, and a clan spans zones.
  day: text('day').notNull(),

  // Totals as at the last sweep of that day — the absolute line on a chart.
  overallXp: integer('overall_xp').notNull(),
  ehpMilli: integer('ehp_milli').notNull().default(0),
  ehbMilli: integer('ehb_milli').notNull().default(0),

  // What they gained during the day. Stored rather than derived from consecutive rows, because
  // inactive days have no row at all — so "yesterday's row" isn't reliably yesterday.
  xpGained: integer('xp_gained').notNull().default(0),
  ehpMilliGained: integer('ehp_milli_gained').notNull().default(0),
  ehbMilliGained: integer('ehb_milli_gained').notNull().default(0),

  // JSON `{ skills: { slayer: 412000 }, bosses: { zulrah: 140 } }` — ONLY metrics that moved.
  deltas: text('deltas'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  uniqueIndex('member_daily_stats_member_day_idx').on(table.clanMemberId, table.day),
  index('member_daily_stats_day_idx').on(table.day),
]);

/**
 * Dated achievements — a 99, an XP threshold, a boss KC threshold — written the first time we see one
 * crossed. An event log, not a projection: rows are only ever inserted, and only when something
 * actually happened, so the write cost is nil on an ordinary tick.
 *
 * The date is when WE noticed, which for a member on the plugin is minutes and for everyone else is
 * within their polling interval. Recorded as `noticedAt` rather than pretending to be the moment it
 * happened in game.
 */
export const memberMilestones = sqliteTable('member_milestones', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMembers.id, { onDelete: 'cascade' }),
  // 'level' (99s) | 'xp' | 'kc' | 'ehb' | 'ehp' | 'total'
  kind: text('kind').notNull(),
  // The skill or boss key it applies to; null for account-wide ones (total level, EHP, EHB).
  metric: text('metric'),
  // The threshold crossed: 99, 50_000_000, 1000 kills…
  threshold: integer('threshold').notNull(),
  noticedAt: text('noticed_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  uniqueIndex('member_milestones_unique').on(table.clanMemberId, table.kind, table.metric, table.threshold),
  index('member_milestones_member_idx').on(table.clanMemberId, table.noticedAt),
]);
