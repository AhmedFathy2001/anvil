// The stored half of lib/modeLines: staff patterns and the review queue of lines no pattern knew.

import { asc, desc, sql } from 'drizzle-orm';

import { db } from '@/db';
import { modeLinePatterns, modeLineSamples } from '@/db/schema';
import { log } from '@/lib/logger';
import { MODE_LINE_KINDS, lineTemplate, type ModeLineKind, type ModeLinePattern } from '@/lib/modeLines';

/** Rows kept per mode. Past this a new template is dropped; the ones already queued keep counting. */
export const MAX_SAMPLES_PER_MODE = 1000;
/**
 * Rows kept across every mode. The mode comes off the client's world headers, and a tampered client
 * can name a new "mode" with every request; the per-mode cap alone wouldn't bound that.
 */
export const MAX_SAMPLES_TOTAL = 5000;

export type StoredPattern = typeof modeLinePatterns.$inferSelect;

export async function listPatterns(): Promise<StoredPattern[]> {
  return db.select().from(modeLinePatterns).orderBy(asc(modeLinePatterns.id));
}

export function toPattern(row: StoredPattern): ModeLinePattern | null {
  if (!MODE_LINE_KINDS.includes(row.kind as ModeLineKind)) return null;
  return { id: `custom:${row.id}`, modeKey: row.modeKey, kind: row.kind as ModeLineKind, regex: row.regex, title: row.title };
}

// Every mode-lines request reads these, and staff edit them a few times a league.
let cache: { at: number; patterns: ModeLinePattern[] } | null = null;
const CACHE_MS = 60_000;

export async function customPatterns(): Promise<ModeLinePattern[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.patterns;
  const patterns = (await listPatterns()).map(toPattern).filter((p): p is ModeLinePattern => p !== null);
  cache = { at: Date.now(), patterns };
  return patterns;
}

export function forgetPatternCache(): void {
  cache = null;
}

/**
 * Count one line on the review queue. Best effort: the queue is for staff, and a failure here must
 * never cost the post.
 */
export async function recordSample(modeKey: string, line: string, autoPosted: boolean): Promise<void> {
  const template = lineTemplate(line);
  try {
    // Insert only while the mode is under its cap; an existing template keeps counting either way.
    const bumped = await db
      .update(modeLineSamples)
      .set({
        count: sql`${modeLineSamples.count} + 1`,
        sample: line,
        lastSeen: new Date().toISOString(),
        ...(autoPosted ? { autoPosted: true } : {}),
      })
      .where(sql`${modeLineSamples.modeKey} = ${modeKey} and ${modeLineSamples.template} = ${template}`)
      .returning({ id: modeLineSamples.id });
    if (bumped.length > 0) return;
    const [{ n, total }] = await db
      .select({
        n: sql<number>`count(*) filter (where ${modeLineSamples.modeKey} = ${modeKey})::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(modeLineSamples);
    if (n >= MAX_SAMPLES_PER_MODE || total >= MAX_SAMPLES_TOTAL) return;
    await db
      .insert(modeLineSamples)
      .values({ modeKey, template, sample: line, autoPosted })
      .onConflictDoUpdate({
        target: [modeLineSamples.modeKey, modeLineSamples.template],
        set: { count: sql`${modeLineSamples.count} + 1`, sample: line, lastSeen: new Date().toISOString() },
      });
  } catch (err) {
    log.info('mode-lines.sample-write-failed', { modeKey, err: String(err) });
  }
}

export async function listSamples(limit = 300) {
  return db
    .select()
    .from(modeLineSamples)
    .orderBy(desc(modeLineSamples.count), desc(modeLineSamples.lastSeen))
    .limit(limit);
}
