// Supporter time given by Anvil staff, free: any tier, any length, to any person with a login.
//
// A gift is an ordinary supporter_subscriptions row (status 'granted', recurrence 'gift') ending at
// its period end, so everything that reads supporter state (flair, Discord roles, gold GZ, the
// profile) treats it like any other membership, with no Gumroad sale behind it. The best tier in
// force wins, so a gift above what someone pays shows the gift's tier until it ends, then their
// own again. Every grant and early end is in the platform audit log.

import { and, desc, eq, inArray, isNull, like } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, supporterSubscriptions, users } from '@/db/schema';
import { giftSources, supporterStanding, type SupporterStanding } from '@/lib/supporterGiftRules';
import { GIFT_RECURRENCE, SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

/** The longest one gift runs. Longer is a decision to make twice. */
export const MAX_GIFT_DAYS = 3650;

export interface SupporterGift {
  id: number;
  tier: SupporterTierId;
  startedAt: string;
  endsAt: string | null;
  /** Still in force (not ended early, not past its end). */
  live: boolean;
  /** Also gives clan boost slots (lib/clanBoostRules slotTier); off unless staff chose it. */
  boostSlots: boolean;
  /** The staff login that gave it (from the audit log), or null when no entry matches. */
  grantedBy: string | null;
  /** Who ended it early, or null (still running, or ran its course). */
  endedBy: string | null;
  note: string | null;
}

export function isGiftTier(v: unknown): v is SupporterTierId {
  return typeof v === 'string' && v in SUPPORTER_TIERS;
}

export async function listGifts(userId: number, now = Date.now()): Promise<SupporterGift[]> {
  const rows = await db
    .select()
    .from(supporterSubscriptions)
    .where(and(eq(supporterSubscriptions.userId, userId), eq(supporterSubscriptions.recurrence, GIFT_RECURRENCE)))
    .orderBy(desc(supporterSubscriptions.id))
    .limit(20);
  // Who gave / ended each: the platform audit entries about this login (their JSON opens with its id).
  // clan-scope: global -- supporter gifts belong to no clan (clan_id null).
  const audit = rows.length
    ? await db
        .select({ eventType: clanAuditLog.eventType, actorName: users.displayName, newValue: clanAuditLog.newValue, occurredAt: clanAuditLog.occurredAt })
        .from(clanAuditLog)
        .leftJoin(users, eq(users.id, clanAuditLog.actorUserId))
        .where(
          and(
            isNull(clanAuditLog.clanId),
            inArray(clanAuditLog.eventType, ['supporter_gift_granted', 'supporter_gift_ended']),
            like(clanAuditLog.newValue, `{"userId":${userId},%`),
          ),
        )
    : [];
  const sources = giftSources(rows, audit);
  return rows.map((r) => ({
    id: r.id,
    tier: r.tier as SupporterTierId,
    startedAt: r.startedAt,
    endsAt: r.currentPeriodEnd,
    live: r.status === 'granted' && (!r.currentPeriodEnd || Date.parse(r.currentPeriodEnd) > now),
    boostSlots: r.grantsBoostSlots,
    grantedBy: sources.get(r.id)?.grantedBy ?? null,
    endedBy: sources.get(r.id)?.endedBy ?? null,
    note: sources.get(r.id)?.note ?? null,
  }));
}

/**
 * What a person pays for and what they wear, for staff deciding on a gift: every login of theirs
 * (players.id) counts, like their public flair (lib/supporter supporterForPlayer).
 */
export async function standingForPlayer(playerId: number, now = Date.now()): Promise<SupporterStanding> {
  const rows = await db
    .select({
      id: supporterSubscriptions.id,
      tier: supporterSubscriptions.tier,
      status: supporterSubscriptions.status,
      currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
      startedAt: supporterSubscriptions.startedAt,
      recurrence: supporterSubscriptions.recurrence,
    })
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
    .where(eq(users.playerId, playerId));
  return supporterStanding(rows, now);
}

export async function giveGift(opts: {
  userId: number;
  tier: SupporterTierId;
  days: number;
  actorUserId: number;
  note?: string | null;
  /** Give the tier's clan boost slots too. Default without: a gift is flair unless staff say so. */
  boostSlots?: boolean;
}): Promise<SupporterGift> {
  const boostSlots = opts.boostSlots === true;
  const days = Math.round(opts.days);
  if (!(days >= 1 && days <= MAX_GIFT_DAYS)) throw new Error(`A gift runs 1 to ${MAX_GIFT_DAYS} days.`);
  const start = new Date();
  const end = new Date(start.getTime() + days * 86_400_000);
  const [row] = await db
    .insert(supporterSubscriptions)
    .values({
      userId: opts.userId,
      tier: opts.tier,
      status: 'granted',
      recurrence: GIFT_RECURRENCE,
      currentPeriodEnd: end.toISOString(),
      startedAt: start.toISOString(),
      grantsBoostSlots: boostSlots,
    })
    .returning();
  await db.insert(clanAuditLog).values({
    clanId: null,
    eventType: 'supporter_gift_granted',
    actorUserId: opts.actorUserId,
    newValue: JSON.stringify({ userId: opts.userId, giftId: row.id, tier: opts.tier, days, endsAt: end.toISOString(), boostSlots, note: opts.note?.slice(0, 200) || null }),
  });
  return { id: row.id, tier: opts.tier, startedAt: row.startedAt, endsAt: row.currentPeriodEnd, live: true, boostSlots, grantedBy: null, endedBy: null, note: opts.note?.slice(0, 200) || null };
}

/** End a gift now. False when it isn't this person's gift or already ended. */
export async function endGift(userId: number, giftId: number, actorUserId: number): Promise<boolean> {
  const ended = await db
    .update(supporterSubscriptions)
    .set({ status: 'ended', endedAt: new Date().toISOString(), currentPeriodEnd: new Date().toISOString() })
    .where(
      and(
        eq(supporterSubscriptions.id, giftId),
        eq(supporterSubscriptions.userId, userId),
        eq(supporterSubscriptions.recurrence, GIFT_RECURRENCE),
        eq(supporterSubscriptions.status, 'granted'),
      ),
    )
    .returning({ tier: supporterSubscriptions.tier });
  if (!ended.length) return false;
  await db.insert(clanAuditLog).values({
    clanId: null,
    eventType: 'supporter_gift_ended',
    actorUserId,
    newValue: JSON.stringify({ userId, giftId, tier: ended[0].tier }),
  });
  return true;
}
