import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
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
  itemRequirements: text('item_requirements'), // JSON array of per-item requirements, e.g. [{"itemId":25859,"name":"Enhanced weapon seed","requiredAmount":1}]
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
  // What happened: 'created' | 'updated' | 'deleted' | 'imported' | 'reordered'.
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
}, (table) => [
  uniqueIndex('users_plugin_token_unique').on(table.pluginToken),
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
  // (e.g. added by an admin / by name). Linked members still carry their user id, and the
  // (eventId, userId) unique index keeps one sign-up per linked user — SQLite treats the NULLs
  // as distinct, so multiple guest rows per event are allowed; guest dedup is by clanMemberId in code.
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMembers.id, { onDelete: 'restrict' }),
  // JSON: { dailyHours, weeklyHours, bosses[], skills[], notes, ...customFields }
  profileData: text('profile_data').notNull().default('{}'),
  // pending = awaiting fee/admin review, approved = eligible for draft, rejected = denied,
  // withdrawn = user opted out before the deadline.
  status: text('status').notNull().default('pending'),
  signedUpAt: text('signed_up_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  uniqueIndex('event_signup_user_unique').on(table.eventId, table.userId),
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
export const federationDeviceSessions = sqliteTable('federation_device_sessions', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  // The broker's secret poll handle from POST /device/start (WIRE §9.1).
  deviceCode: text('device_code').notNull(),
  // The broker page the member opens in a browser to enter the user code + Discord-login.
  verificationUrl: text('verification_url').notNull(),
  // Poll cadence (s) and absolute expiry the broker declared; used to pace/expire polling.
  interval: integer('interval').default(5).notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});
