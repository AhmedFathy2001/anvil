// Canonical shared types used across client components

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
}

export interface Team {
  id: number;
  eventId: number;
  name: string;
  color: string;
  captainUserId?: number | null;
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
}

export interface PlayerGain {
  playerId: number;
  playerName: string;
  gained: number;
  current: number;
}
