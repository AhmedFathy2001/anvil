// Anvil's own plan trial: the database half (rules in lib/planTrialRules).
//
// A plan trial is an owner_trials row of kind 'plan' on a clan or creator space: a paid tier lent
// until a date, with no card. `clans.plan` and `clans.member_cap` are never written for it; every
// reader that decides what a row may DO asks here (planInForce / capInForce, and lib/clanContext
// overlays it on the request's clan), so the trial ends by itself at read time with no sweep, and
// nothing is deleted when it does: a roster over the Free cap is handled exactly like one over a
// lapsed plan's cap (lib/member-cap's grace clock).
//
// EVERY new clan or space starts one automatically (lib/clanCreate), the top tier. One per row. The
// one abuse guard: a clan whose VERIFIED in-game name used a trial and was then deleted does not get
// another by being created again. A deleted clan takes its rows with it, so deleting one that had a
// trial leaves a line in the platform audit log with no clan (event 'plan_trial_used', notes
// 'ign:<name>'), which is what that check reads. A clan that only names or verifies that in-game
// name LATER keeps its trial; staff see it flagged in the trials view (repeatNameClans). The same
// deletion also remembers the clan's OWNERS when the trial was the automatic one, so deleting a
// trialed clan and making another does not restart it (a person's second clan still gets its trial).

import { cache } from 'react';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanStaff, clans, ownerTrials } from '@/db/schema';
import {
  autoTrialDays,
  autoTrialDecision,
  effectiveMemberCap,
  effectivePlanId,
  inGameNameKey,
  topTrialTier,
  trialTierIds,
  type AutoTrialRefusal,
  type RunningTrial,
} from '@/lib/planTrialRules';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Tx;

const USED_EVENT = 'plan_trial_used';
/** clan_audit_log.notes of the per-owner memory (the actor is the owner). */
const OWNER_NOTE = 'owner';
/** owner_trials.note of the automatic trial (granted_by null). */
export const AUTO_TRIAL_NOTE = 'on create';

export interface PlanTrialRow {
  id: number;
  clanId: number;
  tier: string;
  startsAt: number;
  endsAt: number;
  revoked: boolean;
  /** Started by the site when the clan was created, rather than by a staff person. */
  automatic: boolean;
  remindRequested: boolean;
}

function toRow(r: typeof ownerTrials.$inferSelect): PlanTrialRow {
  return {
    id: r.id,
    clanId: r.clanId as number,
    tier: r.tier,
    startsAt: r.startsAt.getTime(),
    endsAt: r.endsAt.getTime(),
    revoked: r.revokedAt != null,
    automatic: r.grantedBy == null && r.note === AUTO_TRIAL_NOTE,
    remindRequested: r.remindRequestedAt != null,
  };
}

/** The clan's latest plan trial that was not taken back: running or ended. Null when it never had one. */
export const latestPlanTrial = cache(async (clanId: number): Promise<PlanTrialRow | null> => {
  const [r] = await db
    .select()
    .from(ownerTrials)
    .where(and(eq(ownerTrials.kind, 'plan'), eq(ownerTrials.clanId, clanId), isNull(ownerTrials.revokedAt)))
    .orderBy(desc(ownerTrials.endsAt))
    .limit(1);
  return r ? toRow(r) : null;
});

/** The trial running right now, or null. */
export async function runningPlanTrial(clanId: number, now = Date.now()): Promise<RunningTrial | null> {
  const t = await latestPlanTrial(clanId);
  return t && t.endsAt > now ? { tier: t.tier, endsAt: t.endsAt } : null;
}

/** The running trials of many clans at once (lists, directories), keyed by clan id. */
export async function runningPlanTrials(clanIds: number[], now = Date.now()): Promise<Map<number, RunningTrial>> {
  const out = new Map<number, RunningTrial>();
  const ids = [...new Set(clanIds)];
  if (ids.length === 0) return out;
  const rows = await db
    .select({ clanId: ownerTrials.clanId, tier: ownerTrials.tier, endsAt: ownerTrials.endsAt })
    .from(ownerTrials)
    .where(and(eq(ownerTrials.kind, 'plan'), inArray(ownerTrials.clanId, ids), isNull(ownerTrials.revokedAt), sql`${ownerTrials.endsAt} > ${new Date(now).toISOString()}`));
  for (const r of rows) {
    const cur = out.get(r.clanId as number);
    if (!cur || r.endsAt.getTime() > cur.endsAt) out.set(r.clanId as number, { tier: r.tier, endsAt: r.endsAt.getTime() });
  }
  return out;
}

