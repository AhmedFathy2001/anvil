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
// name LATER keeps its trial; staff see it flagged in the trials view (repeatNameClans).

import { cache } from 'react';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans, ownerTrials } from '@/db/schema';
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
  now = Date.now(),
): Promise<{ granted: true; tier: string; endsAt: Date } | { granted: false; reason: AutoTrialRefusal }> {
  const days = autoTrialDays();
  const nameKey = clan.kind === 'creator' ? null : inGameNameKey(clan.inGameName);
  const decision = autoTrialDecision({
    days,
    clanHadTrial: days > 0 && (await hadPlanTrial(clan.id, tx)),
    hadMembership: days > 0 && (await hadMembership(clan.id, tx)),
    nameHadTrial: days > 0 && !!nameKey && (await nameUsedTrial(nameKey, tx)),
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
 * Call just BEFORE a clan is deleted: if it had a plan trial and its in-game name was verified, the
 * platform log remembers that name used one (the trial rows are about to cascade away).
 */
export async function rememberTrialBeforeDelete(
  reader: Reader,
  clan: { id: number; kind: string | null; inGameName: string | null; ingameNameVerifiedAt: string | null },
): Promise<void> {
  const nameKey = clan.kind === 'creator' || !clan.ingameNameVerifiedAt ? null : inGameNameKey(clan.inGameName);
  if (!nameKey || !(await hadPlanTrial(clan.id, reader))) return;
  await reader.insert(clanAuditLog).values({
    clanId: null,
    eventType: USED_EVENT,
    newValue: JSON.stringify({ clanId: clan.id, inGameName: clan.inGameName }),
    notes: `ign:${nameKey}`,
  });
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
