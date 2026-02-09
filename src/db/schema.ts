import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
  womCompetitionId: integer('wom_competition_id'),
  startNotified: integer('start_notified').default(0),
  endNotified: integer('end_notified').default(0),
  forceEndedAt: text('force_ended_at'),
  originalEndDate: text('original_end_date'),
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
  womCompetitionId: integer('wom_competition_id'),
  optional: integer('optional').default(0),
});

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  captainPassword: text('captain_password').notNull(),
});

export const completions = sqliteTable('completions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  tileId: integer('tile_id').notNull().references(() => tiles.id, { onDelete: 'cascade' }),
  completedAt: text('completed_at').default(sql`(datetime('now'))`).notNull(),
}, (table) => [
  uniqueIndex('team_tile_unique').on(table.teamId, table.tileId),
]);

export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
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
}, (table) => [
  uniqueIndex('player_token_unique').on(table.playerToken),
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
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('moderator'), // 'admin' | 'moderator'
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  createdBy: integer('created_by'),
});

export const weeklyCompetitions = sqliteTable('weekly_competitions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // 'skill' | 'boss'
  metric: text('metric').notNull(), // e.g. 'attack', 'zulrah'
  title: text('title').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  womCompetitionId: integer('wom_competition_id'),
  status: text('status').notNull().default('upcoming'), // 'upcoming' | 'active' | 'completed'
});

export const weeklyParticipants = sqliteTable('weekly_participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competitionId: integer('competition_id').notNull().references(() => weeklyCompetitions.id, { onDelete: 'cascade' }),
  rsn: text('rsn').notNull(),
  baselineValue: integer('baseline_value'),
  currentValue: integer('current_value'),
  lastUpdated: text('last_updated'),
}, (table) => [
  uniqueIndex('weekly_participant_unique').on(table.competitionId, table.rsn),
]);
