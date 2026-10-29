// Which event posts reach Discord, where, and who they ping. Three layers, most specific wins:
//
//   1. the clan's defaults (settings `discord_event_posts`) — what every event starts from,
//   2. the event's own choices (events.discord_prefs) — on / off / default per post, a pause,
//   3. for a co-hosted board, the host's share cap and each partner's own choices
//      (event_cohosts.discord_prefs) — a partner can show less than the host shares, never more.
//
// Pure (no db), so the admin panels, the send path (lib/discord sendEventBingoWebhook) and the tests
// all read the same rules. With nothing stored anywhere every post is on and pings exactly as it did
// before these settings existed.

import type { EventPostKind } from './eventWebhookKinds.ts';

export type PostGroup = 'life' | 'draft' | 'board' | 'missions' | 'money';

export const POST_GROUPS: { key: PostGroup; label: string }[] = [
  { key: 'life', label: 'Start & finish' },
  { key: 'draft', label: 'Draft' },
  { key: 'board', label: 'Board activity' },
  { key: 'missions', label: 'Missions & reveals' },
  { key: 'money', label: 'Sign-ups & prizes' },
];

// `hook` = which extra-webhook kind it rides (lib/eventWebhookKinds); none = host and co-hosts only.
// `ping` = it pinged the member role before these settings, so that stays its default.
// `big` = one of the "big moments" a host can share with partners without the play-by-play.
// `partner` = false: only ever posts to the host (staff info, or a post addressed to one clan).
export const DISCORD_POST_TYPES = [
  { key: 'boardRevealed', group: 'life', label: 'Board revealed', help: 'When the tiles go public before the start', hook: 'announcements', ping: true, big: false, partner: true },
  { key: 'eventStart', group: 'life', label: 'Event started', help: 'At the start, with the starting spot', hook: 'lifecycle', ping: true, big: true, partner: true },
  { key: 'rules', group: 'life', label: 'Rules post', help: 'Posted at the start; updates itself when the rules change', hook: null, ping: false, big: true, partner: true },
  { key: 'startHeld', group: 'life', label: 'Start on hold', help: 'Why the event could not start (staff info)', hook: null, ping: false, big: false, partner: false },
  { key: 'digest', group: 'life', label: 'Daily digest', help: 'Every 24 hours while the event runs', hook: 'lifecycle', ping: false, big: false, partner: true },
  { key: 'halfway', group: 'life', label: 'Halfway report', help: 'Once, at the halfway point', hook: 'lifecycle', ping: false, big: false, partner: true },
  { key: 'eventEnd', group: 'life', label: 'Event ended + recap', help: 'Final standings and awards (also when ended early)', hook: 'lifecycle', ping: true, big: true, partner: true },
  { key: 'draftStart', group: 'draft', label: 'Draft started', help: 'When captains start picking', hook: 'draft', ping: true, big: false, partner: true },
  { key: 'draftDone', group: 'draft', label: 'Draft complete', help: 'The final rosters', hook: 'draft', ping: false, big: true, partner: true },
  { key: 'submissions', group: 'board', label: 'Submissions', help: 'Each drop or proof, grouped every few minutes', hook: 'drops', ping: false, big: false, partner: true },
  { key: 'submissionRemoved', group: 'board', label: 'Submission removed', help: 'When staff delete one', hook: 'drops', ping: false, big: false, partner: true },
  { key: 'tileComplete', group: 'board', label: 'Tile completed', help: 'Whenever a team finishes a tile', hook: 'completions', ping: false, big: false, partner: true },
  { key: 'teamWin', group: 'board', label: 'Team wins', help: 'A team clears the board', hook: 'win', ping: false, big: true, partner: true },
  { key: 'reveals', group: 'missions', label: 'Missions & tiles revealed', help: 'Hidden tiles and missions going live', hook: 'announcements', ping: false, big: false, partner: true },
  { key: 'claims', group: 'missions', label: 'Mission prizes & bounty claims', help: 'Who claimed what', hook: 'announcements', ping: false, big: false, partner: true },
  { key: 'signupApproved', group: 'money', label: 'Sign-up approved', help: 'Pings the player, with a reminder to pay the fee', hook: null, ping: false, big: false, partner: false },
  { key: 'payouts', group: 'money', label: 'Payouts announced', help: 'Once every prize is paid', hook: null, ping: true, big: false, partner: false },
  { key: 'monthlyChampion', group: 'money', label: 'Monthly champion', help: 'Ladder events, at the end of each month', hook: null, ping: false, big: false, partner: false },
] as const satisfies readonly {
  key: string;
  group: PostGroup;
  label: string;
  help: string;
  hook: EventPostKind | null;
  ping: boolean;
  big: boolean;
  partner: boolean;
}[];

