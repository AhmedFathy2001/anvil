// The words a link preview uses, shared by the card (lib/ogCard via the /api/og routes) and the
// page's own description, so the picture and the line under the title never disagree.
//
// Pure: no `@/db`, so it can be imported anywhere, tests included.

import { accountTypeLabel } from '@/lib/accountType';
import { EFFICIENCY_SCALE, SKILLS } from '@/lib/constants';
import { parseStamp } from '@/lib/dbTime';
import { eventStage } from '@/lib/eventStage';

export type WeeklyKind = 'skill' | 'boss' | 'efficiency';

export const WEEKLY_KIND_LABEL: Record<WeeklyKind, string> = {
  skill: 'Skill of the Week',
  boss: 'Boss of the Week',
  efficiency: 'Efficiency week',
};

export function weeklyKind(type: string): WeeklyKind {
  return type === 'boss' || type === 'efficiency' ? type : 'skill';
}

/** One person's gain in the competition's own unit: "+4.82M xp", "212 kc", "+31.5h". */
export function weeklyGain(kind: WeeklyKind, gained: number): string {
  if (kind === 'boss') return `${gained.toLocaleString('en-US')} kc`;
  if (kind === 'efficiency') return `+${(gained / EFFICIENCY_SCALE).toFixed(1)}h`;
  return `+${compact(gained)} xp`;
}

/** The clan's combined gain: "1,284 kills", "58.9M xp", "412.0 hours". */
export function weeklyTotal(kind: WeeklyKind, total: number): string {
  if (kind === 'boss') return `${total.toLocaleString('en-US')} kills`;
  if (kind === 'efficiency') return `${(total / EFFICIENCY_SCALE).toFixed(1)} hours`;
  return `${compact(total)} xp`;
}

/** "1 team" / "4 teams". */
export function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}

// ── Numbers and time ────────────────────────────────────────────────────────────────────────────────────

/** 4,820,113 → "4.82M", 31,400 → "31.4K", 212 → "212". */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2)}M`;
  if (a >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString('en-US');
}

/** "2d 4h" / "5h 12m" / "40m" — how long until `iso`, or null once it has passed. */
export function timeLeft(iso: string | null | undefined, now = Date.now()): string | null {
  const end = parseStamp(iso);
  if (end == null) return null;
  const mins = Math.floor((end - now) / 60_000);
  if (mins <= 0) return null;
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Open right now: started, and not yet at its end (an open-ended board counts once it starts). */
export function isLiveWindow(start: string | null | undefined, end: string | null | undefined, now = Date.now()): boolean {
  const s = parseStamp(start);
  if (s == null || s > now) return false;
  const e = parseStamp(end);
  return e == null || e > now;
}

// ── Event ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The line under a board's title in Discord: where it stands right now.
 *
 *   "Live now · Iron Wolves lead with 420 pts · 4 teams · ends in 2d 4h"
 *   "Finished · Iron Wolves won with 420 pts · 4 teams"
 *   "Starts in 3d · 6 teams signed up"
 *
 * Only standings and timing, never the tiles: a board's tiles can be hidden until start, and a
 * description is as public as a card.
 */
export function eventLinkDescription(
  event: { startDate: string | null; endDate: string | null; forceEndedAt: string | null },
  standings: { name: string; score: number; unit: string }[],
  now = Date.now(),
): string {
  const stage = eventStage(event, now);
  const teams = standings.length ? plural(standings.length, 'team') : null;
  const leader = standings[0];
  const scored = !!leader && leader.score > 0;
  const tie = scored && standings[1]?.score === leader.score;
  const score = scored ? `${leader.score.toLocaleString('en-US')} ${leader.unit}` : '';

  if (stage === 'build') {
    const until = timeLeft(event.startDate, now);
    return [until ? `Starts in ${until}` : 'Coming up', teams ? `${teams} ready` : null].filter(Boolean).join(' · ');
  }
  if (stage === 'wrap') {
    return ['Finished', scored && !tie ? `${leader.name} won with ${score}` : null, teams].filter(Boolean).join(' · ');
  }
  const left = timeLeft(event.endDate, now);
  return [
    'Live now',
    scored ? (tie ? `tied at ${score}` : `${leader.name} lead with ${score}`) : 'no tiles claimed yet',
    teams,
    left ? `ends in ${left}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ── Skill / Boss of the Week ───────────────────────────────────────────────────────────────────