/**
 * The plan a clan or space has IN FORCE: what it pays for, or its running trial's tier when higher.
 * Pass the row's own `kind` and stored `plan`. This is what a capability or limit check reads; what
 * a billing page shows as "you pay for" is still `clans.plan`.
 */
export async function planInForce(clan: { id: number; kind: string | null; plan: string }, now = Date.now()): Promise<string> {
  return effectivePlanId(clan.kind, clan.plan, await runningPlanTrial(clan.id, now), now);
}

/**
 * A row read straight from `clans` (its kind and stored plan), with the plan IN FORCE put in its
 * place: for the readers that gate on a host's plan without going through lib/clanContext.
 */
export async function withPlanInForce<T extends { kind: string | null; plan: string }>(clanId: number, row: T | undefined | null, now = Date.now()): Promise<T | undefined> {
  if (!row) return undefined;
  const plan = effectivePlanId(row.kind, row.plan, await runningPlanTrial(clanId, now), now);
  return plan === row.plan ? row : { ...row, plan };
}

/** The member cap in force with it. */
export async function capInForce(clan: { id: number; kind: string | null; plan: string; memberCap: number | null }, now = Date.now()): Promise<number | null> {
  return effectiveMemberCap(clan.kind, clan.plan, clan.memberCap, await runningPlanTrial(clan.id, now), now);
}

/** Has this clan or space ever had a plan trial (running, ended or taken back)? */
export async function hadPlanTrial(clanId: number, reader: Reader = db): Promise<boolean> {
  const [r] = await reader.select({ id: ownerTrials.id }).from(ownerTrials).where(and(eq(ownerTrials.kind, 'plan'), eq(ownerTrials.clanId, clanId))).limit(1);
  return !!r;
}

const MEMBERSHIP_EVENTS = ['billing_subscribed', 'billing_renewed', 'billing_ended', 'billing_restarted'];

/**
 * Has this clan had a paid membership (or a Gumroad trial of one) before? Gumroad's free trial is
 * once per BUYER, and a buyer is an email — so a clan that let its membership lapse could subscribe
 * again from a new address and get another free month (lfl did, the day its Silver ended). The trial
 * is once per CLAN here.
 */
export async function hadMembership(clanId: number, reader: Reader = db): Promise<boolean> {
  const [row] = await reader
    .select({ id: clanAuditLog.id })
    .from(clanAuditLog)
    .where(and(eq(clanAuditLog.clanId, clanId), inArray(clanAuditLog.eventType, MEMBERSHIP_EVENTS)))
    .limit(1);
  return !!row;
}

/**
 * Has this clan or space used its one trial: a site trial, a past membership, or a Gumroad trial on
 * record? Decides which checkout its buttons open (lib/planTrialRules buyButtons) and whether a sale
 * carrying a Gumroad trial is held to its first charge (lib/clanSale).
 */
export async function clanTrialUsed(clan: { id: number; trialEndsAt?: string | null; gumroadSubscriptionId?: string | null }): Promise<boolean> {
  if (clan.trialEndsAt || clan.gumroadSubscriptionId) return true;
  return (await hadPlanTrial(clan.id)) || (await hadMembership(clan.id));
}

/** Many at once, for /portal and /pricing: the ids that have used their trial. */
export async function clansWithTrialUsed(rows: { id: number; trialEndsAt?: string | null; gumroadSubscriptionId?: string | null }[]): Promise<Set<number>> {
  const out = new Set<number>(rows.filter((c) => c.trialEndsAt || c.gumroadSubscriptionId).map((c) => c.id));
  const rest = rows.map((c) => c.id).filter((id) => !out.has(id));
  if (rest.length === 0) return out;
  const [trials, paid] = await Promise.all([
    db.selectDistinct({ id: ownerTrials.clanId }).from(ownerTrials).where(and(eq(ownerTrials.kind, 'plan'), inArray(ownerTrials.clanId, rest))),
    db.selectDistinct({ id: clanAuditLog.clanId }).from(clanAuditLog).where(and(inArray(clanAuditLog.clanId, rest), inArray(clanAuditLog.eventType, MEMBERSHIP_EVENTS))),
  ]);
  for (const r of [...trials, ...paid]) if (r.id != null) out.add(r.id);
  return out;
}