export type DiscordPostType = (typeof DISCORD_POST_TYPES)[number]['key'];
export type PostTypeInfo = (typeof DISCORD_POST_TYPES)[number];

const BY_KEY = new Map<string, PostTypeInfo>(DISCORD_POST_TYPES.map((t) => [t.key, t]));

export function postTypeInfo(key: DiscordPostType): PostTypeInfo {
  return BY_KEY.get(key)!;
}

export function isDiscordPostType(v: unknown): v is DiscordPostType {
  return typeof v === 'string' && BY_KEY.has(v);
}

/** Who a post @mentions: nobody, the clan's member role, or the clan's event-player role. */
export type PingChoice = 'none' | 'members' | 'players';
const PINGS = new Set<string>(['none', 'members', 'players']);
export function isPingChoice(v: unknown): v is PingChoice {
  return typeof v === 'string' && PINGS.has(v);
}

/** A clan's defaults for every event. Missing entries mean "as before": on, with the old ping. */
export interface ClanPostDefaults {
  posts: Partial<Record<DiscordPostType, boolean>>;
  pings: Partial<Record<DiscordPostType, PingChoice>>;
}

export type Toggle = 'on' | 'off';
export type PartnerShare = 'all' | 'big' | 'none';
export type CleanupMode = 'never' | 'end' | 'after';
export type PlayerRoleTiming = 'approve' | 'draft' | 'never';

/** One event's choices. Every field is optional: absent = follow the clan. */
export interface EventDiscordPrefs {
  posts?: Partial<Record<DiscordPostType, Toggle>>;
  pings?: Partial<Record<DiscordPostType, PingChoice>>;
  /** A channel just for this event (a webhook URL). Absent = the clan's bingo channel. */
  webhookUrl?: string | null;
  /** false = keep this event's posts out of the co-hosts' servers. */
  cohosts?: boolean;
  /** ISO time posting resumes, or 'indefinite'. Absent / past = not paused. */
  pausedUntil?: string | null;
  /** The most a co-host may show of this board. */
  partnerShare?: PartnerShare;
  teamChannels?: Toggle;
  cleanup?: { mode: CleanupMode; days?: number };
  playerRole?: PlayerRoleTiming;
  removePlayerRoleAtEnd?: boolean;
}

export type PartnerPreset = 'host' | 'big' | 'off';

/** A co-host clan's choices for one board it plays. */
export interface PartnerDiscordPrefs {
  preset?: PartnerPreset;
  /** Groups switched off on top of the preset. */
  groupsOff?: PostGroup[];
  ping?: PingChoice;
  webhookUrl?: string | null;
  playerRole?: boolean;
  teamChannels?: boolean;
}

export interface PostDecision {
  send: boolean;
  ping: PingChoice;
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const GROUP_KEYS = new Set<string>(POST_GROUPS.map((g) => g.key));

/** Stored text/json → clan defaults, unknown keys and bad values dropped. */
export function parseClanPostDefaults(raw: unknown): ClanPostDefaults {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  const o = rec(v);
  const posts: ClanPostDefaults['posts'] = {};
  for (const [k, val] of Object.entries(rec(o.posts))) if (isDiscordPostType(k) && typeof val === 'boolean') posts[k] = val;
  const pings: ClanPostDefaults['pings'] = {};
  for (const [k, val] of Object.entries(rec(o.pings))) if (isDiscordPostType(k) && isPingChoice(val)) pings[k] = val;
  return { posts, pings };
}

function isHttpsUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https:\/\/\S+$/i.test(v.trim());
}

