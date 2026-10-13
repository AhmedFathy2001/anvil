// The clan hall: who's around right now, from three sources merged into one list.
//
//   Discord   the server widget (lib/discordWidget) — online/idle/busy, voice, and the game each
//             person's Discord shows.
//   In game   the Anvil plugin pushes stats while somebody plays, so a push in the last few minutes
//             means "logged in" (accounts.live_stats_at). Discord's "RuneLite" activity counts too;
//             a person who shows on both is counted once.
//   Anvil     RSN, clan rank, event team and this week's XP. The widget withholds user ids, so the
//             link is by name, two ways, strongest first:
//               1. the server name of a Discord id we already know owns a roster account (the
//                  owner's login, or role sync's cache) — lib/clanHallDiscordNames reads those
//                  names through the bot, so "Preduces (Predu)" finds RSN "Zezima" with no RSN in it;
//               2. the Discord name itself read as an RSN. Nickname sync (lib/discord-roles) sets
//                  nicknames to the RSN, which is what makes this one reliable.
//             A name that matches neither is shown without any of it rather than guessed at.
//
// Pure: no database, so the merge is testable on its own. lib/clanHall loads the inputs.

import type { DiscordGuildMember } from '@/lib/discord-roles';
import type { GuildWidget, WidgetMember } from '@/lib/discordWidget';

export const HALL_ENABLED_KEY = 'discord_widget_enabled';
export const HALL_PUBLIC_NAMES_KEY = 'discord_widget_public_names';
export const HALL_EMBED_KEY = 'discord_widget_embed';

/**
 * The clan's switches for the card, read from settings. Every one is OFF until an admin turns it on:
 * putting a server's presence on a public page (and having the bot mint an invite into it) is the
 * clan's call, so the bot merely being in the server is not consent.
 */
export function hallSwitches(get: (key: string) => string | null | undefined): { enabled: boolean; publicNames: boolean; embed: boolean } {
  return {
    enabled: get(HALL_ENABLED_KEY) === 'true',
    publicNames: get(HALL_PUBLIC_NAMES_KEY) === 'true',
    embed: get(HALL_EMBED_KEY) === 'true',
  };
}

/** A push this recent means the plugin is running, i.e. the person is logged in. */
export const IN_GAME_WINDOW_MS = 10 * 60_000;

export interface HallRosterEntry {
  accountId: number;
  rsn: string;
  rank: string | null;
  liveStatsAt: string | null;
}

export interface HallTeam {
  id: number;
  name: string;
  color: string;
}

export type HallDoing =
  | { kind: 'team'; team: string; color: string }
  | { kind: 'xp'; xp: number }
  | { kind: 'unlinked' };

export interface HallPerson {
  /** The name Discord shows, or the RSN for somebody seen only in game. */
  name: string;
  rsn: string | null;
  rank: string | null;
  /** Null for somebody in game but not on Discord. */
  status: WidgetMember['status'] | null;
  avatarUrl: string | null;
  inGame: boolean;
  voiceChannel: string | null;
  teamId: number | null;
  doing: HallDoing | null;
}

export interface HallRoom {
  name: string;
  people: HallPerson[];
  /** "Iron Wolves, 3 of 4" — when most of the room is one event team. */
  teamNote: string | null;
}

export interface ClanHallView {
  guild: { name: string; inviteUrl: string | null } | null;
  counts: { discord: number; online: number; idle: number; dnd: number; inGame: number; voice: number };
  voiceChannels: number;
  rooms: HallRoom[];
  emptyRooms: string[];
  /** Null when names are withheld from this viewer — the counts and rooms' sizes still show. */
  people: HallPerson[] | null;
  /** Discord lists at most 100 people; true when the widget hit that cap. */
  truncated: boolean;
}

/** Same rule as lib/auth normalizeRsn: case-insensitive, space and underscore are one character. */
export function normRsn(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_]+/g, ' ');
}

/**
 * The RSNs a Discord name might be. Nickname sync writes "Main / Alt"; people also tag themselves
 * "[AFK] Name" or "Name | PvM". Every part is a candidate; the first that is on the roster wins.
 */
