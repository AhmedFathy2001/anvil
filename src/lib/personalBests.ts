import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { memberPersonalBests } from '@/db/schema';

/** 24 hours in centiseconds. Longer than any real clear, short enough to reject a parse that went wrong. */
export const MAX_CENTIS = 24 * 60 * 60 * 100;
export const MAX_BESTS_PER_PUSH = 200;
/** Raids cap out well below this; the ceiling exists to reject nonsense, not to model the game. */
export const MAX_TEAM_SIZE = 100;

export interface IncomingBest {
  activity?: unknown;
  centis?: unknown;
  teamSize?: unknown;
}

export interface CleanBest {
  activity: string;
  teamSize: number;
  centis: number;
}

/**
 * Validate and de-duplicate a pushed set of bests.
 *
 * One push can legitimately carry the same activity twice (an alt's import merged with live
 * capture), so the fastest wins before anything reaches the database. Anything unparseable,
 * non-positive, or beyond the ceilings is dropped rather than rejecting the whole push — a single
 * bad line in a whole-profile import shouldn't lose the rest.
 */
export function normalizeBests(raw: IncomingBest[]): CleanBest[] {
  const best = new Map<string, CleanBest>();

  for (const item of raw) {
    const activity =
      typeof item?.activity === 'string' ? item.activity.trim().toLowerCase().slice(0, 80) : '';
    if (!activity) continue;
    const centis =
      typeof item?.centis === 'number' && Number.isFinite(item.centis) && item.centis > 0 && item.centis <= MAX_CENTIS
        ? Math.floor(item.centis)
        : null;
    if (centis == null) continue;
    // 0 means "this activity has no team sizes" — see the schema note on why it isn't null.
    const teamSize =
      typeof item?.teamSize === 'number' && Number.isFinite(item.teamSize) && item.teamSize > 0 && item.teamSize <= MAX_TEAM_SIZE
        ? Math.floor(item.teamSize)
        : 0;

    // \u0000 as the separator, written as an escape: a literal NUL in the source makes git treat
    // this file as binary — no diffs, no blame — and it's invisible in an editor.
    const key = `${activity}\u0000${teamSize}`;
    const existing = best.get(key);
    if (!existing || centis < existing.centis) best.set(key, { activity, teamSize, centis });
  }

  return [...best.values()];
}

/**
 * Store a member's personal bests, keeping the FASTEST of stored and pushed — never the latest.
 *
 * That single rule makes the ingest idempotent and order-independent: a retry, a stale client, or
 * two clients of the same account pushing out of order can't raise somebody's record. It is also
 * why the plugin can send its whole set on a whim without either side reasoning about what was
 * already stored.
 *
 * One statement, and the conflict clause is where the rule actually lives — doing it as
 * read-then-write would race two clients of the same account against each other.
 *
 * Lives here rather than inline in the route so there is ONE definition of the rule to port between
 * SQL dialects and one for tests to exercise. The scalar `min(a, b)` below is SQLite-specific and
 * becomes `LEAST(a, b)` on Postgres; a test that reimplemented this expression instead of calling
 * it would keep passing while the real path broke.
 */
export async function savePersonalBests(clanMemberId: number, bests: CleanBest[], nowIso: string): Promise<number> {
  if (bests.length === 0) return 0;

  const values = bests.map((b) => ({
    clanMemberId,
    activity: b.activity,
    teamSize: b.teamSize,
    centis: b.centis,
    achievedAt: nowIso,
    updatedAt: nowIso,
  }));

  await db
    .insert(memberPersonalBests)
    .values(values)
    .onConflictDoUpdate({
      target: [memberPersonalBests.clanMemberId, memberPersonalBests.activity, memberPersonalBests.teamSize],
      set: {
        centis: sql`min(${memberPersonalBests.centis}, excluded.centis)`,
        // Only stamp the date when this push actually improved the record; otherwise a re-import
        // would redate every best a player has ever set to today.
        achievedAt: sql`case when excluded.centis < ${memberPersonalBests.centis} then excluded.achieved_at else ${memberPersonalBests.achievedAt} end`,
        updatedAt: nowIso,
      },
    });

  return values.length;
}