// ── The automatic trial ─────────────────────────────────────────────────────────────────────────

/**
 * Start a new clan's or space's automatic trial, inside its creating transaction, if the one-trial
 * rule allows (lib/planTrialRules autoTrialDecision). Returns why not, when not.
 */
export async function startAutoTrial(
  tx: Tx,
  clan: { id: number; kind: string | null; inGameName: string | null },
  /** The person creating it; null (a seed, a test) asks nothing about the owner. */
  ownerUserId: number | null = null,
  now = Date.now(),
): Promise<{ granted: true; tier: string; endsAt: Date } | { granted: false; reason: AutoTrialRefusal }> {
  const days = autoTrialDays();
  const nameKey = clan.kind === 'creator' ? null : inGameNameKey(clan.inGameName);
  const decision = autoTrialDecision({
    days,
    clanHadTrial: days > 0 && (await hadPlanTrial(clan.id, tx)),
    hadMembership: days > 0 && (await hadMembership(clan.id, tx)),
    nameHadTrial: days > 0 && !!nameKey && (await nameUsedTrial(nameKey, tx)),
    ownerDeletedTrialed: days > 0 && ownerUserId != null && (await ownerDeletedTrialedClan(ownerUserId, tx)),
  });
  if (!decision.grant) return { granted: false, reason: decision.reason };

  const tier = topTrialTier(clan.kind);
  const endsAt = new Date(now + days * 86_400_000);
  const [row] = await tx
    .insert(ownerTrials)
    .values({ kind: 'plan', clanId: clan.id, tier, days, note: AUTO_TRIAL_NOTE, startsAt: new Date(now), endsAt, grantedBy: null })
    .returning({ id: ownerTrials.id });
  await tx.insert(clanAuditLog).values({
    clanId: clan.id,
    eventType: 'owner_trial_granted',
    actorUserId: null,
    newValue: JSON.stringify({ trialId: row.id, kind: 'plan', clanId: clan.id, tier, days, endsAt: endsAt.toISOString(), source: AUTO_TRIAL_NOTE }),
    notes: 'automatic',
  });
  return { granted: true, tier, endsAt };
}

/** Did a since-deleted clan with this verified in-game name use a trial? */
async function nameUsedTrial(nameKey: string, reader: Reader = db): Promise<boolean> {
  // clan-scope: global -- the platform's own record, which outlives the deleted clan.
  const [r] = await reader
    .select({ id: clanAuditLog.id })
    .from(clanAuditLog)
    .where(and(isNull(clanAuditLog.clanId), eq(clanAuditLog.eventType, USED_EVENT), eq(clanAuditLog.notes, `ign:${nameKey}`)))
    .limit(1);
  return !!r;
}

/**
 * Has this person DELETED a clan or space that had used its automatic trial? The delete-and-create-
 * again loop, closed: their next clan starts on Free (staff can still grant a trial by hand). Someone
 * who simply makes a second clan is not affected.
 */
export async function ownerDeletedTrialedClan(userId: number, reader: Reader = db): Promise<boolean> {
  // clan-scope: global -- the platform's own record, which outlives the deleted clan.
  const [r] = await reader
    .select({ id: clanAuditLog.id })
    .from(clanAuditLog)
    .where(and(isNull(clanAuditLog.clanId), eq(clanAuditLog.eventType, USED_EVENT), eq(clanAuditLog.actorUserId, userId), eq(clanAuditLog.notes, OWNER_NOTE)))
    .limit(1);
  return !!r;
}

/** For the create screens: will a clan or space this person makes now start the automatic trial, and for how long? */
export async function autoTrialOfferFor(userId: number | null): Promise<{ days: number; reason: null | 'off' | 'owner-deleted-trialed' }> {
  const days = autoTrialDays();
  if (days <= 0) return { days: 0, reason: 'off' };
  if (userId != null && (await ownerDeletedTrialedClan(userId))) return { days: 0, reason: 'owner-deleted-trialed' };
  return { days, reason: null };
}

/**
 * Call just BEFORE a clan is deleted (its trial rows are about to cascade away). The platform log,
 * which has no clan and so outlives it, remembers two things:
 *  - if it had ANY plan trial and its in-game name was verified: that name used one ('ign:<name>');
 *  - if it had used its AUTOMATIC trial: each of its owners deleted a trialed clan ('owner'), so
 *    deleting a clan and making another does not start a fresh trial. This does not depend on the
 *    name being verified, so changing or un-verifying the name before deleting escapes nothing.
 */
