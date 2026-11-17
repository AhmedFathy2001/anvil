// The database half of a competition's Discord posts (rules, maths and embeds in lib/competitionPosts):
// the switches as stored, the board as every post reads it, and the slot rows that make a daily
// recap or an "ending soon" go out at most once.
//
// WHO IS NAMED. Every board here is the one the results post uses (lib/weeklyFinish finalStandings):
// lib/weekly getEffectiveParticipants, so somebody who opted out of the competition or left the clan
// is in no recap either, and an item hunt counts only the drops its standings count.

import { and, asc, eq, like } from 'drizzle-orm';

import { db } from '@/db';
import { weeklyCompetitions, weeklyDayRanks, weeklyPostSlots } from '@/db/schema';
import { BEST_DROPS_IN_RESULTS, bestDropLine, rankBestDrops } from '@/lib/bestDrops';
import {
  CLAN_COMPETITION_POSTS_KEY,
  competitionPostsKey,
  daySlotData,
  halfwayEmbed,
  parseClanCompetitionPosts,
  parseCompetitionPostOverrides,
  parseDaySlotData,
  recapSlot,
  recapSlotDay,
  type BoardLine,
  type ClanCompetitionPosts,
  type CompetitionPostOverrides,
  type DaySlotData,
  type PostSubject,
} from '@/lib/competitionPosts';
import type { DiscordEmbed } from '@/lib/discordEmbeds';
import { stampMs } from '@/lib/eventDay';
import { huntKindWord, huntLine, huntStat, parseHunt } from '@/lib/itemHunt';
import { huntStandings } from '@/lib/itemHuntDb';
import { bestDropMoments } from '@/lib/momentsStore';
import { weeklyBoard } from '@/lib/rankMoves';
import { getSetting, setSetting } from '@/lib/settings';
import { weeklyRsnKey } from '@/lib/weeklyRsn';

type Comp = typeof weeklyCompetitions.$inferSelect;

// ── the switches ─────────────────────────────────────────────────────────────────────────────────

export async function loadClanCompetitionPosts(clanId: number): Promise<ClanCompetitionPosts> {
  return parseClanCompetitionPosts(await getSetting(clanId, CLAN_COMPETITION_POSTS_KEY).catch(() => null));
}

export async function saveClanCompetitionPosts(clanId: number, posts: unknown): Promise<ClanCompetitionPosts> {
  const clean = parseClanCompetitionPosts(posts);
  await setSetting(clanId, CLAN_COMPETITION_POSTS_KEY, Object.keys(clean).length ? JSON.stringify(clean) : null);
  return clean;
}

/** One competition's own choices. Stored with the HOST clan's settings, like its repeat (lib/weeklyRepeat). */
export async function loadCompetitionPostOverrides(comp: Pick<Comp, 'id' | 'clanId'>): Promise<CompetitionPostOverrides> {
  return parseCompetitionPostOverrides(await getSetting(comp.clanId, competitionPostsKey(comp.id)).catch(() => null));
}

export async function saveCompetitionPostOverrides(comp: Pick<Comp, 'id' | 'clanId'>, overrides: unknown): Promise<CompetitionPostOverrides> {
  const clean = parseCompetitionPostOverrides(overrides);
  await setSetting(comp.clanId, competitionPostsKey(comp.id), Object.keys(clean).length ? JSON.stringify(clean) : null);
  return clean;
}

// ── the board ────────────────────────────────────────────────────────────────────────────────────

export function postSubject(comp: Comp): PostSubject {
  const config = comp.type === 'hunt' ? parseHunt(comp.hunt) : null;
  const stat = huntStat(config);
  return {
    type: comp.type,
    title: comp.title,
    endDate: comp.endDate,
    hunt:
      comp.type === 'hunt'
        ? { kind: huntKindWord(config), line: huntLine(config, comp.metric), rule: config?.rule ?? 'first', tracks: stat ? (stat.type === 'boss' ? 'kills' : 'XP') : null }
        : null,
  };
}

export interface PostBoard {
  board: BoardLine[];
  /** Item hunt: its counted drops, oldest first, as lines with the time each landed. Null on every other kind. */
  huntDrops: { atMs: number | null; line: string }[] | null;
}

