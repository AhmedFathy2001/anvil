// Owner trials: a free Supporter tier or clan boost level for N days, granted by the platform owner.
//
// HOW IT PLUGS INTO ENTITLEMENTS, with no trial-specific resolver:
//  - Supporter: an ordinary staff-gift row in supporter_subscriptions (status 'granted', recurrence
//    'gift', currentPeriodEnd = end). supporterState/rowInForce already count it while the period end
//    is in the future and drop it after, at read time, so it expires on its own with no sweep.
//  - Boost: the clan's platform gift on clan_boost_state (giftLevel + giftExpiresAt). giftTargetLevel
//    already returns 0 once the expiry passes.
// owner_trials records who/what/until and whether they later bought. "Converted" is derived from
// the billing rows themselves and stamped the first time it is seen.

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanBoostState, clans, ownerTrials, supporterSubscriptions, users } from '@/db/schema';
import { syncAnvilSupporterRoles } from '@/lib/anvilDiscord';
import { giftTargetLevel } from '@/lib/clanBoostRules';
import { loadClanRows } from '@/lib/money';
import { TRIAL_MAX_DAYS, boostConverted, pipelineCents, supporterConverted, trialStatus, trialValueCents, validTrialDays, type TrialStatus } from '@/lib/moneyRules';
import { endGift, giveGift, isGiftTier } from '@/lib/supporterGifts';
import { SUPPORTER_TIERS, parseStamp, type SupporterTierId } from '@/lib/supporterTiers';

export class TrialError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export interface GrantInput {
  kind: 'supporter' | 'boost';
  userId?: number;
  clanId?: number;
  /** supporter tier id, or boost level 1-3 */
  tier: string | number;
  days: number;
  note?: string | null;
  actorUserId: number;
}

const audit = (clanId: number | null, eventType: string, actorUserId: number, value: unknown) =>
  db.insert(clanAuditLog).values({ clanId, eventType, actorUserId, newValue: JSON.stringify(value), notes: 'owner' });

export async function grantTrial(i: GrantInput, now = Date.now()) {
  if (!validTrialDays(i.days)) throw new TrialError(`A trial runs 1 to ${TRIAL_MAX_DAYS} days.`);
  const note = i.note?.trim().slice(0, 200) || null;
  const endsAt = new Date(now + i.days * 86_400_000);

  if (i.kind === 'supporter') {
    if (!i.userId || !isGiftTier(i.tier)) throw new TrialError('Pick a person and a Supporter tier.');
    const user = await db.query.users.findFirst({ where: eq(users.id, i.userId), columns: { id: true } });
    if (!user) throw new TrialError('No such login.', 404);
    const running = await listForTarget('supporter', i.userId, now);
    if (running) throw new TrialError('That person already has a trial running. Revoke it first.', 409);
    const gift = await giveGift({ userId: i.userId, tier: i.tier as SupporterTierId, days: i.days, actorUserId: i.actorUserId, note: note ? `trial: ${note}` : 'trial', boostSlots: false });
    const [row] = await db.insert(ownerTrials).values({
      kind: 'supporter', userId: i.userId, tier: i.tier, days: i.days, note, startsAt: new Date(now), endsAt, entitlementId: gift.id, grantedBy: i.actorUserId,
    }).returning();
    await audit(null, 'owner_trial_granted', i.actorUserId, { trialId: row.id, kind: 'supporter', userId: i.userId, tier: i.tier, days: i.days, endsAt: endsAt.toISOString(), note });
    void syncAnvilSupporterRoles(i.userId);
    return row;
  }

  const level = Number(i.tier);
  if (!i.clanId || !Number.isInteger(level) || level < 1 || level > 3) throw new TrialError('Pick a clan and a boost level from 1 to 3.');
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, i.clanId), columns: { id: true } });
  if (!clan) throw new TrialError('No such clan.', 404);
  const existing = await db.query.clanBoostState.findFirst({ where: eq(clanBoostState.clanId, i.clanId), columns: { giftLevel: true, giftExpiresAt: true } });
  // Never overwrite a staff gift that is still running: one clan, one platform gift at a time.
  if (giftTargetLevel({ level: existing?.giftLevel, expiresAt: existing?.giftExpiresAt }, now) > 0) {
    throw new TrialError('That clan already has a boost gift running. Clear it first.', 409);
  }
  const values = { giftLevel: level, giftExpiresAt: endsAt.toISOString(), giftedBy: i.actorUserId, updatedAt: new Date(now).toISOString() };
  await db.insert(clanBoostState).values({ clanId: i.clanId, ...values }).onConflictDoUpdate({ target: clanBoostState.clanId, set: values });
  const [row] = await db.insert(ownerTrials).values({
    kind: 'boost', clanId: i.clanId, tier: String(level), days: i.days, note, startsAt: new Date(now), endsAt, grantedBy: i.actorUserId,
  }).returning();
  await audit(i.clanId, 'owner_trial_granted', i.actorUserId, { trialId: row.id, kind: 'boost', clanId: i.clanId, level, days: i.days, endsAt: endsAt.toISOString(), note });
  return row;
}

