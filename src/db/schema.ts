import {
  pgTable,
  pgView,
  text,
  integer,
  serial,
  boolean,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * A clan. The tenant row — one deployment now serves many of these.
 *
 * Resolved from the request's Host header against this table as a CLOSED SET: `slug` matches a
 * subdomain label, `customDomain` matches a whole host, and a host matching neither is a 404 with no
 * fallback. That is what keeps Host-based routing safe — the header is never trusted, only ever used
 * as a lookup key, and every absolute URL the app builds comes from the row it found rather than
 * from the header itself (see lib/request-origin).
 *
 * Per-clan CONFIG deliberately does not live here. It stays in `settings`, now keyed (clan_id, key),
 * because it is a sprawl of ~40 optional keys that would make this a wide table of mostly nulls.
 * What lives here is only what identifies and gates a clan.
 */
export const clans = pgTable('clans', {
  id: serial('id').primaryKey(),
  // Subdomain label: <slug>.anvilosrs.com. Lowercase, url-safe; the clan's stable address.
  slug: text('slug').notNull(),
  // A whole host the clan points at us via CNAME. Null = subdomain only.
  customDomain: text('custom_domain'),
  // Display name, shown on the site and in Discord posts. Need not match the in-game clan name.
  name: text('name').notNull(),
  // The exact OSRS clan name — the only thing tying this site to a real clan in the game.
  //
  // THE one place it lives. It used to be here AND in a `clan_ingame_name` setting, with the
  // roster-sync gate reading only the setting, so a clan created through the newer flow (which
  // writes this column) had no gate at all and would accept any roster pushed at it.
  inGameName: text('in_game_name'),
  // When somebody proved this clan is that clan, by pushing its roster from an account holding an
  // owner-tier rank in it. NULL is the normal state for a new clan and is not a fault: an unverified
  // clan runs boards, guests and events perfectly well. What it cannot do is sync a roster or enter
  // a cross-clan leaderboard, because both are claims about a real clan that nobody has checked.
  ingameNameVerifiedAt: text('ingame_name_verified_at'),
  // The account that proved it, so a dispute has something to point at besides a timestamp.
  ingameNameClaimedByAccountId: integer('ingame_name_claimed_by_account_id').references(() => accounts.id, {
    onDelete: 'set null',
  }),
  // active = serving. suspended = resolves but refuses writes (non-payment, abuse review).
  // archived = read-only history, kept so links and profiles don't rot.
  status: text('status').notNull().default('active'),
  // Entitlement tier. Gates the bot-backed features and the stat-sweep cadence, so a free clan
  // cannot consume the shared Discord and Jagex budgets the paid ones fund.
  plan: text('plan').notNull().default('free'),
  // Max active roster members for the plan; mirrors what MEMBER_CAP carried per container.
  memberCap: integer('member_cap'),
  // How this clan admits someone it does not already have.
  //   approval — a request lands for staff to accept or reject; no seat until they do (default)
  //   open     — anyone who turns up becomes a guest
  //   closed   — no guests, no requests
  // Default approval because membership is GRANTED, never assumed, and the paths that used to mint
  // a guest seat did it silently — anyone who logged in once appeared on a roster nobody agreed to.
  guestPolicy: text('guest_policy').notNull().default('approval'),

  // ── Billing ───────────────────────────────────────────────────────────────────────────────
  // These lived in the control plane's own database, which existed to know which CONTAINER belonged
  // to which subscription. There are no containers, so the subscription belongs on the clan.
  //
  // Note what `status` does NOT do here: under freemium a clan exists from the moment it is created,
  // on the free tier, so paying changes `plan` (what it may do) rather than `status` (whether it
  // serves at all). The control plane needed awaiting_payment/provisioning precisely because a clan
  // did not exist until it was paid for. Refunds and disputes still touch status — those are the
  // cases where a clan should stop serving.
  contactEmail: text('contact_email'),
  gumroadSaleId: text('gumroad_sale_id'),
  gumroadSubscriptionId: text('gumroad_subscription_id'),
  gumroadProductId: text('gumroad_product_id'),
  gumroadProductPermalink: text('gumroad_product_permalink'),
  // The correlation token appended to the checkout URL and echoed back by Gumroad — how a payment
  // finds the clan that started it.
  gumroadRef: text('gumroad_ref'),
  trialEndsAt: text('trial_ends_at'),
  currentPeriodEnd: text('current_period_end'),
  // Cancelled but still inside the paid term. Gumroad keeps serving it, so we do too: dropping them
  // to free the moment they cancel takes away time they already paid for.
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),

  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('clans_slug_unique').on(table.slug),
  uniqueIndex('clans_custom_domain_unique').on(table.customDomain),
  index('clans_status_idx').on(table.status),
  // One VERIFIED clan per in-game name, case-insensitively. First claim wins; a second is refused
  // and sent to a human. Partial, so unverified clans may hold any placeholder — they have proved
  // nothing, so they reserve nothing.
  uniqueIndex('clans_verified_ingame_name_unique')
    .on(sql`lower(${table.inGameName})`)
    .where(sql`ingame_name_verified_at is not null`),
  // One subscription is one clan. Two clans claiming the same paid subscription is a billing bug
  // that should be impossible rather than merely unlikely.
  uniqueIndex('clans_gumroad_subscription_unique').on(table.gumroadSubscriptionId),
  uniqueIndex('clans_gumroad_ref_unique').on(table.gumroadRef),
]);

/**
 * Who holds authority in a clan, and how much.
 *
 * The row IS the grant: no row means no authority in that clan, whatever the person holds elsewhere.
 * One person legitimately appears here for several clans with different roles — admin of their own,
 * moderator of a friend's — which is exactly what a column on `users` could not express.
 *
 * Roles: owner > admin > treasurer > moderator > member. Treasurer and moderator are mod-tier with
 * one extra capability each; `canEditTiles` rides on top of any of them rather than being a role, so
 * "a moderator who builds boards" is a checkbox instead of a new combination.
 *
 * Two invariants keep this from being an escalation ladder, enforced in lib/clanRoles:
 *   - nobody may grant a role at or above their own
 *   - nobody may modify someone at or above their own grade
 * Without those, a moderator who can edit staff is one request away from being an admin.
 */
export const clanStaff = pgTable('clan_staff', {
  id: serial('id').primaryKey(),
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'owner' | 'admin' | 'treasurer' | 'moderator' | 'member'
  role: text('role').notNull().default('member'),
  // Tile authoring as a capability, orthogonal to the tier above.
  canEditTiles: boolean('can_edit_tiles').notNull().default(false),
  // 'all' | 'assigned' — reach of that capability; 'assigned' means only boards they hold an
  // event_editors grant for.
  editorScope: text('editor_scope').notNull().default('all'),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  // One grant per person per clan; a second would make "what is their role here?" ambiguous.
  uniqueIndex('clan_staff_clan_user_unique').on(table.clanId, table.userId),
  index('clan_staff_user_idx').on(table.userId),
  index('clan_staff_clan_role_idx').on(table.clanId, table.role),
]);


// ── Identity: person, account, membership ────────────────────────────────────────────────────
//
// Three levels, because OSRS has three. A PERSON owns one or more ACCOUNTS (a main and alts), and
// each account can sit on a different clan's ROSTER. `clan_members` collapsed all three into one row
// per clan, which is why the same human in two clans was two unrelated rows with nothing joining
// them — and why there could be no cross-clan profile, no "clans you play in", no guest applications.

/**
 * A person. Exists whether or not they have ever logged in.
 *
 * An unclaimed roster entry gets one of these too, so every account has an owner from the moment it
 * is seen; claiming later merges people rather than inventing one. That is what makes
 * `player_event_facts.personKey` — today a synthesized string ('u<id>' > 'm<id>' > 'n<rsn>') — a
 * real foreign key.
 */
