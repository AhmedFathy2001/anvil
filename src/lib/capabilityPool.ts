import { db } from '@/db';
import { clanRoster, eventParticipants, eventSignups } from '@/db/schema';
import { and, eq, inArray, isNull, isNotNull, notInArray } from 'drizzle-orm';
import { abilityTable } from '@/lib/capability';
import { activitySpecs } from '@/lib/capabilityData';
import { accountsByPerson, loadAccountEvidence } from '@/lib/capabilityDb';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Who the board is priced for: how many of the people who'll actually play can realistically do
// each activity. Best information first —
//   pool     the event's entrants (or approved sign-ups before anyone is placed)
//   clan     the clan's active members, when nobody has signed up yet
//   baseline nothing to go on (a new clan, a creator space): the curated difficulty floors stand in
// Returned as counts and shares only. Never a name: pricing is a board question, not a person one.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export type PricedFor = 'pool' | 'clan' | 'baseline';
/** Fewer accounts than this and shares are noise — fall through to the next source. */
const MIN_POPULATION = 5;
/** Large clans: a sample is plenty for "what share can do it". */
const MAX_POPULATION = 400;

export interface CapabilityShares {
  pricedFor: PricedFor;
  population: number;
  /** Boss key → people able (stats for it AND some experience of it) and their share. */
  shares: Map<string, { able: number; share: number }>;
}

async function poolAccountIds(eventId: number): Promise<number[]> {
  const placed = await db
    .select({ accountId: eventParticipants.accountId })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), isNotNull(eventParticipants.accountId)));
  const ids = placed.map((r) => r.accountId!).filter(Boolean);
  if (ids.length) return [...new Set(ids)];
  const signups = await db
    .select({ seat: eventSignups.clanMemberId })
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, eventId), notInArray(eventSignups.status, ['withdrawn', 'rejected'])));
  if (!signups.length) return [];
  const seats = await db
    .select({ accountId: clanRoster.accountId })
    .from(clanRoster)
    .where(inArray(clanRoster.id, signups.map((s) => s.seat)));
  return [...new Set(seats.map((s) => s.accountId))];
}

async function clanAccountIds(clanId: number): Promise<number[]> {
  const rows = await db
    .select({ accountId: clanRoster.accountId })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.kind, 'member'), isNull(clanRoster.leftAt)))
    .limit(MAX_POPULATION);
  return [...new Set(rows.map((r) => r.accountId))];
}

export async function capabilityShares(clanId: number, eventId: number, keys: Set<string>): Promise<CapabilityShares> {
  const empty: CapabilityShares = { pricedFor: 'baseline', population: 0, shares: new Map() };
  if (!keys.size) return empty;
  let pricedFor: PricedFor = 'pool';
  let ids = await poolAccountIds(eventId);
  if (ids.length < MIN_POPULATION) {
    pricedFor = 'clan';
    ids = await clanAccountIds(clanId);
  }
  if (ids.length < MIN_POPULATION) return empty;

  const evidence = await loadAccountEvidence(ids);
  const byPerson = accountsByPerson(evidence);
  const specs = activitySpecs().filter((s) => keys.has(s.key));
  const able = new Map<string, number>([...keys].map((k) => [k, 0]));
  let population = 0;
  for (const id of ids) {
    const acc = evidence.get(id);
    if (!acc || !Object.keys(acc.levels).length) continue; // no hiscores: says nothing either way
    population++;
    const table = abilityTable(acc, byPerson.get(acc.personKey) ?? [acc], specs, null);
    for (const [key, a] of table) if (a.means >= 0.5 && a.knowhow > 0) able.set(key, (able.get(key) ?? 0) + 1);
  }
  if (population < MIN_POPULATION) return empty;
  const shares = new Map([...able].map(([k, n]) => [k, { able: n, share: n / population }]));
  return { pricedFor, population, shares };
}