/** A running (not revoked, not expired) trial for this target, or null. */
async function listForTarget(kind: 'supporter' | 'boost', id: number, now: number) {
  const [row] = await db
    .select({ id: ownerTrials.id })
    .from(ownerTrials)
    .where(and(eq(ownerTrials.kind, kind), kind === 'supporter' ? eq(ownerTrials.userId, id) : eq(ownerTrials.clanId, id), isNull(ownerTrials.revokedAt), sql`${ownerTrials.endsAt} > ${new Date(now).toISOString()}`))
    .limit(1);
  return row ?? null;
}

/** End a trial now and take the entitlement back. False if it is unknown or already revoked. */
export async function revokeTrial(id: number, actorUserId: number, now = Date.now()): Promise<boolean> {
  const t = await db.query.ownerTrials.findFirst({ where: eq(ownerTrials.id, id) });
  if (!t || t.revokedAt) return false;
  await db.update(ownerTrials).set({ revokedAt: new Date(now), revokedBy: actorUserId }).where(eq(ownerTrials.id, id));
  if (t.kind === 'supporter' && t.userId && t.entitlementId) {
    await endGift(t.userId, t.entitlementId, actorUserId);
    void syncAnvilSupporterRoles(t.userId);
  } else if (t.kind === 'boost' && t.clanId) {
    // Only clear the gift this trial set; a later staff gift is not ours to undo.
    await db.update(clanBoostState)
      .set({ giftLevel: null, giftExpiresAt: null, giftedBy: null, updatedAt: new Date(now).toISOString() })
      .where(and(eq(clanBoostState.clanId, t.clanId), eq(clanBoostState.giftExpiresAt, t.endsAt.toISOString()), eq(clanBoostState.giftLevel, Number(t.tier))));
  }
  await audit(t.clanId ?? null, 'owner_trial_revoked', actorUserId, { trialId: id, kind: t.kind, userId: t.userId, clanId: t.clanId, tier: t.tier });
  return true;
}

export interface TrialView {
  id: string;
  source: 'owner' | 'gumroad';
  kind: 'supporter' | 'boost' | 'hosted';
  target: string;
  tier: string;
  startsAt: number | null;
  endsAt: number;
  status: TrialStatus;
  valueCents: number;
  estimated: boolean;
  note: string | null;
  convertedAt: number | null;
}