export async function rememberTrialBeforeDelete(
  reader: Reader,
  clan: { id: number; kind: string | null; inGameName: string | null; ingameNameVerifiedAt: string | null },
): Promise<void> {
  const trials = await reader
    .select({ grantedBy: ownerTrials.grantedBy, note: ownerTrials.note })
    .from(ownerTrials)
    .where(and(eq(ownerTrials.kind, 'plan'), eq(ownerTrials.clanId, clan.id)));
  if (trials.length === 0) return;
  const nameKey = clan.kind === 'creator' || !clan.ingameNameVerifiedAt ? null : inGameNameKey(clan.inGameName);
  const value = JSON.stringify({ clanId: clan.id, inGameName: clan.inGameName });
  const rows: (typeof clanAuditLog.$inferInsert)[] = [];
  if (nameKey) rows.push({ clanId: null, eventType: USED_EVENT, newValue: value, notes: `ign:${nameKey}` });
  if (trials.some((t) => t.grantedBy == null && t.note === AUTO_TRIAL_NOTE)) {
    const owners = await reader.select({ userId: clanStaff.userId }).from(clanStaff).where(and(eq(clanStaff.clanId, clan.id), eq(clanStaff.role, 'owner')));
    for (const o of owners) rows.push({ clanId: null, eventType: USED_EVENT, actorUserId: o.userId, newValue: value, notes: OWNER_NOTE });
  }
  if (rows.length) await reader.insert(clanAuditLog).values(rows);
}

/**
 * Of these clans, the ones whose in-game name already used a trial on a clan since deleted: they
 * named or verified it after their own trial started. Nothing is taken back; staff see the flag.
 */
export async function repeatNameClans(rows: { id: number; kind: string | null; inGameName: string | null }[]): Promise<Set<number>> {
  const keyed = rows.map((c) => ({ id: c.id, key: c.kind === 'creator' ? null : inGameNameKey(c.inGameName) })).filter((c): c is { id: number; key: string } => !!c.key);
  if (keyed.length === 0) return new Set();
  // clan-scope: global -- the platform's own record of names that used a trial.
  const used = await db
    .select({ notes: clanAuditLog.notes })
    .from(clanAuditLog)
    .where(and(isNull(clanAuditLog.clanId), eq(clanAuditLog.eventType, USED_EVENT), inArray(clanAuditLog.notes, keyed.map((c) => `ign:${c.key}`))));
  const names = new Set(used.map((u) => u.notes));
  return new Set(keyed.filter((c) => names.has(`ign:${c.key}`)).map((c) => c.id));
}

/**
 * A membership bought but not yet charged: Gumroad opened it with a free period while the row stays on
 * its free tier until the first payment (the plan page and the portal show the "starts when your first
 * payment goes through" notice). While that is so, nothing else on the page asks them to subscribe.
 */
export async function membershipHeld(clanId: number, now = Date.now()): Promise<boolean> {
  // clan-scope: explicit -- the caller's own clan id.
  const [r] = await db.select({ sub: clans.gumroadSubscriptionId, trialEndsAt: clans.trialEndsAt }).from(clans).where(eq(clans.id, clanId)).limit(1);
  const ends = r?.trialEndsAt ? Date.parse(r.trialEndsAt) : NaN;
  return !!r?.sub && ends > now;
}

/** Is `tier` one a plan trial may lend a row of this kind? */
export function isTrialTier(kind: string | null | undefined, tier: unknown): tier is string {
  return typeof tier === 'string' && trialTierIds(kind).includes(tier);
}

/** "Remind me when the trial ends": recorded on the running trial. False when there is none. */
export async function requestPlanTrialReminder(clanId: number, now = Date.now()): Promise<boolean> {
  const done = await db
    .update(ownerTrials)
    .set({ remindRequestedAt: new Date(now) })
    .where(and(eq(ownerTrials.kind, 'plan'), eq(ownerTrials.clanId, clanId), isNull(ownerTrials.revokedAt), sql`${ownerTrials.endsAt} > ${new Date(now).toISOString()}`))
    .returning({ id: ownerTrials.id });
  return done.length > 0;
}