export const WEEKLY_VERB: Record<WeeklyKind, string> = { skill: 'training', boss: 'bossing', efficiency: 'playing' };

/**
 *   "Lynx Titan leads with +4.82M xp · 38 members training · 3d 2h left"
 *   "Finished · Lynx Titan won with 212 kc · 1,284 kills across 41 members"
 *   "Starts in 2d · 38 members signed up"
 *
 * `board` is the leaderboard already sorted, gainers only.
 */
export function weeklyLinkDescription(
  comp: { type: string; status: string; startDate: string; endDate: string },
  enrolled: number,
  board: { rsn: string; gained: number }[],
  now = Date.now(),
): string {
  const kind = weeklyKind(comp.type);
  const top = board[0];
  if (comp.status === 'upcoming') {
    const until = timeLeft(comp.startDate, now);
    return [until ? `Starts in ${until}` : 'Coming up', enrolled ? `${plural(enrolled, 'member')} signed up` : null]
      .filter(Boolean)
      .join(' · ');
  }
  if (comp.status === 'completed') {
    const total = board.reduce((s, e) => s + e.gained, 0);
    return [
      'Finished',
      top ? `${top.rsn} won with ${weeklyGain(kind, top.gained)}` : null,
      board.length ? `${weeklyTotal(kind, total)} across ${plural(board.length, 'member')}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const left = timeLeft(comp.endDate, now);
  return [
    top ? `${top.rsn} leads with ${weeklyGain(kind, top.gained)}` : 'Nobody on the board yet',
    `${plural(board.length || enrolled, 'member')} ${WEEKLY_VERB[kind]}`,
    left ? `${left} left` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ── Member ─────────────────────────────────────────────────────────────────────────────────────

const MAX_TOTAL_LEVEL = (SKILLS.length - 1) * 99;

/**
 *   "Ironman · Maxed · Captain of The AFK Spot · 2,277 total · 126 combat · 1,940 EHP · 3,112 EHB"
 *
 * The numbers the hiscores already publish, and the rank the clan's own roster shows.
 */
export function memberLinkDescription(
  p: {
    totalLevel: number;
    combatLevel: number | null;
    accountType: string | null;
    rank: string | null;
    isGuest: boolean;
    efficiency: { ehp: number; ehb: number } | null;
  },
  clanName: string,
): string {
  const type = accountTypeLabel(p.accountType);
  const role = p.isGuest ? `Guest of ${clanName}` : p.rank ? `${p.rank} of ${clanName}` : `Member of ${clanName}`;
  // No hiscores yet (a new seat, an account the sweep hasn't reached): say what the page holds.
  if (p.totalLevel <= 0) return `${role} · skills, bosses, efficient hours and competition history.`;
  return [
    type && type.toLowerCase() !== 'regular' ? type : null,
    p.totalLevel >= MAX_TOTAL_LEVEL ? 'Maxed' : null,
    role,
    p.totalLevel > 0 ? `${p.totalLevel.toLocaleString('en-US')} total` : null,
    p.combatLevel ? `${p.combatLevel} combat` : null,
    p.efficiency && p.efficiency.ehp > 0 ? `${Math.round(p.efficiency.ehp).toLocaleString('en-US')} EHP` : null,
    p.efficiency && p.efficiency.ehb > 0 ? `${Math.round(p.efficiency.ehb).toLocaleString('en-US')} EHB` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
