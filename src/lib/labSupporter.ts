// The Supporter test bench in /staff/lab: try every tier and the drops feed without paying or
// waiting for a pet.
//
// Two things, both fenced off from real data:
//   - YOUR TIER: a lab grant is an ordinary supporter_subscriptions row marked recurrence 'lab', with
//     no Gumroad ids (so no webhook can ever touch it) and a 24-hour end, so a forgotten one lapses.
//     Setting a new one replaces the old; real paid rows are never touched.
//   - TEST CLANMATES: four dummy people (one per tier, one free) with member seats in the hidden lab
//     clan, and drops on those seats. Their names carry a "~", which no game name can, so they can
//     never be a real character's, and they are found by their login's marker, never by name. Staff can open the lab clan in the plugin's Lookup.

import { and, eq, inArray, like, lt } from 'drizzle-orm';
import crypto from 'crypto';

import { db } from '@/db';
import { accounts, clanMemberships, moments, supporterSubscriptions, users } from '@/db/schema';
import { ensureLabClan, labClanId } from '@/lib/lab';
import { ensureTestUser } from '@/lib/labCast';
import { LAB_DUMMY_LOGIN, LAB_KEEP_DAYS } from '@/lib/labRules';
import { supporterForUser } from '@/lib/supporter';
import { SUPPORTER_TIER_ORDER, type SupporterTierId } from '@/lib/supporterTiers';

export const LAB_RECURRENCE = 'lab';
const LAB_GRANT_HOURS = 24;

const iso = (ms: number) => new Date(ms).toISOString();

/** Give yourself a test tier (null = none), as if you had supported for `months`. */
export async function setLabTier(userId: number, tier: SupporterTierId | null, months = 0): Promise<void> {
  await db
    .delete(supporterSubscriptions)
    .where(and(eq(supporterSubscriptions.userId, userId), eq(supporterSubscriptions.recurrence, LAB_RECURRENCE)));
  if (!tier) return;
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - Math.max(0, Math.min(36, Math.round(months))));
  await db.insert(supporterSubscriptions).values({
    userId,
    tier,
    // 'cancelling' is the status whose end date is enforced (lib/supporterTiers rowInForce); an
    // 'active' row would run until a Gumroad notification ended it, which a lab grant never gets.
    status: 'cancelling',
    recurrence: LAB_RECURRENCE,
    currentPeriodEnd: iso(Date.now() + LAB_GRANT_HOURS * 3_600_000),
    startedAt: start.toISOString(),
    tenureStartedAt: start.toISOString(),
  });
}

export interface LabSupporterState {
  /** The lab grant in force, if any. */
  lab: { tier: SupporterTierId; endsAt: string | null; startedAt: string } | null;
  /** What everyone actually sees (a real paid tier outranks a lower lab one). */
  effective: SupporterTierId | null;
  dummies: { rsn: string; tier: SupporterTierId | null }[];
  drops: number;
}

export async function labSupporterState(userId: number): Promise<LabSupporterState> {
  const [row] = await db
    .select({ tier: supporterSubscriptions.tier, endsAt: supporterSubscriptions.currentPeriodEnd, startedAt: supporterSubscriptions.startedAt })
    .from(supporterSubscriptions)
    .where(and(eq(supporterSubscriptions.userId, userId), eq(supporterSubscriptions.recurrence, LAB_RECURRENCE)))
    .limit(1);
  const live = row && (!row.endsAt || Date.parse(row.endsAt) > Date.now());
  const effective = (await supporterForUser(userId))?.tier.id ?? null;
  const clanId = await labClanId();
  const seats = clanId == null ? [] : await dummySeats(clanId);
  const drops = seats.length
    ? (await db.select({ id: moments.id }).from(moments).where(inArray(moments.clanMemberId, seats.map((s) => s.seatId)))).length
    : 0;
  return {
    lab: live ? { tier: row.tier as SupporterTierId, endsAt: row.endsAt, startedAt: row.startedAt } : null,
    effective,
    dummies: DUMMIES.filter((d) => seats.some((s) => s.rsn === d.rsn)).map((d) => ({ rsn: d.rsn, tier: d.tier })),
    drops,
  };
}

// ---- Test clanmates and their drops ------------------------------------------------------------

