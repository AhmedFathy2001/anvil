// A player card for a name Anvil has never heard of, straight off the OSRS hiscores.
//
// The plugin's Lookup tab used to dead-end on anyone without an Anvil account — which is most of the
// game. This looks them up on demand, caches the answer (lib/publicHiscoresPolicy has the TTLs), and
// shapes it with the same code as a tracked account's card, minus everything only tracking produces:
// no clan, no collection log, no recent drops, no milestones, no personal bests.
//
// It is the ONE place a public request makes us call Jagex, so it is fenced three ways: the route caps
// each IP, a single global budget caps us (two lookups a second across the whole app, shared with
// nothing else), and the cache means a popular name costs one request per half hour however many
// people look it up.
//
// PRIVACY: a name that IS on Anvil never comes through here. apexCharacter answers for those, and an
// unshared account must stay indistinguishable from a missing one — falling back to the hiscores for
// it would hand back a card where everyone else gets a 404, which is exactly the "this exists but you
// may not see it" signal that rule withholds. So the first thing this does is look for an accounts row,
// and if there is one, it answers 'hidden' without touching the hiscores or the cache.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, publicHiscoresCache } from '@/db/schema';
import { isPlausibleRsn, normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { fetchSnapshotWithRetry, type HiscoresSnapshot, type SnapshotFetch } from '@/lib/hiscores';
import { profileFromSnapshot } from '@/lib/memberProfile';
import { shapePlayerCard, type PlayerCard } from '@/lib/playerCardShape';
import { isPublicHiscoresFresh, type PublicHiscoresOutcome } from '@/lib/publicHiscoresPolicy';
import { rateLimitByKey } from '@/lib/rate-limit';

export type PublicHiscoresCardResult =
  | { kind: 'card'; card: PlayerCard }
  /** Not on the hiscores (or not a name the hiscores would accept). The route's ordinary 404. */
  | { kind: 'unranked' }
  /** An Anvil account holds this name. Never fall back: see PRIVACY above. */
  | { kind: 'hidden' }
  /** No usable cache and we may not (budget) or could not (Jagex blip) fetch right now. */
  | { kind: 'busy'; retryAfterSec: number };

export interface PublicHiscoresDeps {
  /** The hiscores read. Injectable so tests never call Jagex. */
  fetch?: (rsn: string) => Promise<SnapshotFetch>;
  /** Take one unit of the global lookup budget; false = over budget. */
  acquire?: () => Promise<boolean>;
  now?: () => number;
}

/** Two lookups a second across the whole app — well under what the sweep itself spends. */
const GLOBAL_BUDGET = { limit: 2, windowMs: 1000 };

async function acquireGlobal(): Promise<boolean> {
  return (await rateLimitByKey('hiscores-ondemand', 'global', GLOBAL_BUDGET)).ok;
}

// Two people opening the same stranger at once should cost one fetch, not two. Per process only, which
// is all it needs to be: the cache covers everything after the first answer lands.
const inflight = new Map<string, Promise<PublicHiscoresCardResult>>();

export async function publicHiscoresCard(rsn: string, deps: PublicHiscoresDeps = {}): Promise<PublicHiscoresCardResult> {
  const clean = sanitizeRsn(rsn);
  const key = normalizeRsn(clean);
  if (!key || !isPlausibleRsn(clean)) return { kind: 'unranked' };

  // clan-scope: global -- accounts are global, and this asks only whether ANY account holds the name.
  const acct = await db.query.accounts.findFirst({ where: eq(accounts.rsnNormalized, key), columns: { id: true } });
  if (acct) return { kind: 'hidden' };

  const pending = inflight.get(key);
  if (pending) return pending;
  const run = lookup(clean, key, deps).finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

async function lookup(rsn: string, key: string, deps: PublicHiscoresDeps): Promise<PublicHiscoresCardResult> {
  const now = (deps.now ?? Date.now)();
  const cached = await db.query.publicHiscoresCache.findFirst({ where: eq(publicHiscoresCache.rsnKey, key) });
  if (cached && isPublicHiscoresFresh(cached.outcome, cached.fetchedAt, now)) return fromCache(cached);

  // Expired or missing. A stale row is still the better answer than "busy" when we cannot refresh it,
  // so it is kept in hand for both failure paths below.
  const stale = cached ? fromCache(cached) : null;
  if (!(await (deps.acquire ?? acquireGlobal)())) return stale ?? { kind: 'busy', retryAfterSec: 2 };

  const res = await (deps.fetch ?? fetchSnapshotWithRetry)(rsn);
  // A blip is not an answer: nothing is written, so the next lookup tries again.
  if (res.kind === 'transient') return stale ?? { kind: 'busy', retryAfterSec: 30 };

  const fetchedAt = new Date(now).toISOString();
  const outcome: PublicHiscoresOutcome = res.kind;
  const body = res.kind === 'value' ? JSON.stringify(res.snapshot) : null;
  await db
    .insert(publicHiscoresCache)
    .values({ rsnKey: key, rsn, outcome, body, fetchedAt })
    .onConflictDoUpdate({ target: publicHiscoresCache.rsnKey, set: { rsn, outcome, body, fetchedAt } });

  return res.kind === 'value' ? { kind: 'card', card: hiscoresCard(rsn, res.snapshot, fetchedAt) } : { kind: 'unranked' };
}

function fromCache(row: typeof publicHiscoresCache.$inferSelect): PublicHiscoresCardResult {
  if (row.outcome !== 'value' || !row.body) return { kind: 'unranked' };
  try {
    return { kind: 'card', card: hiscoresCard(row.rsn, JSON.parse(row.body) as HiscoresSnapshot, row.fetchedAt) };
  } catch {
    return { kind: 'unranked' };
  }
}

/** The card a tracked account gets, from the snapshot alone; everything only tracking knows is empty. */
export function hiscoresCard(rsn: string, snapshot: HiscoresSnapshot, fetchedAt: string): PlayerCard {
  const profile = profileFromSnapshot(snapshot);
  const overallXp = snapshot.skills?.overall?.xp;
  return {
    ...shapePlayerCard({
      rsn,
      accountType: null,
      clan: null,
      totalLevel: profile.totalLevel,
      combatLevel: profile.combatLevel,
      overallXp: overallXp != null && overallXp > 0 ? overallXp : null,
      ehp: profile.efficiency?.ehp ?? null,
      ehb: profile.efficiency?.ehb ?? null,
      statsAt: fetchedAt,
      bosses: profile.bosses.map((b) => ({ key: b.key, kc: b.kc })),
      skills: profile.skills.map((sk) => ({ key: sk.key, level: sk.level, xp: sk.xp })),
      activities: profile.activities.map((a) => ({
        key: a.key,
        label: a.label,
        shortLabel: a.shortLabel,
        group: a.group,
        score: a.score,
      })),
      clogHeader: null,
      clogPages: [],
      recentItems: [],
      milestones: [],
      bests: [],
    }),
    source: 'hiscores',
    fetchedAt,
  };
}
