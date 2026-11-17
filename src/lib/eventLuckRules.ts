// Event luck, the pure half: kills gained since the whistle, and drops the plugin saw during the
// event, shaped for the same luck engine the clan boards use (lib/clogProfile buildLuckBoards).
//
// Lifetime luck reads the collection log against total kill counts. An event can't: the log keeps
// only current counts, so "what dropped this week" has to come from the drops the plugin reported
// as moments (lib/moments keeps every luck-counted drop during an event), and the kills from the
// participant's start-of-event snapshot against their current stats.
//
// No database here. lib/eventLuck loads the inputs.

import { computeGain } from '@/lib/statTracking';
import { parsePluginStats } from '@/lib/pluginStats';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import type { LuckCandidate } from '@/lib/clogLuckBoard';
import type { LuckEntry, LuckRateSource, LuckSource } from '@/lib/clogProfile';
import { expectationFor, pickBoard } from '@/lib/clogProfile';
import { assessLuckAt } from '@/lib/clogLuck';

export interface EventLuckParticipant {
  accountId: number;
  name: string;
  statsSnapshot: string | null;
  cachedStats: string | null;
  pluginStats: string | null;
  /** Set while benched: their gains are pinned to this. */
  frozenStats: string | null;
}

export interface EventDropRow {
  accountId: number;
  kind: string;
  itemId: number | null;
  source: string | null;
}

const parse = (json: string | null): HiscoresSnapshot | null => {
  if (!json) return null;
  try {
    return JSON.parse(json) as HiscoresSnapshot;
  } catch {
    return null;
  }
};

/**
 * Kills of each boss gained since the event started. Same rules as the board's own gain maths
 * (lib/statTracking computeGain): no starting snapshot means no gains, never a lifetime's worth.
 */
export function eventBossGains(p: EventLuckParticipant, bossKeys: string[]): Record<string, number> {
  const baseline = parse(p.statsSnapshot);
  if (!baseline) return {};
  const frozen = parse(p.frozenStats);
  const current = frozen ?? parse(p.cachedStats);
  const live = frozen ? {} : parsePluginStats(p.pluginStats);
  const out: Record<string, number> = {};
  for (const key of bossKeys) {
    const gain = computeGain(baseline, current, live, [key], 'boss');
    if (gain > 0) out[key] = gain;
  }
  return out;
}

const norm = (s: string) => s.split('#')[0].trim().toLowerCase().replace(/^the\s+/, '');

/**
 * How many of each luck item every account got during the event, from its moments.
 *
 * One row is one drop (a stack is still one roll). Pets need care: the plugin's pet line carries the
 * boss but no item, so it is matched to the pet that boss drops; and a first-ever pet ALSO arrives as
 * a collection-log unlock with the item id. The two are the same pet, so per (account, pet) the count
 * is whichever of the two routes saw more, never their sum.
 */
export function countEventDrops(
  rows: EventDropRow[],
  candidates: LuckCandidate[],
  petIds: ReadonlySet<number>,
): Map<number, Map<number, number>> {
  const counted = new Set(candidates.map((c) => c.itemId));
  const petBySource = new Map<string, number>();
  for (const c of candidates) {
    if (!petIds.has(c.itemId)) continue;
    for (const s of c.sources) petBySource.set(norm(s.source), c.itemId);
  }

  const items = new Map<string, number>();
  const petLines = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const r of rows) {
    if (r.kind === 'pet' && r.itemId == null) {
      const pet = r.source ? petBySource.get(norm(r.source)) : undefined;
      if (pet != null) bump(petLines, `${r.accountId}:${pet}`);
      continue;
    }
    if (r.itemId != null && counted.has(r.itemId)) bump(items, `${r.accountId}:${r.itemId}`);
  }
  for (const [k, n] of petLines) items.set(k, Math.max(items.get(k) ?? 0, n));

  const out = new Map<number, Map<number, number>>();
  for (const [k, n] of items) {
    const [account, item] = k.split(':').map(Number);
    const forAccount = out.get(account) ?? new Map<number, number>();
    forAccount.set(item, n);
    out.set(account, forAccount);
  }
  return out;
}

