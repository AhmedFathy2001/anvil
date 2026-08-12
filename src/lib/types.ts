// Canonical shared types used across client components

import type { SignupProfile } from '@/lib/signup';
import type { StatContributionSnapshot } from '@/lib/statTracking';

export interface Event {
  id: number;
  name: string;
  boardSize: number;
  createdAt: string;
  draftStatus: string;
  draftOrder: string | null;
  startDate: string | null;
  endDate: string | null;
  startNotified?: number | null;
  endNotified?: number | null;
  draftNotified?: number | null;
  forceEndedAt: string | null;
  originalEndDate: string | null;
  signupFee: number | null;
  addedPrizePool?: number | null;
  signupOpensAt: string | null;
  signupDeadline: string | null;
  paymentDeadline?: string | null;
  captainSelectionDeadline: string | null;
  scoringMode?: string; // 'tiles' (classic) | 'points'
  format?: string; // 'bingo' (grid) | 'tilerace' (ordered linear track)
  discordCategoryId?: string | null; // Discord category holding this event's team channels
  tilesRevealed?: number; // 0 = tiles hidden from non-staff until an admin reveals them; 1 = visible
  // Multi-account enrollment (see events schema). accountSlotMode drives team-size + MVP rollup.
  maxAccountsPerPerson?: number;
  accountSlotMode?: string; // 'per-person' (N accounts = 1 slot, MVP aggregates) | 'per-account'
  feeMode?: string; // 'per-person' | 'per-account'
  // Per-event game rules JSON (lib/eventRules) — reveal policy + scoring modifiers. Null = classic.
  rules?: string | null;
}

export interface TileRevealState {
  // Per-tile reveal state (reveal-policy events only — see lib/eventRules; null on classic events).
  revealAt?: string | null; // planned reveal time ('scheduled' policy)
  revealedAt?: string | null; // when the tile actually went live
  closedAt?: string | null; // when a bounty tile was claimed
}

export interface Tile extends TileRevealState {
  id: number;
  eventId: number;
  position: number;
  label: string;
  icon?: string | null;
  description?: string | null;
  tileType: string;
  requiredAmount?: number | null;
  trackedStat?: string | null;
  statType?: string | null;
  statGoal?: number | null;
  trackingMode?: string | null;
  optional?: number | null;
  // 1 = auto-crediting suppressed for this tile (stats cron / plugin-stats / submission
  // thresholds all skip it); completed manually instead. See tiles.autoTrackDisabled.
  autoTrackDisabled?: number | null;
  trackedItemIds?: string | null;
  itemRequirements?: string | null;
  /** Collection tiles: 'any' (default/null) | 'all' — how the item groups combine. See collectionSets. */
  groupMode?: string | null;
  /** Drop tiles: most credits a single kill can give (null = uncapped). 1 = count rolls, not items. */
  perKillCap?: number | null;
  points?: number | null;
  category?: string | null;
  sourceNpcs?: string | null; // JSON array of source NPC names (drop tiles only)
  targetNpcs?: string | null; // JSON array of target NPC names (kill tiles only)
  timedActivity?: string | null; // activity identifier (timed tiles only)
  timeThresholdSeconds?: number | null; // completion-time cap in seconds (timed tiles only)
  partySize?: number | null; // timed raid tiles — exact party size required (null = any)
  pvpMinLootValue?: number | null; // pvp tiles — min loot value (gp) a kill must yield (null/0 = none)
  mission?: number | null; // 1 = a mission tile (hidden until announced mid-event; see tiles.mission)
  rules?: string | null; // per-mission scoring JSON (see tiles.rules / MissionRules); null on normal tiles
  // Optimistic-concurrency stamp (see tiles PUT baseUpdatedAt). Null on legacy rows.
  updatedAt?: string | null;
}

export interface Team {
  id: number;
  eventId: number;
  name: string;
  color: string;
  captainUserId?: number | null;
  // Read-time join of the captain's display name (admin teams page) — not a DB column.
  captainName?: string | null;
  discordRoleId?: string | null;
  discordTextChannelId?: string | null;
  discordVoiceChannelId?: string | null;
}