/** The competition's board, best first, in the shape the posts read. */
export async function loadPostBoard(comp: Comp): Promise<PostBoard> {
  if (comp.type !== 'hunt') {
    return { board: (await weeklyBoard(comp.id)).map((e) => ({ rsn: e.rsn, gained: e.gained })), huntDrops: null };
  }
  const hunt = await huntStandings(comp);
  if (!hunt) return { board: [], huntDrops: [] };
  const nameOf = new Map(hunt.rows.map((r) => [weeklyRsnKey(r.rsn), r.rsn]));
  return {
    board: hunt.rows.map((r) => ({ rsn: r.rsn, gained: r.count, kills: r.statGain })),
    huntDrops: hunt.drops.map((d) => ({
      atMs: stampMs(d.occurredAt),
      line: `**${nameOf.get(weeklyRsnKey(d.rsnKey)) ?? d.rsnKey}** · ${d.itemName}${d.quantity > 1 ? ` ×${d.quantity.toLocaleString('en-US')}` : ''}${d.kc ? ` (at ${d.kc.toLocaleString('en-US')} kc)` : ''}`,
    })),
  };
}

/**
 * The best drops inside a window (the whole competition without one), from people still on the
 * board, one line each: the results post's own rule (lib/competitionTeamsPosts resultsBestDrops).
 * A hunt has none: its standings are its drops.
 */
export async function bestDropLines(comp: Comp, board: readonly BoardLine[], fromMs?: number, toMs?: number): Promise<string[]> {
  if (comp.type === 'hunt') return [];
  const onBoard = new Set(board.map((l) => weeklyRsnKey(l.rsn)));
  const rows = (await bestDropMoments(comp.id)).filter((m) => {
    if (!onBoard.has(weeklyRsnKey(m.rsn))) return false;
    if (fromMs == null && toMs == null) return true;
    const at = stampMs(m.occurredAt);
    return at != null && (fromMs == null || at >= fromMs) && (toMs == null || at < toMs);
  });
  return rankBestDrops(rows).slice(0, BEST_DROPS_IN_RESULTS).map(bestDropLine);
}

/** Everybody's place as each day so far began (weekly_day_ranks, lib/rankMoves), oldest first. */
async function dayRankHistory(competitionId: number): Promise<Record<string, number>[]> {
  const rows = await db
    .select({ ranks: weeklyDayRanks.ranks })
    .from(weeklyDayRanks)
    .where(eq(weeklyDayRanks.competitionId, competitionId))
    .orderBy(asc(weeklyDayRanks.day));
  return rows.flatMap((r) => {
    try {
      const v = JSON.parse(r.ranks) as Record<string, number>;
      return v && typeof v === 'object' ? [v] : [];
    } catch {
      return [];
    }
  });
}

/** The halfway report for a competition, or null when there is nothing to report. */
export async function halfwayReport(comp: Comp, nowMs: number): Promise<DiscordEmbed | null> {
  const startMs = stampMs(comp.startDate);
  const endMs = stampMs(comp.endDate);
  if (startMs == null || endMs == null) return null;
  const { board } = await loadPostBoard(comp);
  const [history, bestDrops] = await Promise.all([dayRankHistory(comp.id), bestDropLines(comp, board).catch(() => [] as string[])]);
  return halfwayEmbed({ subject: postSubject(comp), board, history, startMs, endMs, nowMs, bestDrops });
}

// ── the slots ────────────────────────────────────────────────────────────────────────────────────

export async function slotTaken(competitionId: number, slot: string): Promise<boolean> {
  const rows = await db
    .select({ id: weeklyPostSlots.id })
    .from(weeklyPostSlots)
    .where(and(eq(weeklyPostSlots.competitionId, competitionId), eq(weeklyPostSlots.slot, slot)))
    .limit(1);
  return rows.length > 0;
}

/**
 * TAKE a slot. True for exactly one caller: the unique (competition, slot) index turns every other
 * insert into a no-op, so two overlapping ticks cannot both post.
 */
export async function claimSlot(competitionId: number, slot: string, nowMs: number, data: DaySlotData | null = null): Promise<boolean> {
  const claimed = await db
    .insert(weeklyPostSlots)
    .values({ competitionId, slot, takenAt: new Date(nowMs).toISOString(), data: data ? JSON.stringify(data) : null })
    .onConflictDoNothing()
    .returning({ id: weeklyPostSlots.id });
  return claimed.length > 0;
}

/** The latest daily slot before `day`: what the next recap measures its movement from. */
export async function lastRecapBefore(competitionId: number, day: number): Promise<{ day: number; data: DaySlotData | null } | null> {
  const rows = await db
    .select({ slot: weeklyPostSlots.slot, data: weeklyPostSlots.data })
    .from(weeklyPostSlots)
    .where(and(eq(weeklyPostSlots.competitionId, competitionId), like(weeklyPostSlots.slot, 'day:%')));
  let best: { day: number; data: DaySlotData | null } | null = null;
  for (const r of rows) {
    const d = recapSlotDay(r.slot);
    if (d == null || d >= day) continue;
    if (!best || d > best.day) best = { day: d, data: parseDaySlotData(r.data) };
  }
  return best;
}

export { daySlotData, recapSlot };
