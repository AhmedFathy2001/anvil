/**
 * Where a new player lands when they sign up for a board: the host's "Team placement" choice.
 *
 *   auto  — auto-balance. Every sign-up joins the team with the fewest players, creating the host's
 *           chosen number of teams on demand. The default for a NEW event: a streamer posting a link
 *           to hundreds of strangers cannot draft them, and should not have to build teams first.
 *   pick  — the player chooses one of the teams the host built, when they sign up, optionally
 *           capped per team. They are seated straight away (unlike rules.teamChoice, which is a
 *           request that staff approve).
 *   draft — today's behaviour and what every existing event keeps: joins go to the pool, and the
 *           host or captains put them on teams.
 *   solo  — everyone for themselves. Each player gets a team of their own, named after their
 *           character. Standings, scoring and the plugin all run on teams, so they work unchanged.
 *
 * An invite link to a specific team always wins over all of these, and nothing here ever moves a
 * player who is already on a team: balancing is decided once, at the door.
 *
 * PURE — no database import, so the event form and the sign-up form can draw the choice, and the
 * tests can pin the balancing rule without a server. lib/teamPlacementDb applies it under a lock.
 */

export const TEAM_PLACEMENTS = ['auto', 'pick', 'draft', 'solo'] as const;
export type TeamPlacement = (typeof TEAM_PLACEMENTS)[number];

/** What a brand-new event starts on. The column's own default stays 'draft' for every older row. */
export const DEFAULT_NEW_EVENT_PLACEMENT: TeamPlacement = 'auto';
export const DEFAULT_AUTO_TEAM_COUNT = 4;
export const MIN_AUTO_TEAMS = 2;
export const MAX_AUTO_TEAMS = 50;
export const MAX_TEAM_CAP = 1000;

export function isTeamPlacement(v: unknown): v is TeamPlacement {
  return typeof v === 'string' && (TEAM_PLACEMENTS as readonly string[]).includes(v);
}

/**
 * The placement actually in effect for an event.
 *
 * Unknown values read as `draft` — the shape that has always worked, so a typo can never leave
 * sign-ups with nowhere to go. A clan-versus-clan board (`teamFormation: 'per_clan'`) places by clan
 * and ignores this setting entirely.
 */
export function placementOf(event: { teamPlacement?: string | null; teamFormation?: string | null }): TeamPlacement {
  if (event.teamFormation === 'per_clan') return 'draft';
  return isTeamPlacement(event.teamPlacement) ? event.teamPlacement : 'draft';
}

export const PLACEMENT_META: Record<TeamPlacement, { label: string; short: string; help: string }> = {
  auto: {
    label: 'Auto-balance',
    short: 'Anvil spreads players evenly as they join',
    help: 'Each person who signs up joins the team with the fewest players. You only choose how many teams; Anvil makes them on the first sign-ups. Good for big public events.',
  },
  pick: {
    label: 'Players pick',
    short: 'Players choose a team when they sign up',
    help: 'You create the teams first, then each player picks one on the sign-up form and goes straight onto it. Set a limit per team if you want them to stay even.',
  },
  draft: {
    label: 'Host drafts',
    short: 'Sign-ups wait in a pool for you or captains to pick',
    help: 'Everyone who signs up waits in a pool. You or your captains run a draft, or assign people by hand. Best when you know the players.',
  },
  solo: {
    label: 'Solo',
    short: 'Everyone for themselves',
    help: 'No teams to build. Every player is on their own, named after their character, and the standings rank players instead of teams.',
  },
};

/** A team as placement sees it: how many players it already has. */
export interface TeamLoad {
  id: number;
  name: string;
  color?: string | null;
  size: number;
}

/** The team with the fewest players; a tie goes to the lowest id (the oldest team). */
export function fewestPlayers<T extends TeamLoad>(teams: readonly T[]): T | null {
  let best: T | null = null;
  for (const t of teams) {
    if (!best || t.size < best.size || (t.size === best.size && t.id < best.id)) best = t;
  }
  return best;
}

/**
 * How many teams an auto-balanced board is aiming for.
 *
 * The host's count when they set one; otherwise the teams they already built, or the default when
 * there are none. Never fewer than the teams that exist — placement does not delete anything.
 */