export async function listTrials(now = Date.now()) {
  const rows = await db.select().from(ownerTrials).orderBy(desc(ownerTrials.id)).limit(500);
  const userIds = [...new Set(rows.map((r) => r.userId).filter((x): x is number => x != null))];
  const clanIds = [...new Set(rows.map((r) => r.clanId).filter((x): x is number => x != null))];
  const [userRows, clanNames, paid, boostState] = await Promise.all([
    userIds.length ? db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, userIds)) : [],
    clanIds.length ? db.select({ id: clans.id, name: clans.name }).from(clans).where(inArray(clans.id, clanIds)) : [],
    userIds.length
      ? db.select({ userId: supporterSubscriptions.userId, startedAt: supporterSubscriptions.startedAt, status: supporterSubscriptions.status, recurrence: supporterSubscriptions.recurrence, gumroadSubscriptionId: supporterSubscriptions.gumroadSubscriptionId }).from(supporterSubscriptions).where(inArray(supporterSubscriptions.userId, userIds))
      : [],
    clanIds.length ? db.select({ clanId: clanBoostState.clanId, level: clanBoostState.level }).from(clanBoostState).where(inArray(clanBoostState.clanId, clanIds)) : [],
  ]);
  const uName = new Map(userRows.map((u) => [u.id, u.name]));
  const cName = new Map(clanNames.map((c) => [c.id, c.name]));
  const organic = new Map(boostState.map((b) => [b.clanId, b.level]));

  const stamp: number[] = [];
  const out: TrialView[] = rows.map((r) => {
    let convertedAt = r.convertedAt?.getTime() ?? null;
    if (convertedAt == null && !r.revokedAt) {
      const isConv = r.kind === 'supporter'
        ? supporterConverted(paid.filter((p) => p.userId === r.userId), r.startsAt.getTime())
        : boostConverted(organic.get(r.clanId as number) ?? 0, Number(r.tier));
      if (isConv) { convertedAt = now; stamp.push(r.id); }
    }
    const v = trialValueCents(r.kind, r.tier);
    return {
      id: `o${r.id}`, source: 'owner', kind: r.kind as 'supporter' | 'boost',
      target: r.kind === 'supporter' ? (uName.get(r.userId as number) ?? `login ${r.userId}`) : (cName.get(r.clanId as number) ?? `clan ${r.clanId}`),
      tier: r.kind === 'supporter' ? (SUPPORTER_TIERS[r.tier as SupporterTierId]?.name ?? r.tier) : `Boost level ${r.tier}`,
      startsAt: r.startsAt.getTime(), endsAt: r.endsAt.getTime(),
      status: trialStatus({ endsAt: r.endsAt.getTime(), revokedAt: r.revokedAt?.getTime() ?? null, convertedAt }, now),
      valueCents: v.cents, estimated: v.estimated, note: r.note, convertedAt,
    };
  });
  if (stamp.length) await db.update(ownerTrials).set({ convertedAt: new Date(now) }).where(and(inArray(ownerTrials.id, stamp), isNull(ownerTrials.convertedAt)));

  // Gumroad free trials on hosted plans (clans.trial_ends_at): read-only, valued at the plan price.
  // A first charge clears trial_ends_at, so "converted" cannot be seen here, only running or lapsed.
  for (const c of await loadClanRows()) {
    const end = parseStamp(c.trialEndsAt);
    if (Number.isNaN(end) || c.free || c.priceUsd == null) continue;
    out.push({
      id: `g${c.id}`, source: 'gumroad', kind: 'hosted', target: c.name, tier: `${c.kind === 'creator' ? 'Creator' : 'Hosted'} plan ${c.plan}`,
      startsAt: null, endsAt: end, status: trialStatus({ endsAt: end, revokedAt: null, convertedAt: null }, now),
      valueCents: Math.round(c.priceUsd * 100), estimated: false, note: null, convertedAt: null,
    });
  }
  out.sort((a, b) => a.endsAt - b.endsAt);
  const count = (s: TrialStatus) => out.filter((t) => t.status === s).length;
  return {
    trials: out,
    counts: { active: count('active'), ending: count('ending'), expired: count('expired'), converted: count('converted'), revoked: count('revoked') },
    pipelineCents: pipelineCents(out),
    pipelineOwnerCents: pipelineCents(out.filter((t) => t.source === 'owner')),
  };
}

/** Owner-only target search for the grant form. */
export async function searchTargets(kind: 'supporter' | 'boost', q: string) {
  const term = `%${q.replace(/[%_\\]/g, '\\$&').slice(0, 40)}%`;
  if (kind === 'supporter') {
    const rows = await db.select({ id: users.id, name: users.displayName }).from(users).where(sql`${users.displayName} ilike ${term}`).limit(12);
    return rows.map((r) => ({ value: String(r.id), label: r.name ?? `login ${r.id}` }));
  }
  const rows = await db.select({ id: clans.id, name: clans.name }).from(clans).where(sql`${clans.name} ilike ${term}`).limit(12);
  return rows.map((r) => ({ value: String(r.id), label: r.name }));
}