/**
 * Candidates shaped for buildLuckBoards, judged on THIS EVENT only: kills gained since the start
 * against drops seen since the start. Only `judged` accounts take part — someone whose plugin never
 * reported has no drops we could have seen, and would read as dry for our blindness.
 */
export function shapeEventLuck(
  candidates: LuckCandidate[],
  participants: { accountId: number; name: string; gains: Record<string, number> }[],
  drops: Map<number, Map<number, number>>,
  judged: ReadonlySet<number>,
) {
  const people = participants.filter((p) => judged.has(p.accountId));
  return candidates.map((c) => ({
    itemId: c.itemId,
    itemName: c.itemName,
    source: c.page,
    sources: c.sources,
    members: people.map((p): LuckSource => {
      const { expected, expectedLow, kills } = expectationFor(c.sources, p.gains);
      return {
        accountId: p.accountId,
        rsn: p.name,
        kills,
        expected,
        expectedLow,
        obtained: drops.get(p.accountId)?.get(c.itemId) ?? 0,
      };
    }),
  }));
}

/** "Going dry" needs at least this many drops owed with none seen: below it, having none is the usual result. */
export const GOING_DRY_MIN_EXPECTED = 1;
/** At most this many "going dry" rows, and only when nobody is dry outright. */
export const GOING_DRY_LIMIT = 3;

/**
 * The boards for ONE event. Lifetime boards (lib/clogProfile buildLuckBoards) want half a drop owed
 * before they say anything, which is right for a whole log and wrong here: a week's kills rarely
 * owe anyone half a rare drop, so the lucky drop of the event could never show.
 *
 *  - Spooned: at least one drop, and fewer than 1 in 20 would have that many on these kills. No floor.
 *  - Dry: the lifetime rule unchanged (under 5%, which already takes about three drops owed).
 *  - Going dry: only when nobody is dry. The people furthest along with none, at one drop owed or
 *    more, capped at GOING_DRY_LIMIT. Not a verdict: most of them are still inside ordinary luck.
 *
 * A team boss is judged as everywhere else: dry and going dry against the low end of its range.
 */
export function buildEventLuckBoards(
  candidates: { itemId: number; itemName: string; source: string; sources: LuckRateSource[]; members: LuckSource[] }[],
  limit = 10,
): { dry: LuckEntry[]; spooned: LuckEntry[]; goingDry: LuckEntry[] } {
  const dry: LuckEntry[] = [];
  const spooned: LuckEntry[] = [];
  const waiting: LuckEntry[] = [];

  for (const candidate of candidates) {
    for (const member of candidate.members) {
      if (member.kills <= 0 || member.expected <= 0) continue;
      const assessment = assessLuckAt(member.expected, member.kills, member.obtained, member.expectedLow);
      const entry: LuckEntry = {
        accountId: member.accountId,
        rsn: member.rsn,
        itemId: candidate.itemId,
        itemName: candidate.itemName,
        source: candidate.source,
        sources: candidate.sources,
        assessment,
      };
      if (assessment.verdict === 'dry') {
        if (assessment.notable) dry.push(entry);
      } else if (assessment.verdict === 'spooned') {
        if (assessment.obtained >= 1) spooned.push(entry);
      } else if (assessment.obtained === 0 && assessment.expectedLow >= GOING_DRY_MIN_EXPECTED) {
        waiting.push(entry);
      }
    }
  }

  const dryBoard = pickBoard(dry, limit);
  // With none obtained the tail IS the chance of having none, so pickBoard's order (smallest tail
  // first) is furthest along first.
  const goingDry = dryBoard.length === 0 ? pickBoard(waiting, GOING_DRY_LIMIT) : [];
  return { dry: dryBoard, spooned: pickBoard(spooned, limit), goingDry };
}