export function nameCandidates(name: string): string[] {
  const stripped = name.replace(/^\s*[[(][^\])]{1,12}[\])]\s*/, '');
  const parts = stripped.split(/\s*[/|,]\s*/).map((p) => p.trim()).filter(Boolean);
  // "Name (Other)": either half may be the RSN.
  const bracketed = parts.flatMap((p) => {
    const m = p.match(/^(.+?)\s*\(([^()]+)\)$/);
    return m ? [m[1], m[2]] : [];
  });
  const out = [...parts, ...bracketed, stripped.trim(), name.trim()].map(normRsn).filter((p) => p.length >= 1 && p.length <= 12);
  return [...new Set(out)];
}

/**
 * normRsn(name) → accounts, for every name (nickname, display name, username) a Discord user whose
 * accounts we know goes by in the server. A name two people in the server share is dropped — the
 * widget cannot say which of them it is — so pass every member the bot could see, linked or not.
 */
export function indexDiscordNames(members: DiscordGuildMember[], accountsById: Map<string, number[]>): Map<string, number[]> {
  const owner = new Map<string, string | null>();
  for (const m of members) {
    const id = m.user?.id;
    if (!id) continue;
    for (const name of [m.nick, m.user?.global_name, m.user?.username]) {
      const key = name ? normRsn(name) : '';
      if (!key) continue;
      const prev = owner.get(key);
      owner.set(key, prev === undefined || prev === id ? id : null);
    }
  }
  const index = new Map<string, number[]>();
  for (const [key, id] of owner) {
    const accounts = id ? accountsById.get(id) : undefined;
    if (accounts?.length) index.set(key, accounts);
  }
  return index;
}

function isGameActivity(game: string | null): boolean {
  if (!game) return false;
  const g = game.toLowerCase();
  return g.startsWith('runelite') || g === 'old school runescape' || g.startsWith('osrs');
}

const STATUS_ORDER = { online: 0, idle: 1, dnd: 2 } as const;

function sortKey(p: HallPerson): number[] {
  return [
    p.voiceChannel ? 0 : 1,
    p.inGame ? 0 : 1,
    p.rsn ? 0 : 1,
    p.status ? STATUS_ORDER[p.status] : 3,
  ];
}

