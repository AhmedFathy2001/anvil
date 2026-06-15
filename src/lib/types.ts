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
  signupOpensAt: string | null;
  signupDeadline: string | null;
  captainSelectionDeadline: string | null;
  scoringMode?: string; // 'tiles' (classic) | 'points'
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
}

export interface Team {
  id: number;
  eventId: number;
  name: string;
  color: string;
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
}

export interface PlayerGain {
  playerId: number;
  playerName: string;
  gained: number;
  current: number;
}
