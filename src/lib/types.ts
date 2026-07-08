// Canonical shared types used across client components

import type { SignupProfile } from '@/lib/signup';

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
}

export interface Tile {
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
  trackedItemIds?: string | null;
  itemRequirements?: string | null;
  points?: number | null;
  category?: string | null;
  sourceNpcs?: string | null; // JSON array of source NPC names (drop tiles only)
  targetNpcs?: string | null; // JSON array of target NPC names (kill tiles only)
  timedActivity?: string | null; // activity identifier (timed tiles only)
  timeThresholdSeconds?: number | null; // completion-time cap in seconds (timed tiles only)
  partySize?: number | null; // timed raid tiles — exact party size required (null = any)
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
  // Frozen sign-up answers for this player's chosen RSN, joined in at read time on the
  // draft surfaces (null when the player has no linked sign-up). See lib/draftProfiles.
  profile?: SignupProfile | null;
}

export interface Completion {
  id: number;
  teamId: number;
  tileId: number;
  completedAt: string;
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
  /** Set name for "any full set" collections — requirements sharing a group form a set that
   *  is OR-ed against the other sets (one complete set finishes the tile; no mixing).
   *  Absent/null = a classic always-required collection item. */
  group?: string | null;
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
  trackedItemIds: number[] | null;
  itemRequirements: ItemRequirement[] | null;
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
  updatedAt?: string | null;
}

export interface PlayerGain {
  playerId: number;
  playerName: string;
  gained: number;
  current: number;
}