export interface Player {
  id: number;
  eventId: number;
  name: string;
  discord: string | null;
  timezone: string | null;
  teamId: number | null;
  pickNumber: number | null;
  pickedAt: string | null;
  playerToken: string | null;
  statsSnapshot?: string | null;
  snapshotAt?: string | null;
  cachedStats?: string | null;
  lastStatsFetch?: string | null;
  // Bench / sub-out marker (players.frozenAt). Non-null = the player is frozen: their stat gain is
  // pinned at the sub moment and still counts toward team tiles, but the sweep no longer tracks them.
  frozenAt?: string | null;
  // Frozen sign-up answers for this player's chosen RSN, joined in at read time on the
  // draft surfaces (null when the player has no linked sign-up). See lib/draftProfiles.
  profile?: SignupProfile | null;
  clanMemberId?: number | null; // identity of the account this player row represents
  // Owner (site user) — multi-account: a person's account rows share this, driving the 'per-person'
  // team-size + MVP rollup. Null for guests. Attached at read time (see lib/draftProfiles.attachOwners).
  ownerUserId?: number | null;
}

export interface Completion {
  id: number;
  teamId: number;
  tileId: number;
  completedAt: string;
  // Frozen per-member KC/XP split for a completed STAT tile (see completions.statContributions). Fed
  // to computeMemberBreakdown so a finished tile's "who got what %" stops drifting. Absent/null for
  // submission-backed / manual tiles and legacy stat completions (breakdown falls back to live gains).
  statContributions?: StatContributionSnapshot | null;
  // Frozen points this completion earned when event rules modified them (first-team bonus, reveal
  // decay — see completions.awardedPoints). Absent/null = score the tile's live weight as always.
  awardedPoints?: number | null;
}

export interface Submission {
  id: number;
  tileId: number;
  teamId: number;
  playerId: number | null;
  creditPlayerId: number | null;
  amount: number;
  imageUrl: string | null;
  note: string | null;
  createdAt: string;
  uploaderName?: string | null;
  creditPlayerName?: string | null;
  itemId?: number | null;
  durationSeconds?: number | null; // timed-tile clear time in seconds
}

export interface ItemRequirement {
  itemId: number;
  name: string;
  requiredAmount: number;
  /** Set name — requirements sharing a group form one set. How the sets COMBINE is the tile's
   *  `groupMode` (lib/collectionSets): 'any' (default) OR-s them (satisfy one set), 'all' AND-s
   *  them (satisfy every set). Absent/null = a classic always-required collection item. */
  group?: string | null;
  /** How many DISTINCT items in this set satisfy it. Absent/null = all of them (a full set);
   *  1 is "any one from this source", which is what makes "one from each boss" expressible. */
  groupRequire?: number | null;
}

export interface ItemRequirementProgress extends ItemRequirement {
  currentAmount: number;
}

export interface TileConfig {
  label: string;
  description: string | null;
  tileType: string;
  requiredAmount: number | null;
  trackedStat: string | null;
  statType: string | null;
  statGoal: number | null;
  trackingMode: string;
  optional: boolean;
  // Admin flag: when true, the site won't auto-credit this tile — it's completed manually.
  autoTrackDisabled: boolean;
  trackedItemIds: number[] | null;
  itemRequirements: ItemRequirement[] | null;
  /** Collection tiles: 'any' (default) | 'all' — how the item sets combine (lib/collectionSets). */
  groupMode?: string | null;
  /** Drop tiles: most credits a single kill can give (null = uncapped). 1 = count rolls, not items. */
  perKillCap?: number | null;
  points: number;
  category: string | null;
  // Specific source NPC names a drop must come from (e.g. ["Tekton"]). null = any source.
  sourceNpcs: string[] | null;
  // Kill tiles: NPC names whose kills count (e.g. ["Chicken"]). null for non-kill tiles.
  targetNpcs: string[] | null;
  // Timed tiles: activity to time + completion-time cap in seconds. null for non-timed tiles.
  timedActivity: string | null;
  timeThresholdSeconds: number | null;
  // Timed raid tiles: require exactly this many players in the raid instance. null = any.
  partySize?: number | null;
  // PvP tiles: minimum loot value (gp) a kill must yield to count. null/0 = no minimum.
  pvpMinLootValue?: number | null;
  // MISSION tiles: hidden until announced mid-event, with their own scoring. `mission` flags it;
  // `missionRules` holds lockout / first-clear bonus / decay / auto-expiry (null on a normal tile).
  mission?: boolean;
  missionRules?: TileMissionRules | null;
  updatedAt?: string | null;
}

// Per-mission scoring the tile editor sends (serialized into tiles.rules server-side). Mirrors
// lib/eventRules MissionRules. Decay/bonus only bite in a points event; lockout works anywhere.
export interface TileMissionRules {
  lockout: boolean;
  firstBonus: number;
  decay: { targetPct: number; hours: number } | null;
  expiryHours: number | null;
}

export interface PlayerGain {
  playerId: number;
  playerName: string;
  gained: number;
  current: number;
}
