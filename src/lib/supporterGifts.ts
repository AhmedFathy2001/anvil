// Supporter time given by Anvil staff, free: any tier, any length, to any person with a login.
//
// A gift is an ordinary supporter_subscriptions row (status 'granted', recurrence 'gift') ending at
// its period end, so everything that reads supporter state (flair, Discord roles, gold GZ, the
// profile) treats it like any other membership, with no Gumroad sale behind it. The best tier in
// force wins, so a gift above what someone pays shows the gift's tier until it ends, then their
// own again. Every grant and early end is in the platform audit log.

import { and, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, ownerTrials, supporterSubscriptions, users } from '@/db/schema';
import {
  addTimePreview,
  giftLineForPerson,
  giftModes,
  giftSources,
  liftPreview,
  paidAtOrAbove,
  planAddTime,
  supporterStanding,
  type AddTimePlan,
  type GiftMode,
  type GiftPlanRow,
  type SupporterStanding,
} from '@/lib/supporterGiftRules';
import { GIFT_RECURRENCE, QUEUED_STATUS, SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

export type { GiftMode } from '@/lib/supporterGiftRules';

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
  /** Stored "add time" that was removed before it ever started. */
  neverStarted?: boolean;
  note: string | null;
  /** Which option it was given with: 'lift' (to a tier until a date) or 'add' (time added). */
  mode: GiftMode;
  /** Days added to it since it was given ("Add time" on a running gift). */
  addedDays: number;
  /** Stored "add time" that has not started: it begins when their paid membership at this tier stops. */
  queued: boolean;
  queuedDays: number | null;
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
            inArray(clanAuditLog.eventType, ['supporter_gift_granted', 'supporter_gift_ended', 'supporter_gift_extended']),
            like(clanAuditLog.newValue, `{"userId":${userId},%`),
          ),
        )
    : [];
  const sources = giftSources(rows, audit);
  const modes = giftModes(rows, audit);
  return rows.map((r) => ({
    id: r.id,
    tier: r.tier as SupporterTierId,
    startedAt: r.startedAt,
    endsAt: r.currentPeriodEnd,
    live: r.status === 'granted' && (!r.currentPeriodEnd || Date.parse(r.currentPeriodEnd) > now),
    boostSlots: r.grantsBoostSlots,
    grantedBy: sources.get(r.id)?.grantedBy ?? null,
    endedBy: sources.get(r.id)?.endedBy ?? null,
    neverStarted: sources.get(r.id)?.neverStarted ?? false,
    note: sources.get(r.id)?.note ?? null,
    mode: modes.get(r.id)?.mode ?? 'lift',
    addedDays: modes.get(r.id)?.addedDays ?? 0,
    queued: r.status === QUEUED_STATUS,
    queuedDays: r.queuedDays,
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

const PLAN_COLUMNS = {
  id: supporterSubscriptions.id,
  tier: supporterSubscriptions.tier,
  status: supporterSubscriptions.status,
  currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
  startedAt: supporterSubscriptions.startedAt,
  recurrence: supporterSubscriptions.recurrence,
  gumroadSubscriptionId: supporterSubscriptions.gumroadSubscriptionId,
  queuedDays: supporterSubscriptions.queuedDays,
} as const;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Tx;

/** The rows that decide what "add time" does: this login's own (a gift is given to a login). */
async function planRows(userId: number, reader: Reader = db): Promise<GiftPlanRow[]> {
  return reader.select(PLAN_COLUMNS).from(supporterSubscriptions).where(eq(supporterSubscriptions.userId, userId));
}

/** Every login of the same PERSON (users.player_id), this one included; just this one when it has no person. */
async function personLogins(userId: number): Promise<number[]> {
  const me = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, playerId: true } });
  if (!me) return [];
  if (me.playerId == null) return [me.id];
  const all = await db.select({ id: users.id }).from(users).where(eq(users.playerId, me.playerId)).orderBy(users.id);
  return all.map((u) => u.id);
}

/**
 * What a gift WOULD do, in the words the staff form shows before saving. `nothing`: a lift that
 * changes nothing visible (needs a second, deliberate confirm). `blocked`: it cannot be given.
 */
export async function previewGift(opts: { userId: number; playerId: number; tier: SupporterTierId; days: number; mode: GiftMode }, now = Date.now()): Promise<{ text: string; nothing: boolean; blocked: boolean }> {
  if (opts.mode === 'add') {
    const plan = planAddTime(await planRows(opts.userId), opts.tier, opts.days, now);
    return { text: addTimePreview(plan, opts.tier, opts.days), nothing: false, blocked: plan.kind === 'endless' };
  }
  const standing = await standingForPlayer(opts.playerId, now);
  return { ...liftPreview(standing, opts.tier, new Date(now + opts.days * 86_400_000).toISOString()), blocked: false };
}

export interface GiftResult extends SupporterGift {
  /** What was done: a new entitlement, a running one moved out, or time stored for later. */
  outcome: 'new' | 'extended' | 'queued';
}