export function mergeClanHall(input: {
  widget: GuildWidget | null;
  roster: HallRosterEntry[];
  weekXp: Map<number, number>;
  teamByAccount: Map<number, HallTeam>;
  /** The clan's own invite (its setting, else one the bot made) — Discord only sends one when the server picked an invite channel. */
  inviteUrl: string | null;
  includeNames: boolean;
  /**
   * normRsn(server name) → the accounts of the Discord user who goes by it, best first
   * (lib/clanHallDiscordNames). Absent when the bot cannot read the server.
   */
  discordNames?: Map<string, number[]>;
  now?: number;
}): ClanHallView {
  const now = input.now ?? Date.now();
  const byRsn = new Map(input.roster.map((r) => [normRsn(r.rsn), r]));
  const byAccount = new Map(input.roster.map((r) => [r.accountId, r]));
  const pluginLive = (r: HallRosterEntry | undefined) => {
    if (!r?.liveStatsAt) return false;
    const t = Date.parse(r.liveStatsAt);
    return Number.isFinite(t) && now - t < IN_GAME_WINDOW_MS && t <= now + 60_000;
  };

  const doingFor = (r: HallRosterEntry | undefined): HallDoing | null => {
    if (!r) return { kind: 'unlinked' };
    const team = input.teamByAccount.get(r.accountId);
    if (team) return { kind: 'team', team: team.name, color: team.color };
    const xp = input.weekXp.get(r.accountId) ?? 0;
    return xp > 0 ? { kind: 'xp', xp } : null;
  };

  const widget = input.widget;
  const channelName = new Map((widget?.channels ?? []).map((c) => [c.id, c.name]));
  const seenAccounts = new Set<number>();
  const people: HallPerson[] = [];

  for (const m of widget?.members ?? []) {
    let entry: HallRosterEntry | undefined;
    // Known Discord user first: one person, all their accounts — the one playing stands for them.
    const owned = (input.discordNames?.get(normRsn(m.username)) ?? [])
      .map((id) => byAccount.get(id))
      .filter((r): r is HallRosterEntry => !!r && !seenAccounts.has(r.accountId));
    if (owned.length) {
      entry = owned.find(pluginLive) ?? owned[0];
      for (const r of owned) seenAccounts.add(r.accountId);
    }
    if (!entry) {
      for (const c of nameCandidates(m.username)) {
        const hit = byRsn.get(c);
        if (hit && !seenAccounts.has(hit.accountId)) {
          entry = hit;
          break;
        }
      }
    }
    if (entry) seenAccounts.add(entry.accountId);
    people.push({
      name: m.username,
      rsn: entry?.rsn ?? null,
      rank: entry?.rank ?? null,
      status: m.status,
      avatarUrl: m.avatarUrl,
      inGame: isGameActivity(m.game) || pluginLive(entry),
      voiceChannel: m.channelId ? channelName.get(m.channelId) ?? null : null,
      teamId: entry ? input.teamByAccount.get(entry.accountId)?.id ?? null : null,
      doing: doingFor(entry),
    });
  }

  // Playing, plugin running, and not (recognisably) on Discord: still around, still counted.
  for (const r of input.roster) {
    if (seenAccounts.has(r.accountId) || !pluginLive(r)) continue;
    people.push({
      name: r.rsn,
      rsn: r.rsn,
      rank: r.rank,
      status: null,
      avatarUrl: null,
      inGame: true,
      voiceChannel: null,
      teamId: input.teamByAccount.get(r.accountId)?.id ?? null,
      doing: doingFor(r),
    });
  }

  people.sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return a.name.localeCompare(b.name);
  });

  const roomsByName = new Map<string, HallPerson[]>();
  for (const p of people) {
    if (!p.voiceChannel) continue;
    const list = roomsByName.get(p.voiceChannel) ?? [];
    list.push(p);
    roomsByName.set(p.voiceChannel, list);
  }
  const rooms: HallRoom[] = [...roomsByName.entries()]
    .map(([name, inRoom]) => {
      const tally = new Map<string, number>();
      for (const p of inRoom) if (p.doing?.kind === 'team') tally.set(p.doing.team, (tally.get(p.doing.team) ?? 0) + 1);
      const [top, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
      // "Most of the room": at least two people, and more than half of it.
      const teamNote = top && n >= 2 && n * 2 > inRoom.length ? `${top}, ${n} of ${inRoom.length}` : null;
      return { name, people: input.includeNames ? inRoom : [], teamNote: input.includeNames ? teamNote : null, size: inRoom.length };
    })
    .sort((a, b) => b.size - a.size)
    .map(({ size, ...room }) => ({ ...room, people: room.people.length ? room.people : Array.from({ length: size }, () => anonymous) }));
  const emptyRooms = (widget?.channels ?? []).map((c) => c.name).filter((n) => !roomsByName.has(n));

  const members = widget?.members ?? [];
  return {
    // The clan's own invite first (an admin chose it), then Discord's widget invite.
    guild: widget ? { name: widget.name, inviteUrl: input.inviteUrl ?? widget.instantInvite } : null,
    counts: {
      discord: widget ? Math.max(widget.presenceCount, members.length) : 0,
      online: members.filter((m) => m.status === 'online').length,
      idle: members.filter((m) => m.status === 'idle').length,
      dnd: members.filter((m) => m.status === 'dnd').length,
      inGame: people.filter((p) => p.inGame).length,
      voice: people.filter((p) => p.voiceChannel).length,
    },
    voiceChannels: widget?.channels.length ?? 0,
    rooms,
    emptyRooms,
    people: input.includeNames ? people : null,
    truncated: members.length >= 100,
  };
}

/** Somebody in a voice room, for a viewer who may see how full the room is but not who is in it. */
const anonymous: HallPerson = {
  name: '',
  rsn: null,
  rank: null,
  status: null,
  avatarUrl: null,
  inGame: false,
  voiceChannel: null,
  teamId: null,
  doing: null,
};