/** Stored json → event prefs, keeping only what's valid. Also the write path's sanitizer. */
export function parseEventDiscordPrefs(raw: unknown): EventDiscordPrefs {
  const o = rec(raw);
  const out: EventDiscordPrefs = {};
  const posts: NonNullable<EventDiscordPrefs['posts']> = {};
  for (const [k, val] of Object.entries(rec(o.posts))) if (isDiscordPostType(k) && (val === 'on' || val === 'off')) posts[k] = val;
  if (Object.keys(posts).length) out.posts = posts;
  const pings: NonNullable<EventDiscordPrefs['pings']> = {};
  for (const [k, val] of Object.entries(rec(o.pings))) if (isDiscordPostType(k) && isPingChoice(val)) pings[k] = val;
  if (Object.keys(pings).length) out.pings = pings;
  if (isHttpsUrl(o.webhookUrl)) out.webhookUrl = o.webhookUrl.trim();
  if (typeof o.cohosts === 'boolean') out.cohosts = o.cohosts;
  if (o.pausedUntil === 'indefinite' || (typeof o.pausedUntil === 'string' && !Number.isNaN(Date.parse(o.pausedUntil)))) {
    out.pausedUntil = o.pausedUntil;
  }
  if (o.partnerShare === 'all' || o.partnerShare === 'big' || o.partnerShare === 'none') out.partnerShare = o.partnerShare;
  if (o.teamChannels === 'on' || o.teamChannels === 'off') out.teamChannels = o.teamChannels;
  const c = rec(o.cleanup);
  if (c.mode === 'never' || c.mode === 'end' || c.mode === 'after') {
    const days = typeof c.days === 'number' && Number.isFinite(c.days) ? Math.max(1, Math.min(90, Math.round(c.days))) : undefined;
    out.cleanup = c.mode === 'after' ? { mode: 'after', days: days ?? 7 } : { mode: c.mode };
  }
  if (o.playerRole === 'approve' || o.playerRole === 'draft' || o.playerRole === 'never') out.playerRole = o.playerRole;
  if (typeof o.removePlayerRoleAtEnd === 'boolean') out.removePlayerRoleAtEnd = o.removePlayerRoleAtEnd;
  return out;
}

export function parsePartnerDiscordPrefs(raw: unknown): PartnerDiscordPrefs {
  const o = rec(raw);
  const out: PartnerDiscordPrefs = {};
  if (o.preset === 'host' || o.preset === 'big' || o.preset === 'off') out.preset = o.preset;
  if (Array.isArray(o.groupsOff)) {
    const g = o.groupsOff.filter((x): x is PostGroup => typeof x === 'string' && GROUP_KEYS.has(x));
    if (g.length) out.groupsOff = [...new Set(g)];
  }
  if (isPingChoice(o.ping)) out.ping = o.ping;
  if (isHttpsUrl(o.webhookUrl)) out.webhookUrl = o.webhookUrl.trim();
  if (typeof o.playerRole === 'boolean') out.playerRole = o.playerRole;
  if (typeof o.teamChannels === 'boolean') out.teamChannels = o.teamChannels;
  return out;
}

/** Is the event paused right now? */
export function isPaused(prefs: EventDiscordPrefs, now: Date = new Date()): boolean {
  const p = prefs.pausedUntil;
  if (!p) return false;
  if (p === 'indefinite') return true;
  return Date.parse(p) > now.getTime();
}

/** The clan's default for a post (stored choice, else on with its historic ping). */
export function clanDefault(type: DiscordPostType, clan: ClanPostDefaults): PostDecision {
  const info = postTypeInfo(type);
  return {
    send: clan.posts[type] ?? true,
    ping: clan.pings[type] ?? (info.ping ? 'members' : 'none'),
  };
}

/** What the HOST's server gets for this post on this event. */
export function decideHostPost(
  type: DiscordPostType,
  clan: ClanPostDefaults,
  event: EventDiscordPrefs,
  now: Date = new Date(),
): PostDecision {
  const base = clanDefault(type, clan);
  if (isPaused(event, now)) return { send: false, ping: 'none' };
  const o = event.posts?.[type];
  const send = o === 'on' ? true : o === 'off' ? false : base.send;
  const ping = event.pings?.[type] ?? base.ping;
  return { send, ping: send ? ping : 'none' };
}

/** Does the host let partners see this post at all? */
export function hostShares(type: DiscordPostType, event: EventDiscordPrefs): boolean {
  const info = postTypeInfo(type);
  if (!info.partner || event.cohosts === false) return false;
  const share = event.partnerShare ?? 'all';
  if (share === 'none') return false;
  if (share === 'big') return info.big;
  return true;
}

/**
 * What a CO-HOST's server gets. The post must be on for the event itself (an event-level Off is off
 * everywhere), shared by the host, and wanted by the partner. A partner's ping defaults to none for
 * posts that never pinged, and to its member role for those that did.
 */