/**
 * Give Supporter time from Anvil. `mode` 'lift' (the default, and what every caller did before the
 * option existed: owner trials, the staff API) creates a separate entitlement at the tier for `days`.
 * 'add' ADDS the days to what they hold at the tier (lib/supporterGiftRules planAddTime). Either way
 * nothing is written to or asked of Gumroad, a paid row is never edited, and the audit log gets who,
 * for whom, which option, the tier, from when to when, and the note.
 */
export async function giveGift(opts: {
  userId: number;
  tier: SupporterTierId;
  days: number;
  actorUserId: number;
  note?: string | null;
  /** Give the tier's clan boost slots too. Default without: a gift is flair unless staff say so. */
  boostSlots?: boolean;
  mode?: GiftMode;
}): Promise<GiftResult> {
  const boostSlots = opts.boostSlots === true;
  const mode: GiftMode = opts.mode === 'add' ? 'add' : 'lift';
  const days = Math.round(opts.days);
  if (!(days >= 1 && days <= MAX_GIFT_DAYS)) throw new Error(`A gift runs 1 to ${MAX_GIFT_DAYS} days.`);
  const note = opts.note?.slice(0, 200) || null;
  // ONE AT A TIME per login. "Add time" reads what they hold and then writes to it; two submits at
  // once (a double click, two staff) both read the same end date and one extension was lost, or two
  // stored rows were made. A transaction-scoped advisory lock keyed on the login makes the second
  // wait for the first to commit, so it reads the moved end and extends again in sequence.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7188, ${opts.userId}::int)`);
    const start = new Date();
    const audit = (eventType: string, value: Record<string, unknown>) =>
      tx.insert(clanAuditLog).values({ clanId: null, eventType, actorUserId: opts.actorUserId, newValue: JSON.stringify(value) });
    const view = (row: typeof supporterSubscriptions.$inferSelect, outcome: GiftResult['outcome']): GiftResult => ({
      id: row.id, tier: opts.tier, startedAt: row.startedAt, endsAt: row.currentPeriodEnd, live: row.status === 'granted', boostSlots: row.grantsBoostSlots,
      grantedBy: null, endedBy: null, note, mode, addedDays: 0, queued: row.status === QUEUED_STATUS, queuedDays: row.queuedDays, outcome,
    });

    const plan: AddTimePlan | null = mode === 'add' ? planAddTime(await planRows(opts.userId, tx), opts.tier, days, start.getTime()) : null;
    if (plan?.kind === 'endless') throw new Error('They already hold this tier from Anvil with no end date, so there is nothing to add to.');

    if (plan?.kind === 'queue') {
      // They pay for this tier: stored, in force for nobody, until the paid membership stops.
      if (plan.queuedId != null) {
        const [row] = await tx.update(supporterSubscriptions).set({ queuedDays: plan.queuedDays, ...(boostSlots ? { grantsBoostSlots: true } : {}) }).where(eq(supporterSubscriptions.id, plan.queuedId)).returning();
        await audit('supporter_gift_extended', { userId: opts.userId, giftId: row.id, tier: opts.tier, mode, days, queuedDays: plan.queuedDays, starts: 'when their paid membership ends', paidUntil: plan.paidUntil, note });
        return view(row, 'queued');
      }
      const [row] = await tx
        .insert(supporterSubscriptions)
        .values({ userId: opts.userId, tier: opts.tier, status: QUEUED_STATUS, recurrence: GIFT_RECURRENCE, currentPeriodEnd: null, startedAt: start.toISOString(), grantsBoostSlots: boostSlots, queuedDays: days })
        .returning();
      await audit('supporter_gift_granted', { userId: opts.userId, giftId: row.id, tier: opts.tier, mode, days, from: null, endsAt: null, starts: 'when their paid membership ends', paidUntil: plan.paidUntil, boostSlots, note });
      return view(row, 'queued');
    }

    if (plan?.kind === 'extend') {
      const [row] = await tx.update(supporterSubscriptions).set({ currentPeriodEnd: plan.to }).where(eq(supporterSubscriptions.id, plan.giftId)).returning();
      // An Anvil trial riding on this gift ends when the gift does: its record moves with it.
      await tx.update(ownerTrials).set({ endsAt: new Date(plan.to) }).where(and(eq(ownerTrials.kind, 'supporter'), eq(ownerTrials.entitlementId, plan.giftId), isNull(ownerTrials.revokedAt)));
      await audit('supporter_gift_extended', { userId: opts.userId, giftId: row.id, tier: opts.tier, mode, days, from: plan.from, endsAt: plan.to, note });
      return view(row, 'extended');
    }

    const end = plan?.kind === 'new' ? new Date(plan.to) : new Date(start.getTime() + days * 86_400_000);
    const [row] = await tx
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
    await audit('supporter_gift_granted', { userId: opts.userId, giftId: row.id, tier: opts.tier, mode, days, from: start.toISOString(), endsAt: end.toISOString(), boostSlots, note });
    return view(row, 'new');
  });
}

