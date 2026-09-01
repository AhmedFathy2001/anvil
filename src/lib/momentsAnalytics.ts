import { MOMENT_EMOJI, caTierRank } from '@/lib/moments';
import type { MomentRow } from '@/lib/momentsStore';

/**
 * The event's highlight feed, counted.
 *
 * A feed answers "what happened"; by the end of a week nobody scrolls back through four hundred
 * lines of it. This answers the questions people actually ask afterwards — who died most, what
 * killed us, what was the best thing anyone got — out of rows that already exist, so it costs a
 * read and no new plugin work.
 *
 * Pure and dependency-light (the rows come in, nothing is fetched) so tests/moments-analytics
 * can run it directly. Nothing here scores: moments are client-reported, and this is a summary of
 * a feed, not a standing.
 */

export interface MemberTally {
  rsn: string;
  pets: number;
  uniques: number;
  deaths: number;
  loot: number;
  ca: number;
  levels: number;
  total: number;
  /** Value of the hauls this person's 'loot'/'unique' lines carried, as the client priced them. */
  lootGp: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface Standout {
  rsn: string;
  itemName: string | null;
  source: string | null;
  /** GP for a haul, 1-in-N for a rare, the tier for a combat task. Formatting is the caller's job. */
  valueGp: number | null;
  rarityDenominator: number | null;
  tier: string | null;
  occurredAt: string;
}

export interface MomentsSummary {
  counts: { pet: number; unique: number; death: number; loot: number; ca: number; level: number; total: number };
  /** Everyone who appeared in the feed, biggest contributor first. */
  members: MemberTally[];
  /** Most deaths first — the counter people ask for by name. Only people who actually died. */
  deathBoard: MemberTally[];
  /** What did the killing, most prolific first. */
  killers: NamedCount[];
  /** Where the loot came from, by number of notable lines. */
  sources: NamedCount[];
  /** The single most valuable thing anyone saw. */
  biggestHaul: Standout | null;
  /** The rarest single drop, by the drop table's own 1-in-N. */
  rarestDrop: Standout | null;
  /** The hardest combat task anyone completed. */
  hardestTask: Standout | null;
  /** Total value across every priced line in the feed. */
  gpSeen: number;
}

const EMPTY_COUNTS = { pet: 0, unique: 0, death: 0, loot: 0, ca: 0, level: 0, total: 0 };

function blank(rsn: string): MemberTally {
  return { rsn, pets: 0, uniques: 0, deaths: 0, loot: 0, ca: 0, levels: 0, total: 0, lootGp: 0 };
}

/** Rank a list of {name,count}, biggest first, ties broken by name so the order never wobbles. */
function ranked(map: Map<string, number>, limit: number): NamedCount[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** One side of a team event, summarised on its own. */
export interface TeamMoments {
  teamId: number;
  summary: MomentsSummary;
}

/**
 * Split a board's feed by the side each moment happened on, biggest feed first.
 *
 * The rows carry the team they were stamped with at ingest, so this is a grouping rather than a
 * guess — which is the difference between "our side died more" and "the people currently on our
 * side have died more, wherever they were at the time". Moments with no side (an event that never
 * had teams) are left out: a comparison of one is not a comparison.
 */
export function momentsByTeam(rows: MomentRow[], limit = 8): TeamMoments[] {
  const byTeam = new Map<number, MomentRow[]>();
  for (const row of rows) {
    if (row.teamId == null) continue;
    const list = byTeam.get(row.teamId) ?? [];
    list.push(row);
    byTeam.set(row.teamId, list);
  }
  return [...byTeam.entries()]
    .map(([teamId, list]) => ({ teamId, summary: summariseMoments(list, limit) }))
    .sort((a, b) => b.summary.counts.total - a.summary.counts.total || a.teamId - b.teamId);
}

export function summariseMoments(rows: MomentRow[], limit = 8): MomentsSummary {
  const counts = { ...EMPTY_COUNTS };
  const byMember = new Map<string, MemberTally>();
  const killers = new Map<string, number>();
  const sources = new Map<string, number>();
  let biggestHaul: Standout | null = null;
  let rarestDrop: Standout | null = null;
  let hardestTask: Standout | null = null;
  let gpSeen = 0;

  for (const row of rows) {
    const tally = byMember.get(row.rsn) ?? blank(row.rsn);
    byMember.set(row.rsn, tally);
    tally.total += 1;
    counts.total += 1;

    const standout: Standout = {
      rsn: row.rsn,
      itemName: row.itemName,
      source: row.source,
      valueGp: row.valueGp,
      rarityDenominator: row.rarityDenominator,
      tier: row.tier,
      occurredAt: row.occurredAt,
    };

    switch (row.kind) {
      case 'pet':
        tally.pets += 1;
        counts.pet += 1;
        break;
      case 'death':
        tally.deaths += 1;
        counts.death += 1;
        // A death with no killer is still a death — it just can't say what did it.
        if (row.source) killers.set(row.source, (killers.get(row.source) ?? 0) + 1);
        break;
      case 'ca':
        tally.ca += 1;
        counts.ca += 1;
        if (!hardestTask || caTierRank(row.tier) > caTierRank(hardestTask.tier)) hardestTask = standout;
        break;
      // Named explicitly, because the arm below treats whatever it doesn't recognise as a drop —
      // which would have filed a 99 as a haul worth zero gp and let it into the loot rankings.
      case 'level':
        tally.levels += 1;
        counts.level += 1;
        break;
      default: {
        // 'unique' and 'loot' are both drops; they differ in why they were kept.
        if (row.kind === 'unique') {
          tally.uniques += 1;
          counts.unique += 1;
        } else {
          tally.loot += 1;
          counts.loot += 1;
        }
        if (row.source) sources.set(row.source, (sources.get(row.source) ?? 0) + 1);
        const value = row.valueGp ?? 0;
        if (value > 0) {
          tally.lootGp += value;
          gpSeen += value;
          if (!biggestHaul || value > (biggestHaul.valueGp ?? 0)) biggestHaul = standout;
        }
        // Rarest = the BIGGEST 1-in-N we managed to price: 1-in-5,000 beats 1-in-100.
        const rate = row.rarityDenominator ?? 0;
        if (rate > 0 && (!rarestDrop || rate > (rarestDrop.rarityDenominator ?? 0))) rarestDrop = standout;
        break;
      }
    }
  }

  const members = [...byMember.values()].sort(
    (a, b) => b.total - a.total || b.lootGp - a.lootGp || a.rsn.localeCompare(b.rsn),
  );

  return {
    counts,
    members,
    deathBoard: members
      .filter((m) => m.deaths > 0)
      .sort((a, b) => b.deaths - a.deaths || a.rsn.localeCompare(b.rsn))
      .slice(0, limit),
    killers: ranked(killers, limit),
    sources: ranked(sources, limit),
    biggestHaul,
    rarestDrop,
    hardestTask,
    gpSeen,
  };
}

/** The emoji a kind is drawn with, so a summary tile matches the feed line it counts. */
export function kindEmoji(kind: string): string {
  return MOMENT_EMOJI[kind] ?? '⭐';
}
