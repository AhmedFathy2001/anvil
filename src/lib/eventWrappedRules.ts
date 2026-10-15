// Wrapped, the pure half: one card per player and one per team, shaped from what the recap, the
// moments feed, the standings and event luck already know. lib/eventWrapped loads the inputs.
//
// A card only says what we can stand behind. Every number here is something the event page or the
// recap already shows; Wrapped just puts one person's (or one team's) share of it on a picture.

import { formatCount } from '@/lib/clogLuck';
import type { WrappedPersonStats } from '@/lib/eventRecap';

export interface WrappedMomentRow {
  /** The event player row the moment belongs to, resolved from its seat. Null when unmatched. */
  playerId: number | null;
  teamId: number | null;
  kind: string;
  itemId: number | null;
  itemName: string | null;
  valueGp: number | null;
}

export interface WrappedLuckRow {
  playerId: number;
  tone: 'spooned' | 'dry';
  itemId: number;
  itemName: string;
  obtained: number;
  expected: number;
  expectedLow: number;
  /** Smaller = more remarkable. */
  tail: number;
}

export interface WrappedStanding {
  teamId: number;
  name: string;
  color: string;
  score: number;
  unit: string;
}

export interface WrappedDrop {
  itemId: number | null;
  itemName: string;
  valueGp: number | null;
}

export interface WrappedLuck {
  itemId: number;
  itemName: string;
  /** "3 of 0.4 expected". */
  headline: string;
}

export interface WrappedPlayer {
  personKey: string;
  playerIds: number[];
  name: string;
  team: { id: number; name: string; color: string; rank: number; of: number } | null;
  /** Their place among their own team, by tiles finished then kills then XP. */
  placeInTeam: { rank: number; of: number } | null;
  minutesPlayed: number;
  xpGained: number;
  kcGained: number;
  deaths: number;
  biggestHit: number;
  tilesFinished: number;
  topBoss: { name: string; kc: number } | null;
  topSkill: { name: string; xp: number } | null;
  biggestDrop: WrappedDrop | null;
  pets: WrappedDrop[];
  spooned: WrappedLuck | null;
  dry: WrappedLuck | null;
  awards: { emoji: string; title: string; valueLabel: string }[];
}

export interface WrappedTeam {
  id: number;
  name: string;
  color: string;
  rank: number;
  of: number;
  score: number;
  unit: string;
  members: number;
  minutesPlayed: number;
  xpGained: number;
  kcGained: number;
  deaths: number;
  biggestDrop: WrappedDrop | null;
  pets: WrappedDrop[];
  /** Their best performer, by the same order as `placeInTeam`. */
  mvp: string | null;
  /** Recap awards a member of this team took home. */
  awards: { emoji: string; title: string; winner: string }[];
}

/** The drops that make a story: pets first, then uniques, then the rest by value. */
const DROP_KINDS = new Set(['pet', 'unique', 'loot']);

function biggestDropOf(rows: WrappedMomentRow[]): WrappedDrop | null {
  let best: WrappedMomentRow | null = null;
  for (const r of rows) {
    if (!DROP_KINDS.has(r.kind) || r.kind === 'pet' || !r.itemName) continue;
    if (!best || (r.valueGp ?? 0) > (best.valueGp ?? 0)) best = r;
  }
  return best ? { itemId: best.itemId, itemName: best.itemName!, valueGp: best.valueGp } : null;
}

function petsOf(rows: WrappedMomentRow[]): WrappedDrop[] {
  return rows
    .filter((r) => r.kind === 'pet' && r.itemName)
    .map((r) => ({ itemId: r.itemId, itemName: r.itemName!, valueGp: null }));
}

/** Tiles finished, then boss kills, then XP: who carried the team, as the recap's MVP reads it. */
function contributionOrder(a: WrappedPersonStats, b: WrappedPersonStats): number {
  return b.tilesFinished - a.tilesFinished || b.kcGained - a.kcGained || b.xpGained - a.xpGained || a.name.localeCompare(b.name);
}

function luckFor(rows: WrappedLuckRow[], tone: WrappedLuckRow['tone']): WrappedLuck | null {
  const best = rows.filter((r) => r.tone === tone).sort((a, b) => a.tail - b.tail)[0];
  return best
    ? { itemId: best.itemId, itemName: best.itemName, headline: formatCount(best.obtained, best.expected, best.expectedLow) }
    : null;
}