/** End a gift now (a running one, or stored time that has not started). False when it isn't this person's gift or already ended. */
export async function endGift(userId: number, giftId: number, actorUserId: number): Promise<boolean> {
  // Stored time that never started is tried first, so the record can say it was removed before it
  // began (the row keeps no trace of having been queued once it is 'ended').
  const close = (statuses: string[]) =>
    db
      .update(supporterSubscriptions)
      .set({ status: 'ended', endedAt: new Date().toISOString(), currentPeriodEnd: new Date().toISOString() })
      .where(
        and(
          eq(supporterSubscriptions.id, giftId),
          eq(supporterSubscriptions.userId, userId),
          eq(supporterSubscriptions.recurrence, GIFT_RECURRENCE),
          inArray(supporterSubscriptions.status, statuses),
        ),
      )
      .returning({ tier: supporterSubscriptions.tier });
  let ended = await close([QUEUED_STATUS]);
  const neverStarted = ended.length > 0;
  if (!neverStarted) ended = await close(['granted']);
  if (!ended.length) return false;
  await db.insert(clanAuditLog).values({
    clanId: null,
    eventType: 'supporter_gift_ended',
    actorUserId,
    newValue: JSON.stringify({ userId, giftId, tier: ended[0].tier, ...(neverStarted ? { neverStarted: true } : {}) }),
  });
  return true;
}

/**
 * Start this PERSON's stored "add time" once they no longer pay for that tier or a higher one: the row
 * becomes an ordinary gift running from now for its stored days. Called when the Supporter webhook
 * ends, refunds or cancels a membership, and once a day for anything a notification missed. Returns
 * how many started.
 */
export async function startQueuedGifts(userId: number, now = Date.now()): Promise<number> {
  // The PERSON, not the login: the paid membership may sit on another login of theirs, and so may
  // the stored time.
  const logins = await personLogins(userId);
  if (logins.length === 0) return 0;
  const rows = await db
    .select({ ...PLAN_COLUMNS, userId: supporterSubscriptions.userId })
    .from(supporterSubscriptions)
    .where(inArray(supporterSubscriptions.userId, logins));
  let started = 0;
  for (const q of rows.filter((r) => r.status === QUEUED_STATUS && r.recurrence === GIFT_RECURRENCE)) {
    // Still paying for this tier OR A HIGHER ONE (they upgraded): the stored time keeps waiting.
    if (paidAtOrAbove(rows, q.tier as SupporterTierId, now)) continue;
    const days = q.queuedDays ?? 0;
    if (days < 1) continue;
    const from = new Date(now).toISOString();
    const to = new Date(now + days * 86_400_000).toISOString();
    const done = await db
      .update(supporterSubscriptions)
      .set({ status: 'granted', startedAt: from, currentPeriodEnd: to })
      .where(and(eq(supporterSubscriptions.id, q.id), eq(supporterSubscriptions.status, QUEUED_STATUS)))
      .returning({ id: supporterSubscriptions.id });
    if (!done.length) continue;
    started += 1;
    await db.insert(clanAuditLog).values({
      clanId: null,
      eventType: 'supporter_gift_started',
      newValue: JSON.stringify({ userId: q.userId, giftId: q.id, tier: q.tier, days, from, endsAt: to, reason: 'their paid membership at this tier or higher stopped' }),
    });
  }
  return started;
}

/** The daily pass over every stored gift (the billing cron). */
export async function startDueQueuedGifts(now = Date.now()): Promise<{ started: number }> {
  const owners = await db.selectDistinct({ userId: supporterSubscriptions.userId }).from(supporterSubscriptions).where(eq(supporterSubscriptions.status, QUEUED_STATUS));
  let started = 0;
  for (const o of owners) started += await startQueuedGifts(o.userId, now);
  return { started };
}

/**
 * What the person reads on their own plan page about gifts from Anvil: one line per gift in force,
 * and one per stored "add time" ("3 months of Champion added by Anvil, starting when your membership ends.").
 */
export async function giftLinesForUser(userId: number, now = Date.now()): Promise<string[]> {
  const rows = await db
    .select()
    .from(supporterSubscriptions)
    .where(and(eq(supporterSubscriptions.userId, userId), eq(supporterSubscriptions.recurrence, GIFT_RECURRENCE), inArray(supporterSubscriptions.status, ['granted', QUEUED_STATUS])));
  return rows
    .filter((r) => r.status === QUEUED_STATUS || !r.currentPeriodEnd || Date.parse(r.currentPeriodEnd) > now)
    .filter((r) => r.tier in SUPPORTER_TIERS)
    .map((r) => giftLineForPerson({ tier: r.tier as SupporterTierId, endsAt: r.currentPeriodEnd, queuedDays: r.queuedDays, queued: r.status === QUEUED_STATUS }));
}