export function decidePartnerPost(
  type: DiscordPostType,
  host: PostDecision,
  event: EventDiscordPrefs,
  partner: PartnerDiscordPrefs,
): PostDecision {
  if (!host.send || !hostShares(type, event)) return { send: false, ping: 'none' };
  const info = postTypeInfo(type);
  const preset = partner.preset ?? 'host';
  if (preset === 'off') return { send: false, ping: 'none' };
  if (preset === 'big' && !info.big) return { send: false, ping: 'none' };
  if (partner.groupsOff?.includes(info.group)) return { send: false, ping: 'none' };
  const ping = info.ping ? (partner.ping ?? 'members') : 'none';
  return { send: true, ping };
}

export type PresetName = 'clan' | 'quiet' | 'silent' | 'custom';

/** Only the start, the rules, the winner and the end. */
export const QUIET_POSTS: readonly DiscordPostType[] = ['eventStart', 'rules', 'teamWin', 'eventEnd'];

/** The per-post overrides a preset writes. */
export function presetPosts(preset: Exclude<PresetName, 'custom'>): EventDiscordPrefs['posts'] {
  if (preset === 'clan') return {};
  const out: NonNullable<EventDiscordPrefs['posts']> = {};
  for (const t of DISCORD_POST_TYPES) {
    out[t.key] = preset === 'quiet' && QUIET_POSTS.includes(t.key) ? 'on' : 'off';
  }
  return out;
}

/** Which preset the stored overrides amount to. */
export function detectPreset(posts: EventDiscordPrefs['posts']): PresetName {
  const entries = Object.entries(posts ?? {});
  if (entries.length === 0) return 'clan';
  const same = (p: EventDiscordPrefs['posts']) =>
    DISCORD_POST_TYPES.every((t) => (posts ?? {})[t.key] === (p ?? {})[t.key]);
  if (same(presetPosts('silent'))) return 'silent';
  if (same(presetPosts('quiet'))) return 'quiet';
  return 'custom';
}

/** A clan's defaults for the roles and team channels every event starts from. */
export interface ClanEventRoleDefaults {
  playerRole?: PlayerRoleTiming;
  cleanup?: { mode: CleanupMode; days?: number };
  removePlayerRoleAtEnd?: boolean;
}

export function parseClanEventRoleDefaults(raw: unknown): ClanEventRoleDefaults {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  const p = parseEventDiscordPrefs(v);
  const out: ClanEventRoleDefaults = {};
  if (p.playerRole) out.playerRole = p.playerRole;
  if (p.cleanup) out.cleanup = p.cleanup;
  if (p.removePlayerRoleAtEnd !== undefined) out.removePlayerRoleAtEnd = p.removePlayerRoleAtEnd;
  return out;
}

export interface EventRoleSettings {
  /** Build a private channel + role per team when the draft finishes. */
  teamChannels: boolean;
  playerRole: PlayerRoleTiming;
  cleanup: { mode: CleanupMode; days: number };
  removePlayerRoleAtEnd: boolean;
}

/**
 * What one event does with roles and team channels: its own choice, else the clan's default, else
 * what Anvil did before these settings (channels when the clan's team sync is on, the player role
 * after the draft, nothing cleaned up).
 */
export function resolveEventRoles(clan: ClanEventRoleDefaults, event: EventDiscordPrefs, clanTeamSync: boolean): EventRoleSettings {
  const cleanup = event.cleanup ?? clan.cleanup ?? { mode: 'never' as const };
  return {
    teamChannels: event.teamChannels === 'on' ? true : event.teamChannels === 'off' ? false : clanTeamSync,
    playerRole: event.playerRole ?? clan.playerRole ?? 'draft',
    cleanup: { mode: cleanup.mode, days: cleanup.days ?? 7 },
    removePlayerRoleAtEnd: event.removePlayerRoleAtEnd ?? clan.removePlayerRoleAtEnd ?? false,
  };
}

/** When the event's team channels and roles are due to be deleted, or null for never. */
export function cleanupDueAt(roles: EventRoleSettings, endDate: string | null): number | null {
  if (!endDate || roles.cleanup.mode === 'never') return null;
  const end = Date.parse(endDate);
  if (Number.isNaN(end)) return null;
  return roles.cleanup.mode === 'end' ? end : end + roles.cleanup.days * 86_400_000;
}