export function autoTargetCount(existing: number, configured: number | null | undefined): number {
  const wanted = configured != null && configured >= 1 ? Math.min(Math.floor(configured), MAX_AUTO_TEAMS) : existing > 0 ? existing : DEFAULT_AUTO_TEAM_COUNT;
  return Math.max(wanted, existing);
}

export type AutoChoice = { kind: 'existing'; teamId: number } | { kind: 'create'; name: string; color: string };

/**
 * Auto-balance: which team the next sign-up joins.
 *
 * Teams are made lazily, one per sign-up, until the target count exists. That is exactly what
 * "create every team up front, then join the emptiest (ties to the lowest id)" would do — a team not
 * yet made has nobody on it and would have the highest id — without leaving empty teams on a board
 * that only ever drew three players.
 */
export function chooseAutoTeam(teams: readonly TeamLoad[], configuredCount: number | null | undefined): AutoChoice {
  const target = autoTargetCount(teams.length, configuredCount);
  const best = fewestPlayers(teams);
  if (best && (best.size === 0 || teams.length >= target)) return { kind: 'existing', teamId: best.id };
  return {
    kind: 'create',
    name: nextTeamName(teams.map((t) => t.name)),
    color: nextTeamColour(teams.map((t) => t.color ?? '')),
  };
}

/** "Team 1", "Team 2"… — the lowest number no team on the board already uses. */
export function nextTeamName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  for (let i = 1; ; i++) {
    const name = `Team ${i}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/** Twelve colours that read apart on the dark board, in the order teams get them. */
export const PLACEMENT_COLOURS = [
  '#dc2626', // red
  '#2563eb', // blue
  '#16a34a', // green
  '#eab308', // yellow
  '#9333ea', // purple
  '#db2777', // pink
  '#ea580c', // orange
  '#0891b2', // cyan
  '#65a30d', // lime
  '#4f46e5', // indigo
  '#b45309', // amber-brown
  '#0d9488', // teal
] as const;

/** The first palette colour nobody on the board has; past the palette, a golden-angle hue. */
export function nextTeamColour(usedColours: readonly string[]): string {
  const used = new Set(usedColours.map((c) => c.trim().toLowerCase()));
  const free = PLACEMENT_COLOURS.find((c) => !used.has(c));
  return free ?? goldenColour(usedColours.length);
}

function goldenColour(i: number): string {
  const hue = (i * 137.508) % 360;
  const s = 0.62;
  const l = 0.52;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** A solo player's team: their character's name, made unique on the board if two collide. */
export function soloTeamName(rsn: string, existingNames: readonly string[]): string {
  const base = rsn.trim() || 'Player';
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const name = `${base} (${i})`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

export type PickVerdict = { ok: true } | { ok: false; reason: 'no-such-team' | 'full' };

/**
 * Players pick: may `adding` more players join this team?
 *
 * `cap` null or 0 means no limit. A team that is not on this board is refused rather than ignored —
 * an id from another event would otherwise seat somebody where they were never offered a place.
 */
export function checkPick(team: TeamLoad | null | undefined, cap: number | null | undefined, adding = 1): PickVerdict {
  if (!team) return { ok: false, reason: 'no-such-team' };
  if (cap != null && cap > 0 && team.size + adding > cap) return { ok: false, reason: 'full' };
  return { ok: true };
}

/** Whether a team still has room, for the sign-up form's list. */
export function isTeamFull(team: TeamLoad, cap: number | null | undefined): boolean {
  return cap != null && cap > 0 && team.size >= cap;
}

/** Clamp a host-typed team count to something placement can use; null clears it. */
export function normaliseTeamCount(v: unknown): number | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < MIN_AUTO_TEAMS || v > MAX_AUTO_TEAMS) return 'invalid';
  return v;
}

/** Clamp a host-typed per-team cap; null (or 0) is no limit. */
export function normaliseTeamCap(v: unknown): number | null | 'invalid' {
  if (v === null || v === undefined || v === '' || v === 0) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > MAX_TEAM_CAP) return 'invalid';
  return v;
}