const DUMMIES: { rsn: string; tier: SupporterTierId | null }[] = [
  { rsn: 'Lab~Patron', tier: 'patron' },
  { rsn: 'Lab~Champ', tier: 'champion' },
  { rsn: 'Lab~Fan', tier: 'supporter' },
  { rsn: 'Lab~Free', tier: null },
];

/** Drops worth showing in a feed: pets and uniques, with the game's own item ids for the icons. */
const SAMPLE_DROPS: { kind: 'pet' | 'unique'; itemName: string; itemId: number; source: string }[] = [
  { kind: 'pet', itemName: 'Pet snakeling', itemId: 12921, source: 'Zulrah' },
  { kind: 'unique', itemName: 'Twisted bow', itemId: 20997, source: 'Chambers of Xeric' },
  { kind: 'unique', itemName: 'Bandos chestplate', itemId: 11832, source: 'General Graardor' },
  { kind: 'pet', itemName: 'Vorki', itemId: 21992, source: 'Vorkath' },
  { kind: 'unique', itemName: 'Dragon warhammer', itemId: 13576, source: 'Lizardman shaman' },
  { kind: 'pet', itemName: 'Heron', itemId: 13320, source: 'Fishing' },
];

/**
 * The test clanmates' seats in the lab clan. Found by their LOGIN's marker, never by name: a real
 * character that happened to share a name must never be mistaken for one.
 */
async function dummySeats(clanId: number): Promise<{ rsn: string; seatId: number }[]> {
  // clan-scope: global -- pinned to the lab clan by id.
  return db
    .select({ rsn: accounts.rsn, seatId: clanMemberships.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(eq(clanMemberships.clanId, clanId), like(users.discordId, `${LAB_DUMMY_LOGIN}%`)));
}

/** The four standing test clanmates (lib/labCast), with their tiers renewed for another day. */
async function ensureDummies(actorUserId: number): Promise<{ rsn: string; seatId: number }[]> {
  const clanId = await ensureLabClan(actorUserId);
  for (const d of DUMMIES) {
    const user = await ensureTestUser(actorUserId, d.rsn);
    if (user) await setLabTier(user.userId, d.tier, d.tier === 'patron' ? 12 : d.tier === 'champion' ? 6 : 0);
  }
  return dummySeats(clanId);
}

/** Add a fresh batch of drops from the test clanmates (newest first in the feed). */
export async function seedLabDrops(actorUserId: number, count = 6): Promise<number> {
  const seats = await ensureDummies(actorUserId);
  if (!seats.length) return 0;
  const now = Date.now();
  const rows = Array.from({ length: Math.max(1, Math.min(20, count)) }, (_, i) => {
    const seat = seats[i % seats.length];
    const drop = SAMPLE_DROPS[(i + Math.floor(now / 1000)) % SAMPLE_DROPS.length];
    return {
      clanMemberId: seat.seatId,
      rsn: seat.rsn,
      kind: drop.kind,
      itemId: drop.itemId,
      itemName: drop.itemName,
      source: drop.source,
      // Uniques clear any clan's loot floor, so every one shows in the feed.
      valueGp: drop.kind === 'unique' ? 100_000_000 : null,
      occurredAt: iso(now - i * 7 * 60_000),
      dedupKey: `lab:${crypto.randomUUID()}`,
    };
  });
  await db.insert(moments).values(rows);
  return rows.length;
}

/** Remove every test drop (their reactions go with them). */
export async function clearLabDrops(): Promise<number> {
  const clanId = await labClanId();
  if (clanId == null) return 0;
  const seats = await dummySeats(clanId);
  if (!seats.length) return 0;
  const gone = await db.delete(moments).where(inArray(moments.clanMemberId, seats.map((s) => s.seatId))).returning({ id: moments.id });
  return gone.length;
}

/** Test drops are scratch, like lab sessions: gone LAB_KEEP_DAYS after they were made. */
export async function sweepLabTestDrops(now: Date = new Date()): Promise<number> {
  const clanId = await labClanId();
  if (clanId == null) return 0;
  const seats = await dummySeats(clanId);
  if (!seats.length) return 0;
  const cutoff = new Date(now.getTime() - LAB_KEEP_DAYS * 86_400_000).toISOString();
  const gone = await db
    .delete(moments)
    .where(and(inArray(moments.clanMemberId, seats.map((s) => s.seatId)), lt(moments.occurredAt, cutoff)))
    .returning({ id: moments.id });
  return gone.length;
}

export const LAB_TIERS = SUPPORTER_TIER_ORDER;