/**
 * Every player's and every team's card for one event. People who did nothing at all — no time, no
 * gains, no tiles, no drops — get no card: an all-zero picture is a reason not to share it.
 */
export function shapeWrapped(input: {
  people: WrappedPersonStats[];
  awards: { emoji: string; title: string; winner: { name: string; teamName: string | null } }[];
  standings: WrappedStanding[];
  moments: WrappedMomentRow[];
  luck: WrappedLuckRow[];
}): { players: WrappedPlayer[]; teams: WrappedTeam[] } {
  const standings = [...input.standings].sort((a, b) => b.score - a.score);
  const teamRank = new Map(standings.map((s, i) => [s.teamId, i + 1]));
  const standingById = new Map(standings.map((s) => [s.teamId, s]));

  const keyByPlayer = new Map<number, string>();
  for (const p of input.people) for (const id of p.playerIds) keyByPlayer.set(id, p.personKey);
  const momentsByKey = new Map<string, WrappedMomentRow[]>();
  for (const m of input.moments) {
    const key = m.playerId != null ? keyByPlayer.get(m.playerId) : undefined;
    if (!key) continue;
    const list = momentsByKey.get(key) ?? [];
    list.push(m);
    momentsByKey.set(key, list);
  }
  const luckByKey = new Map<string, WrappedLuckRow[]>();
  for (const l of input.luck) {
    const key = keyByPlayer.get(l.playerId);
    if (!key) continue;
    const list = luckByKey.get(key) ?? [];
    list.push(l);
    luckByKey.set(key, list);
  }

  const byTeam = new Map<number, WrappedPersonStats[]>();
  for (const p of input.people) {
    if (p.teamId == null) continue;
    const list = byTeam.get(p.teamId) ?? [];
    list.push(p);
    byTeam.set(p.teamId, list);
  }
  for (const list of byTeam.values()) list.sort(contributionOrder);

  const players: WrappedPlayer[] = [];
  for (const p of input.people) {
    const mine = momentsByKey.get(p.personKey) ?? [];
    const standing = p.teamId != null ? standingById.get(p.teamId) : undefined;
    const mates = p.teamId != null ? byTeam.get(p.teamId) ?? [] : [];
    const player: WrappedPlayer = {
      personKey: p.personKey,
      playerIds: p.playerIds,
      name: p.name,
      team: standing
        ? { id: standing.teamId, name: standing.name, color: standing.color, rank: teamRank.get(standing.teamId)!, of: standings.length }
        : null,
      // A team of one is a person, so "1st of 1 on their team" says nothing.
      placeInTeam: mates.length > 1 ? { rank: mates.indexOf(p) + 1, of: mates.length } : null,
      minutesPlayed: p.minutesPlayed,
      xpGained: p.xpGained,
      kcGained: p.kcGained,
      deaths: p.deaths,
      biggestHit: p.biggestHit,
      tilesFinished: p.tilesFinished,
      topBoss: p.topBoss,
      topSkill: p.topSkill,
      biggestDrop: biggestDropOf(mine),
      pets: petsOf(mine),
      spooned: luckFor(luckByKey.get(p.personKey) ?? [], 'spooned'),
      dry: luckFor(luckByKey.get(p.personKey) ?? [], 'dry'),
      awards: p.awardsWon,
    };
    if (hasAnything(player)) players.push(player);
  }

  const teams: WrappedTeam[] = standings.map((s) => {
    const members = byTeam.get(s.teamId) ?? [];
    const rows = input.moments.filter((m) => m.teamId === s.teamId);
    const sum = (f: (p: WrappedPersonStats) => number) => members.reduce((n, p) => n + f(p), 0);
    return {
      id: s.teamId,
      name: s.name,
      color: s.color,
      rank: teamRank.get(s.teamId)!,
      of: standings.length,
      score: s.score,
      unit: s.unit,
      members: members.length,
      minutesPlayed: sum((p) => p.minutesPlayed),
      xpGained: sum((p) => p.xpGained),
      kcGained: sum((p) => p.kcGained),
      deaths: sum((p) => p.deaths),
      biggestDrop: biggestDropOf(rows),
      pets: petsOf(rows),
      mvp: members[0] && hasWork(members[0]) ? members[0].name : null,
      awards: input.awards
        .filter((a) => a.winner.teamName === s.name)
        .map((a) => ({ emoji: a.emoji, title: a.title, winner: a.winner.name })),
    };
  });

  return { players, teams };
}