export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  // Best known name for the human: their Discord display name, else their main's RSN.
  //
  // INTERNAL ONLY. In practice this IS the Discord display name — every path that creates a person
  // from a login seeds it from there (lib/roster, lib/discord-login), and on the real data it is
  // identical to users.display_name for every row that has one. So it must never reach a public
  // page: the apex identifies a person by their primary SHARED RSN, which is a name they chose to
  // publish, not one Discord chose for them.
  displayName: text('display_name'),
  /**
   * May the apex show that these characters belong to one person?
   *
   * Separate from `accounts.shared`, and off by default, because they are different disclosures.
   * Sharing a character publishes THAT character. Linking says two RSNs are the same human, which
   * is the fact someone is most likely to want kept — a main and an ironman can each be public
   * without their owner wanting them connected. Sharing two accounts used to imply this silently.
   */
  linkAccountsPublicly: boolean('link_accounts_publicly').notNull().default(false),
  // PLATFORM ban — barred everywhere. A clan barring someone is clan_bans, a different thing
  // entirely; a clan admin must be structurally unable to reach this.
  banned: boolean('banned').notNull().default(false),
  bannedAt: text('banned_at'),
  bannedReason: text('banned_reason'),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
});

/**
 * An OSRS account. GLOBAL — one row per account across the whole platform, not per clan.
 *
 * This is where `rsn_normalized` and `account_hash` uniqueness finally means what it says. On
 * clan_members those constraints were global only by accident of one-clan-per-database, and had to
 * be relaxed to (clan, rsn) once several clans shared one — which is a weaker rule than the truth.
 * An RSN identifies exactly one account in the game; here it does the same.
 *
 * Hiscores state lives here rather than on the person, because Jagex tracks accounts. A person's
 * profile aggregates across theirs.
 */
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  rsn: text('rsn').notNull(),
  rsnNormalized: text('rsn_normalized').notNull(),
  // Jagex's stable per-account id from the client. Survives renames, which is why it outranks the
  // RSN when resolving who is playing — but it comes from a client we do not control, so it anchors
  // rather than proves.
  accountHash: text('account_hash'),
  // Which Discord user this RSN belongs to, arrived at by name-matching the guild. WEAKER than
  // users.discordId, which is a proven OAuth link — this is a cache, and the only handle there is on
  // a member who has never signed in. Readers should prefer the account's player and fall back here.
  discordId: text('discord_id'),
  // 'active' | 'unranked' | 'banned' | 'archived' — drives whether the hiscores sweep polls it.
  // Jagex-side health, not a clan's opinion: 'banned' here means Jagex banned the account. Being
  // barred from a clan is a property of that clan's membership, and lives there.
  status: text('status').notNull().default('active'),
  statusLastChecked: text('status_last_checked'),
  // JSON array of historical RSNs, appended whenever a rename is detected.
  previousRsns: text('previous_rsns'),
  // The person's "main" among their accounts.
  isPrimary: integer('is_primary').default(0).notNull(),

  // ── Proof of ownership ───────────────────────────────────────────────────────────────────
  // Global, because it is a fact about the account and not about any clan: proving ownership once
  // proves it everywhere, and nobody should have to re-prove the same RSN per clan.
  verifiedAt: text('verified_at'),
  verificationMethod: text('verification_method'), // 'plugin' | 'stat_delta' | 'manual'
  verifiedByUserId: integer('verified_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  // On the watchlist: matched by a signal weak enough to be coincidence, awaiting a mod's confirm.
  provisional: integer('provisional').default(0).notNull(),
  // Whether clans this account is NOT in may see it.
  //
  // One token covers every account a person owns, so a clan holding one of them must not thereby
  // learn the rest: guesting somewhere with an alt is not telling that clan about your main. The
  // rule is enforced in lib/accountVisibility — seat in the clan, or shared.
  //
  // Per account rather than per person, because "my main is public, my ironman is nobody's
  // business" is the real want and a person-level flag cannot express it.
  shared: boolean('shared').notNull().default(false),
  claimedAt: text('claimed_at'),

  // ── Hiscores state ───────────────────────────────────────────────────────────────────────
  // Here rather than on the roster seat because Jagex tracks accounts, not memberships. One row per
  // account is what lets the sweep poll a person in three clans ONCE instead of three times — the
  // poll budget is the scarce resource, so this is the whole reason the split is worth doing.
  liveStats: text('live_stats'),
  liveStatsAt: text('live_stats_at'), // last push timestamp (staleness / observability)
  liveStatKeyTimes: text('live_stat_key_times'),
  statsOverallXp: integer('stats_overall_xp'), // last observed total XP — the change detector
  statsMissStreak: integer('stats_miss_streak').notNull().default(0),
  statsNextDueAt: text('stats_next_due_at'),   // null = due now
  statsLastSnapshot: text('stats_last_snapshot'),
  statsActivities: text('stats_activities'),

  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('accounts_rsn_normalized_unique').on(table.rsnNormalized),
  uniqueIndex('accounts_account_hash_unique').on(table.accountHash),
  index('accounts_player_idx').on(table.playerId),
  // The sweep's work queue: which accounts are due a poll.
  index('accounts_due_idx').on(table.status, table.statsNextDueAt),
]);

/**
 * An account's place on a clan's roster. The JOIN that makes someone a member of somewhere.
 *
 * MEMBERSHIP IS GRANTED, NEVER ASSUMED. Logging in makes a person a user of the platform and nothing
 * more; no row here appears because someone signed in. A row is written by exactly three things:
 * the in-game roster sync seeing the RSN, an admin adding them, or an approved guest application.
 *
 * `kind` carries that distinction structurally instead of leaving it to a flag:
 *   member — on the clan's in-game roster. Only the roster sync or an admin may set this.
 *   guest  — allowed to take part without being in the clan in game. What a cross-clan event, or a
 *            friend playing one bingo, actually is.
 *
 * Per ACCOUNT rather than per person, because an in-game roster lists RSNs: a main and an alt both
 * in the clan are two roster rows, which is what the clan itself sees.
 */
export const clanMemberships = pgTable('clan_memberships', {
  id: serial('id').primaryKey(),
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  // 'member' | 'guest' — see above. Never inferred from activity.
  kind: text('kind').notNull().default('guest'),
  // In-game clan rank title, as the roster reported it.
  rank: text('rank'),
  // How this row came to exist, so "why is this person here?" is answerable: 'roster' | 'admin' |
  // 'application'. Deliberately not free-form.
  source: text('source').notNull().default('roster'),
  joinedAt: text('joined_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  // Soft-left: the roster stopped listing them. Kept so their history in this clan survives.
  leftAt: text('left_at'),
  // Bumped on each roster sync that lists this RSN. Per seat: presence on THIS clan's roster.
  lastSeenInClan: text('last_seen_in_clan'),
  // This clan's private note about this seat.
  notes: text('notes'),
  // A clan role waiting on a mod's approval before it applies: 'admin' | 'moderator' | null.
  pendingRole: text('pending_role'),
}, (table) => [
  uniqueIndex('clan_memberships_clan_account_unique').on(table.clanId, table.accountId),
  // One MEMBER seat per account, across every clan: OSRS lets an account be in exactly one clan, so
  // the site should not be able to say otherwise. Guest seats stay unlimited — guesting is not
  // membership. Partial on kind+left_at, so departures and guests do not collide.
  uniqueIndex('clan_memberships_one_member_seat')
    .on(table.accountId)
    .where(sql`kind = 'member' and left_at is null`),
  index('clan_memberships_clan_kind_idx').on(table.clanId, table.kind),
  index('clan_memberships_account_idx').on(table.accountId),
]);

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  // The clan that owns this row. Added by the multi-clan conversion; every query on this table
  // must be scoped by it.
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Who may SEE this event, and who may ENTER it. Two questions because they are two questions: a
  // public board with approval entry is the ordinary cross-clan case — anyone can look, the host
  // decides who plays.
  //   clan    — this clan's, as every event was until now (default)
  //   invited — only invited clans and people; the clan-versus-clan primitive
  //   public  — anybody may look
  visibility: text('visibility').notNull().default('clan'),
  //   open     — sign up and you are in (default, and what every existing event does)
  //   approval — the host says yes first
  entry: text('entry').notNull().default('open'),
  boardSize: integer('board_size').notNull(),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
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
  // STARTING SHOT (lib/startProof) — drawn exactly once, inside the start transaction, when
  // `rules.startProof` is set. `startProofLocation` is where everyone must be standing for their
  // proof screenshot; `startProofDrawnAt` is both the "the draw has happened" latch and the salt
  // every per-player keyword is HMAC'd over — so no keyword exists, for anyone, until start.
  // NULL/NULL on every event that doesn't require a starting shot.
  startProofLocation: text('start_proof_location'),
  startProofDrawnAt: text('start_proof_drawn_at'),
  // The drawn spot as game coordinates, frozen at the draw so a later edit to the location pool
  // can't move the goalposts under shots already filed. NULL when the drawn entry was label-only
  // (a place nobody pinned on the map) — then position simply isn't checked.
  startProofX: integer('start_proof_x'),
  startProofY: integer('start_proof_y'),
  startProofRadius: integer('start_proof_radius'),
});