function hasWork(p: WrappedPersonStats): boolean {
  return p.tilesFinished > 0 || p.kcGained > 0 || p.xpGained > 0;
}

function hasAnything(p: WrappedPlayer): boolean {
  return (
    p.minutesPlayed > 0 ||
    p.xpGained > 0 ||
    p.kcGained > 0 ||
    p.tilesFinished > 0 ||
    p.biggestDrop != null ||
    p.pets.length > 0 ||
    p.awards.length > 0
  );
}

/** "14h 20m", or plain minutes under an hour. */
export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Play time for a card's stat box, which fits ~5 characters: whole hours, or minutes under one. */
export function cardHours(minutes: number): string {
  return minutes >= 60 ? `${Math.round(minutes / 60)}h` : `${minutes}m`;
}

/** 1.2M, 340K, 950 — how players say numbers. */
export function shortNumber(n: number): string {
  if (n >= 1_000_000_000) return `${+(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString('en-US');
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** The four numbers a player's card leads with, in order of how much they say. Zeros are skipped. */
export function playerCardStats(p: WrappedPlayer): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (p.minutesPlayed > 0) out.push({ label: 'Played', value: cardHours(p.minutesPlayed) });
  if (p.kcGained > 0) out.push({ label: 'Boss kills', value: shortNumber(p.kcGained) });
  if (p.xpGained > 0) out.push({ label: 'XP gained', value: shortNumber(p.xpGained) });
  if (p.tilesFinished > 0) out.push({ label: 'Tiles', value: shortNumber(p.tilesFinished) });
  if (p.deaths > 0) out.push({ label: 'Deaths', value: shortNumber(p.deaths) });
  return out.slice(0, 4);
}

export function teamCardStats(t: WrappedTeam): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  out.push({ label: t.unit === 'tiles' ? 'Tiles' : 'Points', value: shortNumber(t.score) });
  if (t.minutesPlayed > 0) out.push({ label: 'Played', value: cardHours(t.minutesPlayed) });
  if (t.kcGained > 0) out.push({ label: 'Boss kills', value: shortNumber(t.kcGained) });
  if (t.xpGained > 0) out.push({ label: 'XP gained', value: shortNumber(t.xpGained) });
  if (t.deaths > 0) out.push({ label: 'Deaths', value: shortNumber(t.deaths) });
  return out.slice(0, 4);
}

/** "2nd of 6 on Team Blue", or "2nd of 6" for a solo entrant. */
export function playerCardLine(p: WrappedPlayer): string | null {
  if (p.placeInTeam && p.team) return `${ordinal(p.placeInTeam.rank)} of ${p.placeInTeam.of} on ${p.team.name}`;
  if (p.team && p.team.of > 1) return `${ordinal(p.team.rank)} of ${p.team.of}`;
  return null;
}

export function teamCardLine(t: WrappedTeam): string {
  const place = t.of > 1 ? `${ordinal(t.rank)} of ${t.of}` : null;
  const mvp = t.mvp ? `MVP ${t.mvp}` : null;
  return [place, `${t.members} player${t.members === 1 ? '' : 's'}`, mvp].filter(Boolean).join(' · ');
}

/** The picture worth showing: a pet beats any drop, because nobody needs a price to know a pet is a story. */
export function cardFeature(x: { pets: WrappedDrop[]; biggestDrop: WrappedDrop | null }): {
  itemId: number | null;
  kicker: string;
  name: string;
  detail: string | null;
} | null {
  const pet = x.pets[0];
  if (pet) {
    return {
      itemId: pet.itemId,
      kicker: x.pets.length > 1 ? `${x.pets.length} pets` : 'Pet',
      name: pet.itemName,
      detail: null,
    };
  }
  const d = x.biggestDrop;
  if (!d) return null;
  return {
    itemId: d.itemId,
    kicker: 'Biggest drop',
    name: d.itemName,
    detail: d.valueGp && d.valueGp > 0 ? `${shortNumber(d.valueGp)} gp` : null,
  };
}

/** One line of luck: the spoon if there is one (people share those), else the dry streak. */
export function luckLine(p: WrappedPlayer): string | null {
  if (p.spooned) return `Spooned: ${p.spooned.itemName}, ${p.spooned.headline}`;
  if (p.dry) return `Dry: ${p.dry.itemName}, ${p.dry.headline}`;
  return null;
}