export const tiles = pgTable('tiles', {
  id: serial('id').primaryKey(),
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
  // DROP tiles: the most this tile can be credited from a SINGLE kill, however many tracked items
  // that kill dropped or how big the stack was. NULL = uncapped (every drop counts, the historical
  // behaviour). 1 is "one credit per kill" — what makes a tile count ROLLS of a unique table rather
  // than items, since a kill that hands you a vestige and an ingot rolled once as far as the board is
  // concerned. Enforced by the plugin, which is the only thing that can see a kill boundary; manual
  // and admin submissions are unaffected.
  perKillCap: integer('per_kill_cap'),
  // KILL tiles: how much a kill several members were in is worth to the team. NULL/'per-member' =
  // every member who reported it credits (the historical behaviour — a 2-man Yama gives 2 KC, a
  // 20-man raid gives 20). 'per-kill' collapses the reports of ONE kill into one credit; the site
  // correlates them (lib/coopRuns) rather than trusting any single client to stay quiet.
  coopCredit: text('coop_credit'),
  // KILL tiles: the kill only counts when at least this many of the team were in it — "complete N
  // raids with 3+ teammates". NULL/0 = no requirement. Counted from members who reported the kill
  // plus roster members they NAMED, never from the raid party size (20 in a CoX party is not 20
  // teammates), so the gate errs toward not crediting.
  coopMinMembers: integer('coop_min_members'),
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
export const tileLocks = pgTable('tile_locks', {
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
export const tileAuditLog = pgTable('tile_audit_log', {
  id: serial('id').primaryKey(),
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
  occurredAt: text('occurred_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  index('tile_audit_log_event_id_idx').on(table.eventId),
  index('tile_audit_log_occurred_at_idx').on(table.occurredAt),
  index('tile_audit_log_tile_id_idx').on(table.tileId),
]);

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  // Captains are Discord-linked users — `captainUserId` references `users.id` and is the
  // sole captain identifier. The legacy `captain_password` column was retired once
  // Discord login became required to participate; the column stays in DDL only so the retirement
  // never needed a data migration, but no code reads or writes it.
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

export const completions = pgTable('completions', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  tileId: integer('tile_id').notNull().references(() => tiles.id, { onDelete: 'cascade' }),
  completedAt: text('completed_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  // The player who finished it: a stat tile (boss KC / skilling) that completed via the hiscores
  // sweep or a live push and so has NO submission to attribute, or a Solo count tile, where one
  // member reaching the count alone IS the completion (lib/countProgress). NULL for team-total
  // tiles and admin manual completions — the activity feed attributes those from the latest
  // submission instead. Lets the feed read "Kayle completed 500 Zulrah KC", not "Team …".
  creditPlayerId: integer('credit_player_id').references(() => eventParticipants.id, { onDelete: 'set null' }),
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

export const eventParticipants = pgTable('event_participants', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // clanMemberId is the source of truth for identity; `name` is kept as a per-event
  // display override (useful if an RSN changes mid-event). New enrollments should
  // always supply clanMemberId; legacy rows have it backfilled.
  clanMemberId: integer('clan_member_id').references(() => clanMemberships.id, { onDelete: 'set null' }),
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
  // Same contract again: combat tasks genuinely completed during the event ("Task Master"). Only
  // first completions count — the plugin gates on the CA points varbit actually rising, so the
  // in-game "Repeat completion" setting can't inflate it.
  caTasks: integer('ca_tasks').default(0),
}, (table) => [
  uniqueIndex('player_token_unique').on(table.playerToken),
  index('players_event_id_idx').on(table.eventId),
  index('players_event_team_idx').on(table.eventId, table.teamId),
  index('players_clan_member_id_idx').on(table.clanMemberId),
]);

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  tileId: integer('tile_id').notNull().references(() => tiles.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  playerId: integer('player_id').references(() => eventParticipants.id, { onDelete: 'set null' }),
  creditPlayerId: integer('credit_player_id').references(() => eventParticipants.id, { onDelete: 'set null' }),
  amount: integer('amount').default(1).notNull(),
  imageUrl: text('image_url'),
  note: text('note'),
  itemId: integer('item_id'), // which specific tracked item this submission is for (per-item tracking)
  // TIMED-tile submissions only: the measured completion time in seconds, as reported
  // (and baked onto the screenshot) by the plugin. NULL for drop/kill submissions. The
  // tile completes when any submission's durationSeconds ≤ tile.timeThresholdSeconds.
  durationSeconds: integer('duration_seconds'),
  // What the submitting client could see of its company at kill time, for shared-kill correlation
  // (lib/coopRuns). `coopGroup` is a JSON array of lowercased roster RSNs it saw — reliable for a
  // single-arena boss, empty inside raids where the party splits across rooms; `coopPartySize` is
  // the instance/raid party headcount, which is reliable exactly where the names aren't. Both NULL
  // on manual/web submissions and on anything an older plugin sent.
  coopGroup: text('coop_group'),
  coopPartySize: integer('coop_party_size'),
  // Why this credit wants a human look. Currently only 'no_start_proof' (lib/startProof): the event
  // requires a starting shot and this player hadn't uploaded one when the credit landed. The
  // submission still counts — flagging is deliberately softer than refusing, since the drop really
  // happened and refusing would lose it. NULL on everything unremarkable.
  flaggedReason: text('flagged_reason'),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  index('submissions_tile_id_idx').on(table.tileId),
  index('submissions_team_id_idx').on(table.teamId),
  index('submissions_tile_team_idx').on(table.tileId, table.teamId),
]);

// Per-clan configuration.
//
// The key is unique only WITHIN a clan, so the primary key is the pair. That single change is what
// forces clanId through lib/settings, every settings-backed getter in pluginConfig, and the whole
// Discord notify layer — which is why it landed on its own rather than alongside the clan entity.
export const settings = pgTable('settings', {
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value'),
}, (table) => [
  primaryKey({ columns: [table.clanId, table.key] }),
]);

/**
 * Device-code sign-in for the plugin (RFC 8628 shape, home-native — no broker involved). The plugin
 * POSTs /api/plugin/auth/start, opens THIS site's /link-device page in the member's browser (URL
 * pinned plugin-side to the configured home origin), and polls /api/plugin/auth/poll until the
 * logged-in member approves the code — then the poll returns the account token exactly once.
 * Works identically for hosted, self-hosted-networked, and fully-standalone instances.
 */
export const pluginDeviceCodes = pgTable('plugin_device_codes', {
  id: serial('id').primaryKey(),
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
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  expiresAt: text('expires_at').notNull(),
  lastPolledAt: text('last_polled_at'),
}, (t) => [
  uniqueIndex('plugin_device_codes_hash_unique').on(t.deviceCodeHash),
  uniqueIndex('plugin_device_codes_user_code_unique').on(t.userCode),
  index('plugin_device_codes_expires_idx').on(t.expiresAt),
]);

// Tiny fixed-window rate-limit bucket store. Rows are self-garbage-collected
// by an opportunistic DELETE on each write; nothing else needs scheduling.
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(), // "<scope>:<ident>:<window-start-ms>"
  count: integer('count').default(1).notNull(),
  expiresAt: text('expires_at').notNull(),
}, (table) => [
  index('rate_limits_expires_at_idx').on(table.expiresAt),
]);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  // The person this login belongs to. A person can hold several OSRS accounts and, eventually,
  // several logins; the login is not the identity. Ids were seeded 1:1 from users, so this is
  // already true — this column makes it something a reader can follow rather than infer.
  playerId: integer('player_id').references(() => players.id, { onDelete: 'set null' }),
  // Dead legacy columns (username + password_hash). Discord OAuth is the only auth path now;
  // these are left in the table to keep migrations cheap. Stop reading/writing them.
  username: text('username').unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash'),
  // DEPRECATED — authority is per clan now and lives in `clan_staff`. Being admin of one clan must
  // confer nothing in another, which a column on the user cannot express: with many clans on one
  // deployment, a global role makes every admin an admin everywhere.
  //
  // Kept (and still backfilled) only so the migration can read it; nothing should gate on it. The
  // column goes when the last reader does.
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
  canEditTiles: boolean('can_edit_tiles').notNull().default(false),
  // The clan owner — the person who provisioned this instance. Exactly one user has this set.
  // Owner == admin for every permission gate (their role stays 'admin'); the flag only adds
  // *protections*: the owner cannot be demoted or deleted by anyone, and only the owner can
  // transfer ownership. Granted once at genesis to the ADMIN_DISCORD_ID user on a fresh
  // instance; never auto-reassigned afterwards. See transfer-ownership route.
  isOwner: boolean('is_owner').notNull().default(false),
  // PLATFORM authority, entirely separate from any clan role. Deliberately not the same axis:
  //   - a clan role must never grant platform capability, and
  //   - platform staff must never implicitly get clan-admin powers.
  // Being both clan leader and operator is then just one clan_staff row plus this column, rather
  // than a special case anywhere in the code.
  //   none    — everyone
  //   support — read-only across clans, for answering questions
  //   staff   — clan lifecycle: suspend, rename, resolve ownership claims
  //   root    — staff, plus granting platform roles
  platformRole: text('platform_role').notNull().default('none'),
  // Bumped to invalidate every live session for this user — a demotion or a ban has to take effect
  // now, not in up to 30 days when the cookie expires. The session carries the value it was minted
  // with; a mismatch is a dead cookie.
  sessionVersion: integer('session_version').notNull().default(0),
  // Site ban. A banned user gets no authenticated session (verifyUser → null) and is refused on
  // Discord login, so they can't act as a member/staff. The owner can never be banned. (Public,
  // logged-out pages stay public — blocking those is an IP/Caddy concern, not this flag.)
  banned: boolean('banned').notNull().default(false),
  bannedAt: text('banned_at'),
  bannedReason: text('banned_reason'),
  bannedByUserId: integer('banned_by_user_id'),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
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
  // The plugin's credential, and it identifies a PERSON — not a person on a site.
  //
  // One token, every clan. The plugin sends it to whichever clan's host it is talking to, and the
  // clan comes from that host; the token itself says only who is holding it. That is what lets one
  // client follow someone into a second clan without re-linking, and what makes their history one
  // history rather than one per site.
  //
  // Extra credentials for the same person live in `plugin_links` — device links, and the tokens
  // inherited from separate instances at import. They resolve to the same person, and are meant to
  // be retired once that person's client has been handed this one.
  pluginToken: text('plugin_token'),
}, (table) => [
  uniqueIndex('users_plugin_token_unique').on(table.pluginToken),
  index('users_player_idx').on(table.playerId),
]);

// Board-scoped tile-editing grants. A row means `userId` may author tiles on `eventId` even though
// they aren't a global editor — the per-board alternative to the all-events 'editor' role. Enforced
// by verifyTileEditorForEvent (auth.ts) and managed via lib/eventEditors. Cascades away with either
// the event or the user. See [[editor-role-tile-authoring]] for the global-role counterpart.
export const eventEditors = pgTable('event_editors', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  // The admin who granted this (audit only; nullable for system/backfill rows).
  grantedByUserId: integer('granted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  uniqueIndex('event_editors_event_user_unique').on(table.eventId, table.userId),
  index('event_editors_user_idx').on(table.userId),
]);

export const weeklyCompetitions = pgTable('weekly_competitions', {
  id: serial('id').primaryKey(),
  // The clan that owns this row. Added by the multi-clan conversion; every query on this table
  // must be scoped by it.
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'skill' | 'boss'
  metric: text('metric').notNull(), // e.g. 'attack', 'zulrah'
  title: text('title').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('upcoming'), // 'upcoming' | 'active' | 'completed'
  // Whether auto-enrollment sweeps in guests (clan_members.is_guest = 1) alongside full members.
  // Per-competition, set at creation and default ON — a weekly is a clan-wide activity and most
  // clans want everyone on the roster racing. Turn it off for a members-only comp. Supersedes the
  // old clan-wide `weekly_track_guests` setting, which now only seeds the create form's default;
  // competitions that predate this column were backfilled from it (migration 0043).
  includeGuests: integer('include_guests').notNull().default(1),
});

export const weeklyParticipants = pgTable('weekly_participants', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => weeklyCompetitions.id, { onDelete: 'cascade' }),
  // clanMemberId links back to the global roster so leaderboards can deduplicate
  // when an RSN is renamed. Kept nullable to support legacy rows and guest-only participants.
  clanMemberId: integer('clan_member_id').references(() => clanMemberships.id, { onDelete: 'set null' }),
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

/**
 * A clan's roster, reassembled: every seat with the account sitting in it.
 *
 * THE READ MODEL, not a compatibility shim. Roughly eighty files want exactly this join — "who is on
 * this clan's roster, and what do we know about their account" — and writing it out in each of them
 * would be the same query eighty times, with eighty chances to forget the clan filter.
 *
 * Reads come through here. WRITES GO TO THE REAL TABLES: `clanMemberships` for the seat (rank, kind,
 * left_at) and `accounts` for the account (rsn, verification, stat state). Declared `.existing()` so
 * Drizzle treats it as read-only and rejects an insert or update against it at compile time.
 *
 * Two columns clan_members carried are gone on purpose:
 *   is_guest   -> `kind`. An inverted flag is one typo away from granting membership; `kind` says
 *                 what it means in the direction it means it.
 *   discord_id -> join through the account's player. It was a stale denormalised copy that the old
 *                 schema already warned readers off.
 */
export const clanRoster = pgView('clan_roster', {
  // The seat. Same id the fifteen tables carrying clan_member_id have always pointed at.
  id: integer('id').notNull(),
  clanId: integer('clan_id').notNull(),
  accountId: integer('account_id').notNull(),
  // The PERSON who owns this account — null while nobody has claimed it, which is the normal state
  // of a roster entry for someone who has never logged in.
  playerId: integer('player_id'),

  // ── From the account ────────────────────────────────────────────────────────────────────
  rsn: text('rsn').notNull(),
  rsnNormalized: text('rsn_normalized').notNull(),
  accountHash: text('account_hash'),
  // Name-matched Discord id — a cache, subordinate to the account owner's proven OAuth link.
  discordId: text('discord_id'),
  previousRsns: text('previous_rsns'),
  isPrimary: integer('is_primary').notNull(),
  verifiedAt: text('verified_at'),
  verificationMethod: text('verification_method'),
  verifiedByUserId: integer('verified_by_user_id'),
  provisional: integer('provisional').notNull(),
  claimedAt: text('claimed_at'),
  status: text('status').notNull(),
  statusLastChecked: text('status_last_checked'),
  liveStats: text('live_stats'),
  liveStatsAt: text('live_stats_at'),
  liveStatKeyTimes: text('live_stat_key_times'),
  statsOverallXp: integer('stats_overall_xp'),
  statsMissStreak: integer('stats_miss_streak').notNull(),
  statsNextDueAt: text('stats_next_due_at'),
  statsLastSnapshot: text('stats_last_snapshot'),
  statsActivities: text('stats_activities'),

  // ── From the seat ───────────────────────────────────────────────────────────────────────
  kind: text('kind').notNull(),
  rank: text('rank'),
  source: text('source').notNull(),
  joinedAt: text('joined_at').notNull(),
  leftAt: text('left_at'),
  lastSeenInClan: text('last_seen_in_clan'),
  notes: text('notes'),
  pendingRole: text('pending_role'),
}).existing();

// Append-only history of what happened to clan_members rows: joined, left, returned,
// renamed, verified, claimed, merged, promoted, demoted. Powers the admin audit view
// and the Discord audit pings.
/**
 * An operator borrowing a clan's authority, for a while, on the record.
 *
 * Platform staff deliberately get NO clan write from being platform staff — that separation is the
 * whole point of the two axes. But an operator sometimes genuinely has to fix a clan's data, and the
 * two alternatives are both worse: give operators a standing clan grant (the conflation we refused),
 * or reach into the database by hand (which leaves no trace the clan can see).
 *
 * So the grant is explicit, narrow, and self-expiring:
 *   - it names a REASON, written into the clan's own audit log at grant time;
 *   - it EXPIRES, so forgetting to hand it back is not a permanent escalation;
 *   - it is capped at 'admin' — never 'owner', because the owner seat is the one thing an operator
 *     must not be able to take;
 *   - it is revocable at any time.
 *
 * VISIBLE TO THE CLAN. The audit entry lands in that clan's log, not in a separate operator log the
 * clan cannot read. An operator acting inside someone's clan without them being able to find out is
 * indistinguishable from a compromise.
 */
export const platformActAs = pgTable('platform_act_as', {
  id: serial('id').primaryKey(),
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  // The operator. A login, not a person: this is a capability exercised through one.
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Capped at admin by the route that writes it. Stored so a narrower grant stays possible.
  role: text('role').notNull().default('admin'),
  reason: text('reason').notNull(),
  grantedAt: text('granted_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  // The whole point. A row past this is dead, whether or not anyone remembered to revoke it.
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
}, (table) => [
  index('platform_act_as_lookup_idx').on(table.userId, table.clanId, table.expiresAt),
]);

/**
 * A clan barring someone from ITSELF. Not from the platform.
 *
 * These are two different acts and they were one flag. `users.banned` is read by verifyUser, which
 * returns null for it — so the clan-side "ban" button removed the person from EVERY clan on the
 * deployment, and from the platform, on the authority of one clan's moderator. That was fine when a
 * clan owned its whole database; it is a privilege escalation now.
 *
 * So the clan level lives here: no seat, no re-application, no event entry IN THIS CLAN. It says
 * nothing about any other clan, and the person keeps their account, their profile and their history
 * everywhere — including the history they built here, which is theirs and also this clan's record.
 *
 * The platform level stays `players.banned`, set only from /staff. A clan surface that could reach
 * it would be the same bug wearing a different column.
 *
 * KEYED ON THE PERSON, not the account. Someone barred from a clan should not walk back in on an
 * alt — and the person is what the clan actually decided about. `accountId` records which account
 * occasioned it, for the log, and is deliberately not what the check reads.
 */
export const clanBans = pgTable('clan_bans', {
  id: serial('id').primaryKey(),
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  // Which of their accounts prompted it. Context, not the key.
  accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  reason: text('reason'),
  bannedByUserId: integer('banned_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  bannedAt: text('banned_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  // Lifted rather than deleted, so "we un-banned them in March" survives as an answer.
  liftedAt: text('lifted_at'),
  liftedByUserId: integer('lifted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  // One live ban per person per clan. Partial, so a lifted ban does not block a later one.
  uniqueIndex('clan_bans_live_unique').on(table.clanId, table.playerId).where(sql`lifted_at is null`),
  index('clan_bans_clan_idx').on(table.clanId),
]);

/**
 * Someone asking to guest in a clan.
 *
 * Four paths used to create a guest seat as a side effect — a plugin login, an account link, a
 * verification check, a manual-review request — so turning up once put you on a roster nobody had
 * agreed to. Membership is granted, never assumed, and that has to include the guest tier or the
 * word means nothing.
 *
 * The request names an ACCOUNT, because a person applies with a character and which one matters: it
 * is the name that will appear on the clan's roster. It also carries the PERSON, so a clan ban —
 * which is per person — can refuse the request without the clan having to recognise the alt.
 */
export const clanJoinRequests = pgTable('clan_join_requests', {
  id: serial('id').primaryKey(),
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  playerId: integer('player_id').references(() => players.id, { onDelete: 'set null' }),
  // pending | approved | rejected | withdrawn
  status: text('status').notNull().default('pending'),
  message: text('message'),
  // 'web' | 'plugin' — worth keeping, because a request raised by logging in with the plugin means
  // something different to one someone typed.
  source: text('source').notNull().default('web'),
  requestedAt: text('requested_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  decidedAt: text('decided_at'),
  decidedByUserId: integer('decided_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  decidedNote: text('decided_note'),
}, (table) => [
  // One LIVE request per account per clan. Partial, so a rejected one does not block asking again —
  // people fall out with clans and make up.
  uniqueIndex('clan_join_requests_pending_unique')
    .on(table.clanId, table.accountId)
    .where(sql`status = 'pending'`),
  index('clan_join_requests_clan_status_idx').on(table.clanId, table.status),
]);

/**
 * An invitation to an event.
 *
 * Addressable to a whole CLAN or one PERSON. The clan form is what makes clan-versus-clan work
 * without listing forty names; the person form covers a ringer, a guest caller, a friend.
 *
 * Exactly one of the two is set, enforced by a check constraint — a row naming both would be
 * ambiguous about what was invited, and a row naming neither invites nobody.
 */
export const eventInvites = pgTable('event_invites', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  clanId: integer('clan_id').references(() => clans.id, { onDelete: 'cascade' }),
  playerId: integer('player_id').references(() => players.id, { onDelete: 'cascade' }),
  invitedByUserId: integer('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  invitedAt: text('invited_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  note: text('note'),
}, (table) => [
  uniqueIndex('event_invites_clan_unique').on(table.eventId, table.clanId).where(sql`clan_id is not null`),
  uniqueIndex('event_invites_player_unique').on(table.eventId, table.playerId).where(sql`player_id is not null`),
]);

export const clanAuditLog = pgTable('clan_audit_log', {
  id: serial('id').primaryKey(),
  // The clan whose log this entry belongs in. Nullable only so the column could be added to existing
  // rows; every writer sets it. Not derivable from clanMemberId, because the entries that matter
  // most here — a role granted, an owner transferred — concern the clan rather than any one seat.
  clanId: integer('clan_id').references(() => clans.id, { onDelete: 'cascade' }),
  clanMemberId: integer('clan_member_id').references(() => clanMemberships.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  // Snapshots of relevant fields before/after the event, JSON-encoded. Examples:
  //   renamed: {"rsn":"OldName"}, {"rsn":"NewName"}
  //   verified: null, {"method":"plugin","accountHash":"…"}
  //   merged: {"mergedFromMemberId":42}, {"intoMemberId":17}
  oldValue: text('old_value'),
  newValue: text('new_value'),
  actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  occurredAt: text('occurred_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  index('clan_audit_log_clan_idx').on(table.clanId, table.occurredAt),
  index('clan_audit_log_member_id_idx').on(table.clanMemberId),
  index('clan_audit_log_occurred_at_idx').on(table.occurredAt),
  index('clan_audit_log_event_type_idx').on(table.eventType),
]);

// Stat-delta verification: a Discord-linked user claims an RSN, we snapshot Hiscores XP
// per skill, ask them to gain ≥minDelta XP in any skill within the window, then re-poll.
// On success we mark the corresponding clanMember verified with method='stat_delta'.
export const verificationAttempts = pgTable('verification_attempts', {
  id: serial('id').primaryKey(),
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
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
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
export const detectedAccounts = pgTable('detected_accounts', {
  id: serial('id').primaryKey(),
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
// Distinct from per-event `eventParticipants.playerToken` (which scopes a player to one event/team).
// Used to authenticate admin-only plugin actions (clan-sync, etc). Not RSN-bound — the
// admin can use this token from any in-game character on their account.
export const pluginLinks = pgTable('plugin_links', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
}, (table) => [
  uniqueIndex('plugin_links_token_unique').on(table.token),
  index('plugin_links_user_id_idx').on(table.userId),
]);

// Per-event sign-up. One row per (event, user) — a Discord account can only sign up once
// per event but may own multiple roster seats; `clanMemberId` is the single RSN they chose
// to play this event with (the bingo only tracks that account). `profileData` is a frozen
// snapshot of the responses captured at submit time, editable by the user up until
// `events.signupDeadline`. New signups prefill from the user's most recent prior signup so
// they don't re-type unchanged answers.
export const eventSignups = pgTable('event_signups', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // Nullable: a "guest" sign-up for an in-game roster member who has no linked site user yet
  // (e.g. added by an admin / by name). Linked members carry their user id. A person may now enter up
  // to events.maxAccountsPerPerson accounts, so there's no one-per-user unique any more; dedup is per
  // ACCOUNT via the (eventId, clanMemberId) unique below, which covers guests (NULL userId) too.
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMemberships.id, { onDelete: 'restrict' }),
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
  excludeFromPrizePool: boolean('exclude_from_prize_pool').notNull().default(false),
  signedUpAt: text('signed_up_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  updatedAt: text('updated_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
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
export const signupFees = pgTable('signup_fees', {
  id: serial('id').primaryKey(),
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
export const payouts = pgTable('payouts', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // Recipient identity. clanMemberId is the stable link (set null if the member is later deleted or
  // for free-form manual rows); `rsn` is the display name captured when the row was created.
  clanMemberId: integer('clan_member_id').references(() => clanMemberships.id, { onDelete: 'set null' }),
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
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  index('payouts_event_id_idx').on(table.eventId),
  index('payouts_status_idx').on(table.status),
  // One auto-generated payout per (event, member). NULL clanMemberId rows (free-form) are exempt —
  // NULLs count as distinct in a unique index — so multiple manual entries are allowed.
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
export const pendingRenames = pgTable('pending_renames', {
  id: serial('id').primaryKey(),
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMemberships.id, { onDelete: 'cascade' }),
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
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  index('pending_renames_status_idx').on(table.status),
  index('pending_renames_member_idx').on(table.clanMemberId),
]);

// Append-only snapshot history. One row per successful hiscores fetch for a clan
// member. Two roles: (1) recompute leaderboards for any comp window without trusting
// the per-comp `currentValue` cache; (2) catch negative-gain anomalies retroactively.
// Payload is JSON to avoid a 200-column table for ~150 members.
export const playerSnapshots = pgTable('player_snapshots', {
  id: serial('id').primaryKey(),
  // The ACCOUNT this describes, not the roster seat. Jagex tracks accounts, and a person in two
  // clans holds one account and two seats — keyed to the seat, they would accumulate two of these.
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  // Competition this snapshot belongs to. Snapshots are scoped to a weekly competition so we
  // keep exactly two per (member, competition): a frozen 'baseline' at event start and a
  // 'current' overwritten every cron tick until the event ends. NULL only for legacy/orphan
  // rows the backfill keeps purely as a member's most-recent stats (rename detection).
  weeklyCompetitionId: integer('weekly_competition_id').references(() => weeklyCompetitions.id, { onDelete: 'cascade' }),
  // 'baseline' (insert-once, frozen at enrollment) | 'current' (upserted each tick).
  kind: text('kind').notNull().default('current'),
  capturedAt: text('captured_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  // JSON: { skills: { attack: {xp,level,rank}, ... }, bosses: { zulrah: {score,rank}, ... } }
  payload: text('payload').notNull(),
  // Denormalized for cheap ORDER BY and the rename detector's "latest overall XP" probe.
  overallXp: integer('overall_xp'),
}, (table) => [
  index('player_snapshots_member_captured_idx').on(table.accountId, table.capturedAt),
  // One baseline + one current per member per competition. NULLs count as distinct in a unique
  // index, so legacy/orphan rows (NULL competition) never collide here.
  uniqueIndex('player_snapshots_account_comp_kind_idx').on(table.accountId, table.weeklyCompetitionId, table.kind),
]);

// One materialized row per PERSON per finished event — the longitudinal evidence the player
// profile folds over (balance-engine plan). Written once at event end (idempotent re-write on
// demand), backfillable for past events. A person = linked user ('u<id>') > clan member
// ('m<id>') > bare RSN ('n<rsn>') — durable across events, unlike per-event player ids.
export const playerEventFacts = pgTable('player_event_facts', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  personKey: text('person_key').notNull(),
  clanMemberId: integer('clan_member_id').references(() => clanMemberships.id, { onDelete: 'set null' }),
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
export const pluginLinkCodes = pgTable('plugin_link_codes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  expiresAt: text('expires_at').notNull(),
  consumedAt: text('consumed_at'),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
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
export const pendingNotifications = pgTable('pending_notifications', {
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
export const eventPresets = pgTable('event_presets', {
  id: serial('id').primaryKey(),
  // The clan that owns this row. Added by the multi-clan conversion; every query on this table
  // must be scoped by it.
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  format: text('format').notNull(),
  scoringMode: text('scoring_mode').notNull(),
  boardSize: integer('board_size').notNull(),
  tiles: text('tiles'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
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
export const tileLibrary = pgTable('tile_library', {
  id: serial('id').primaryKey(),
  // The clan that owns this row. Added by the multi-clan conversion; every query on this table
  // must be scoped by it.
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
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
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  index('tile_library_points_idx').on(table.points),
  index('tile_library_category_idx').on(table.category),
  // One row per seed entry — makes "import the starter tasks" idempotent and lets a later release
  // diff what's new without duplicating anything the clan already has.
  // Per CLAN: every clan seeds from the same file, so every clan has a row for the same seed key.
  uniqueIndex('tile_library_clan_seed_key_idx').on(table.clanId, table.seedKey),
]);

// User-submitted bug reports & feedback. Lives in EACH clan instance; the clan's admins triage it
// here. An admin can ELEVATE a report to the central Anvil.Admin so the operator sees it across
// clans — available on managed hosting only (elevation is disabled on self-hosted instances, which
// have no ANVIL_ADMIN_FEEDBACK_URL configured).
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  // The clan that owns this row. Added by the multi-clan conversion; every query on this table
  // must be scoped by it.
  clanId: integer('clan_id').notNull().references(() => clans.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('bug'), // 'bug' | 'feedback'
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'resolved' | 'closed'
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  contact: text('contact'), // optional handle/RSN the reporter left
  pageUrl: text('page_url'), // where they were when reporting (context)
  adminNotes: text('admin_notes'),
  elevated: boolean('elevated').notNull().default(false),
  elevatedAt: text('elevated_at'),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  updatedAt: text('updated_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
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
export const surveyQuestions = pgTable('survey_questions', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  // 'rating' (1–5 scale), 'text' (free response), 'single' (choose one), 'multi' (choose many).
  type: text('type').notNull().default('text'),
  prompt: text('prompt').notNull(),
  // JSON string[] of choices for 'single' / 'multi'; NULL for 'rating' / 'text'.
  options: text('options'),
  required: boolean('required').notNull().default(false),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  index('survey_questions_event_id_idx').on(table.eventId),
]);

export const surveyResponses = pgTable('survey_responses', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // The participant who submitted (attributed, staff-only). set null on user delete keeps the response
  // in the aggregate counts (just detached). One row per (event, user) — enforced below.
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  // { [questionId]: number | string | string[] } — one blob per submission. Keys map to
  // survey_questions.id; answers for since-deleted questions are ignored when results are rendered.
  answers: text('answers').notNull(),
  submittedAt: text('submitted_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('survey_responses_event_user_unique').on(table.eventId, table.userId),
  index('survey_responses_event_id_idx').on(table.eventId),
]);

// ===========================================================================
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
export const memberDailyStats = pgTable('member_daily_stats', {
  id: serial('id').primaryKey(),
  // The ACCOUNT this describes, not the roster seat. Jagex tracks accounts, and a person in two
  // clans holds one account and two seats — keyed to the seat, they would accumulate two of these.
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
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
  updatedAt: text('updated_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('member_daily_stats_account_day_idx').on(table.accountId, table.day),
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
export const memberMilestones = pgTable('member_milestones', {
  id: serial('id').primaryKey(),
  // The ACCOUNT this describes, not the roster seat. Jagex tracks accounts, and a person in two
  // clans holds one account and two seats — keyed to the seat, they would accumulate two of these.
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  // 'level' (99s) | 'xp' | 'kc' | 'ehb' | 'ehp' | 'total'
  kind: text('kind').notNull(),
  // The skill or boss key it applies to; null for account-wide ones (total level, EHP, EHB).
  metric: text('metric'),
  // The threshold crossed: 99, 50_000_000, 1000 kills…
  threshold: integer('threshold').notNull(),
  noticedAt: text('noticed_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('member_milestones_unique').on(table.accountId, table.kind, table.metric, table.threshold),
  index('member_milestones_member_idx').on(table.accountId, table.noticedAt),
]);

/**
 * A captain's private draft shortlist: who they mean to take, in what order, with their own notes.
 *
 * Private by construction — every read is filtered to the calling captain's own userId, and nothing
 * on any public or admin surface joins it. It exists because a draft is fast and a captain's plan
 * currently lives in a Discord DM or a notepad: by the time they're on the clock, the list they made
 * while scouting is somewhere else. Rows survive the draft (they're a record of intent, and cost
 * nothing) and are keyed on the person, not the account, so an alt row never splits a plan.
 */
export const draftShortlists = pgTable('draft_shortlists', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // The captain. Not the team: a captain who changes teams keeps their own list, and a team with a
  // new captain doesn't inherit the old one's opinions.
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // lib/playerProfile's personKey — one entry per PERSON, so a two-account player is one line.
  personKey: text('person_key').notNull(),
  // Rank in the list, 0-based and dense after every write. Ties never matter: the client sends the
  // whole order, so there's no drift to reconcile.
  position: integer('position').notNull(),
  // The captain's own note on this person, e.g. "take before pick 22, wants raids".
  note: text('note'),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  updatedAt: text('updated_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('draft_shortlists_unique').on(table.eventId, table.userId, table.personKey),
  index('draft_shortlists_owner_idx').on(table.eventId, table.userId, table.position),
]);

// STARTING SHOT proofs — one row per enrolled player per event (lib/startProof). The image is the
// same managed-media upload every other proof uses (/api/upload → WebP), so a full roster costs
// about as much storage as a handful of drop screenshots.
export const eventStartProofs = pgTable('event_start_proofs', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // The ENROLMENT, not the person: a two-account player owes a shot per account they entered, which
  // is the point — the gate is per credit, and credits are per player row.
  playerId: integer('player_id').notNull().references(() => eventParticipants.id, { onDelete: 'cascade' }),
  // Denormalised so the admin panel groups by team without a join through eventParticipants.
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
  // The account the shot was taken on, as the client saw it. Audit only — the gate keys on playerId.
  rsn: text('rsn'),
  imageUrl: text('image_url').notNull(),
  // 'plugin' = captured by the RuneLite button (authenticated, banner baked in), 'web' = uploaded on
  // the site by hand (desktop or mobile).
  source: text('source').notNull(),
  // What the client says was on screen, and whether the server recomputed it to a match. A plugin
  // capture with keywordOk can be auto-accepted; a hand-typed web one never is (see autoAcceptDecision).
  keyword: text('keyword'),
  keywordOk: boolean('keyword_ok').notNull().default(false),
  // Client-claimed capture time (the plugin's own UTC stamp). Advisory; createdAt is ours.
  capturedAt: text('captured_at'),
  // Where the account stood when the frame was grabbed, as the plugin read it, and how far that is
  // from the drawn spot. NULL on a web upload (a phone can't report a coordinate) and on a
  // label-only draw. `positionOk` is the verdict at file time: 0/1, or NULL for "couldn't tell".
  x: integer('x'),
  y: integer('y'),
  distance: integer('distance'),
  positionOk: boolean('position_ok'),
  // When this game session began, per the client, and how old it therefore was at capture. The
  // point is the LOGOUT before it: hiscores only flush then, so a fresh session means the event's
  // start baseline is honest. NULL when the client didn't report (web upload, older plugin).
  loginAt: text('login_at'),
  sessionMinutes: integer('session_minutes'),
  sessionOk: boolean('session_ok'),
  // pending = on file, awaiting a look; accepted = counted; rejected = player must re-take.
  status: text('status').notNull().default('pending'),
  reviewNote: text('review_note'),
  reviewedBy: integer('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: text('reviewed_at'),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('event_start_proof_player_unique').on(table.eventId, table.playerId),
  index('event_start_proof_event_status_idx').on(table.eventId, table.status),
]);

/**
 * A link that puts whoever opens it straight onto one team (lib/teamInvites).
 *
 * Clan-v-clan is the case this exists for: the visiting side fields its own roster, and collecting
 * a dozen RSNs by hand — then dragging each onto the right team — is work the other clan's own
 * moderator could do in a minute. The link decides ONE thing: which team the resulting sign-up
 * belongs to, and that it needs no approval. It is not a login and not a way around verification —
 * whoever opens it still signs in with Discord and still needs a verified RSN on the roster.
 *
 * Deleted with its team or event; `revokedAt` is the host turning one off without deleting the
 * history of who came through it.
 */
export const teamInvites = pgTable('team_invites', {
  id: serial('id').primaryKey(),
  /** 16 chars of an unambiguous alphabet — see TOKEN_ALPHABET in lib/teamInvites. */
  token: text('token').notNull(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  /** Denormalised from the team so a link can be refused for the wrong event without a join. */
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  /** How many people may come through it. NULL = no limit. */
  maxUses: integer('max_uses'),
  uses: integer('uses').default(0).notNull(),
  expiresAt: text('expires_at'),
  revokedAt: text('revoked_at'),
  /** Who minted it — an admin, or a captain when the event lets them. */
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('team_invite_token_unique').on(table.token),
  index('team_invite_team_idx').on(table.teamId),
]);

/**
 * Extra people who can run one team, alongside its captain.
 *
 * `teams.captainUserId` is a single column, so a clan-v-clan event where the visiting side's
 * moderator needs to police their own roster had exactly one seat to give — and giving it to them
 * cost the playing captain theirs. Staff are that second seat, and the fifth.
 *
 * Scoped to ONE team on purpose: a staff row grants nothing anywhere else, which is what makes it
 * safe to hand to someone from another clan. What it grants is deliberately short of admin — see
 * lib/teamStaff for the list, and note that subbing a player out mid-event stays with the host.
 */
export const teamStaff = pgTable('team_staff', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // The admin who handed it over — audit only, and nullable so a deleted account doesn't take the
  // grant with it.
  grantedByUserId: integer('granted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  // Free-text for the host: "Ironforge's mod", "runs their side of the 25v25".
  note: text('note'),
  createdAt: text('created_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('team_staff_team_user_unique').on(table.teamId, table.userId),
  index('team_staff_user_idx').on(table.userId),
]);


// ── Profile sync (collection log, personal bests, quests / diaries / combat achievements) ────────
//
// Everything below is a PLAYER fact, not a clan one: a collection log belongs to a person, and the
// only reason these rows hang off clan_members is that today a clan is a database. They're shaped so
// that stays true if it ever isn't — narrow integer rows keyed by id, no catalogue text, and a
// stable account identity on the header so one player's log across several clans can be merged by
// something better than their name.
//
// The catalogue itself (which items are on which page, and how pages group into tabs) ships in the
// repo as src/data/clog.json — 125 pages, 1,712 items. Writing it into every clan's database would
// be a megabyte of duplicated reference data that goes stale on the next game update.
//
// Fed by the plugin: the game only hands the client a collection-log page once it has DRAWN it, so
// this fills in as members open their log rather than arriving whole. `pagesSynced` on the header is
// what lets the UI say "68 of 125" instead of pretending a partial log is a complete one.

/** One row per member: how much of the log we have, and the identity to merge it by later. */
export const memberClog = pgTable('member_clog', {
  // The ACCOUNT this describes, not the roster seat. Jagex tracks accounts, and a person in two
  // clans holds one account and two seats — keyed to the seat, they would accumulate two of these.
  accountId: integer('account_id').primaryKey().references(() => accounts.id, { onDelete: 'cascade' }),
  /** Distinct pages we've ever received for this member, and the catalogue total at sync time. */
  pagesSynced: integer('pages_synced').notNull().default(0),
  pagesTotal: integer('pages_total').notNull().default(0),
  /** Slots filled / slots that exist, summed across synced pages only. */
  obtained: integer('obtained').notNull().default(0),
  total: integer('total').notNull().default(0),
  /**
   * The account hash the plugin authenticated with, denormalized on purpose: it's the key a future
   * identity merge would dedupe on, and it must survive a rename that changes the RSN.
   */
  accountHash: text('account_hash'),
  syncedAt: text('synced_at').notNull(),
  /** Plugin build that last wrote here — the first question when a page reads wrong. */
  pluginVersion: text('plugin_version'),
}, (t) => [index('member_clog_synced_idx').on(t.syncedAt)]);

/**
 * One row per obtained item. ONLY obtained items are stored — the missing half is derivable from the
 * shipped catalogue, and storing it would triple the table to record absence.
 *
 * `pageName` is the log's own entry name ("Chambers of Xeric: Challenge Mode"), which is the join key
 * into clog.json. Kept as text rather than an id because the catalogue is a file, not a table: an id
 * would have to be minted and kept stable across dataset rebuilds, and the name already is.
 */
export const memberClogItems = pgTable('member_clog_items', {
  id: serial('id').primaryKey(),
  // The ACCOUNT this describes, not the roster seat. Jagex tracks accounts, and a person in two
  // clans holds one account and two seats — keyed to the seat, they would accumulate two of these.
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  itemId: integer('item_id').notNull(),
  pageName: text('page_name').notNull(),
  /** How many the log says they've had. At least 1 — a 0 would read as "not obtained". */
  quantity: integer('quantity').notNull().default(1),
  /**
   * When WE first saw it, not when they got it — the log doesn't record that. Null for everything
   * present at the first sync, which is exactly the set whose real date is unknowable.
   */
  firstSeenAt: text('first_seen_at'),
  /**
   * Killcount at the moment the unlock fired, when the plugin caught it live. This is what makes a
   * spoon measurable ("Magic fang at 12 KC"); null for anything that arrived as part of a bulk sync,
   * because the log doesn't say which kill produced it.
   */
  kcAtUnlock: integer('kc_at_unlock'),
}, (t) => [
  uniqueIndex('member_clog_items_unique').on(t.accountId, t.itemId),
  index('member_clog_items_item_idx').on(t.itemId),
  index('member_clog_items_page_idx').on(t.accountId, t.pageName),
]);

/**
 * The counter lines a log page prints under its title ("Abyssal Sire kills: 1,204").
 *
 * Exact, and it covers content the hiscores never lists. Display and luck maths only — crediting a
 * kill tile from this would double-count against the chat line that already credits it.
 */
export const memberClogKc = pgTable('member_clog_kc', {
  id: serial('id').primaryKey(),
  // The ACCOUNT this describes, not the roster seat. Jagex tracks accounts, and a person in two
  // clans holds one account and two seats — keyed to the seat, they would accumulate two of these.
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  pageName: text('page_name').notNull(),
  /** The label as the game prints it — pages count kills, chests, completions, laps. */
  label: text('label').notNull(),
  count: integer('count').notNull(),
}, (t) => [uniqueIndex('member_clog_kc_unique').on(t.accountId, t.pageName, t.label)]);

/**
 * Best times, in CENTISECONDS. The game separates runs by hundredths, so seconds would tie times the
 * game itself doesn't.
 *
 * `teamSize` is part of the key because a solo Chambers PB and a five-man one are different records;
 * null means the activity doesn't have team sizes (or the client didn't say).
 */
/**
 * Account progress the hiscores don't publish: quest points, combat-achievement points and tier,
 * diaries per tier. See lib/memberProgress for the key registry.
 *
 * One row per (member, key) rather than a wide row per member. A login pushes only the keys that
 * actually moved — usually none — so an idle clan writes nothing, and a key added later is a
 * registry entry instead of a migration. Values only ever rise; the ingest max-merges, which makes
 * a re-push idempotent and stops a client that read a varbit before the game populated it from
 * erasing somebody's account.
 */
export const memberProgress = pgTable('member_progress', {
  id: serial('id').primaryKey(),
  // The ACCOUNT this describes, not the roster seat. Jagex tracks accounts, and a person in two
  // clans holds one account and two seats — keyed to the seat, they would accumulate two of these.
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  /** A key from PROGRESS_KEYS — 'questPoints', 'caPoints', 'caTier', 'diaryElite', … */
  key: text('key').notNull(),
  value: integer('value').notNull(),
  updatedAt: text('updated_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
}, (table) => [
  uniqueIndex('member_progress_account_key_unique').on(table.accountId, table.key),
  index('member_progress_key_idx').on(table.key),
]);

export const memberPersonalBests = pgTable('member_personal_bests', {
  id: serial('id').primaryKey(),
  // The ACCOUNT this describes, not the roster seat. Jagex tracks accounts, and a person in two
  // clans holds one account and two seats — keyed to the seat, they would accumulate two of these.
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  /** Lowercased activity name as the game's kill-count line names it. */
  activity: text('activity').notNull(),
  /**
   * 0 means "this activity has no team sizes", NOT null. NULLs count as distinct in a unique
   * index, so a nullable column here would let one member accumulate a new row per push for
   * every activity that doesn't report a size — which is nearly all of them.
   */
  teamSize: integer('team_size').notNull().default(0),
  centis: integer('centis').notNull(),
  achievedAt: text('achieved_at'),
  updatedAt: text('updated_at').notNull(),
}, (t) => [
  uniqueIndex('member_pb_unique').on(t.accountId, t.activity, t.teamSize),
  index('member_pb_activity_idx').on(t.activity, t.centis),
]);

/**
 * Something that happened worth telling the clan about — a pet, a unique off the boss everyone is
 * racing, a death to that same boss — filed against whatever was running at the time.
 *
 * WHY A TABLE AND NOT A DISCORD POST. All of this already flies past in a webhook and is gone. The
 * week it belongs to is exactly the context that makes it a story ("Rift guardian, during Runecrafting
 * week, at 41k XP in"), and that context only exists here.
 *
 * NEVER SCORES ANYTHING. Every row is client-reported: the plugin says it saw a drop, and no
 * hiscores read can confirm that. Standings stay on the sweep's numbers; this is the colour around
 * them. Read `lib/moments.ts` before wiring one of these into anything that awards a point.
 *
 * Both scopes are nullable and BOTH may be set: a pet during a Runecrafting SOTW that is also
 * mid-bingo belongs to both, and forcing a choice would lose one of them. A row with neither is
 * never written — nothing was running, so nobody is looking.
 */
export const moments = pgTable('moments', {
  id: serial('id').primaryKey(),
  clanMemberId: integer('clan_member_id').notNull().references(() => clanMemberships.id, { onDelete: 'cascade' }),
  /** Display name at the time. Denormalized so an old moment still reads right after a rename. */
  rsn: text('rsn').notNull(),
  /** 'pet' | 'unique' | 'death' | 'loot' | 'ca' — see MomentKind in lib/moments.ts. */
  kind: text('kind').notNull(),
  weeklyCompetitionId: integer('weekly_competition_id').references(() => weeklyCompetitions.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }),
  /** The item, when there is one. Deaths have none; a pet whose name we couldn't resolve has a name only. */
  itemId: integer('item_id'),
  itemName: text('item_name'),
  quantity: integer('quantity').notNull().default(1),
  /** GE value of the item (or the whole haul, for a 'loot' moment), as the client priced it. */
  valueGp: integer('value_gp'),
  /** What it came from / what killed them — an NPC, a chest, an activity. Null when unknown. */
  source: text('source'),
  /** 'npc' | 'event' | 'pvp' | 'pickpocket' | 'skill' — the plugin's own loot-source taxonomy. */
  sourceKind: text('source_kind'),
  /** Killcount at the moment, when the client knew it. What makes a spoon measurable. */
  kc: integer('kc'),
  /** 1-in-N, priced HERE from the shipped drop dataset — never trusted from the client. */
  rarityDenominator: integer('rarity_denominator'),
  /**
   * COMBAT TASKS only: which tier it was. Read from our own CA dataset by task name (the client's
   * tier is a fallback for a task added to the game since it was built), and stored rather than
   * re-derived so an old line still reads right after the dataset moves on. NULL on every other kind.
   */
  tier: text('tier'),
  /** When it happened in game (client clock, clamped server-side) vs when we stored it. */
  occurredAt: text('occurred_at').notNull(),
  noticedAt: text('noticed_at').default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`).notNull(),
  /**
   * The client's own idempotency key for this moment. A pet fires three chat lines and a kill fires
   * two loot events, so the same thing arrives more than once by design — and a retry after a
   * timeout arrives again on purpose. Unique per member, so all of them collapse to one row.
   */
  dedupKey: text('dedup_key').notNull(),
}, (t) => [
  uniqueIndex('moments_member_dedup_idx').on(t.clanMemberId, t.dedupKey),
  index('moments_weekly_idx').on(t.weeklyCompetitionId, t.occurredAt),
  index('moments_event_idx').on(t.eventId, t.occurredAt),
  index('moments_member_idx').on(t.clanMemberId, t.occurredAt),
]);

export type MemberClog = typeof memberClog.$inferSelect;
export type MemberClogItem = typeof memberClogItems.$inferSelect;
export type MemberClogKc = typeof memberClogKc.$inferSelect;
export type MemberPersonalBest = typeof memberPersonalBests.$inferSelect;
export type Moment = typeof moments.$inferSelect;
