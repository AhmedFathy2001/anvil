// Staff Supporter gifts, the pure half (lib/supporterGifts does the reads and writes;
// tests/supporter-gift-rules.test.ts).
//
// A gift is its own supporter_subscriptions row (status 'granted', recurrence 'gift'), laid over
// whatever the person pays for: it never edits the paid row. The best tier in force wins, so a gift
// above the paid tier shows until it ends or is ended, then the paid tier (if still paid) is back.

import { GIFT_RECURRENCE, QUEUED_STATUS, SUPPORTER_TIERS, parseStamp, rowInForce, type SupporterRowLike, type SupporterTierId } from './supporterTiers.ts';

export interface StandingRow extends SupporterRowLike {
  id?: number;
}

export interface SupporterStanding {
  /** The best tier they PAY for right now (Gumroad or lab rows: anything not handed out), or null. */
  paid: SupporterTierId | null;
  /** The best invite-reward tier in force, or null. */
  earned: SupporterTierId | null;
  /** The best staff gift in force, or null; `id` is its row, `endsAt` when it runs out. */
  gift: { tier: SupporterTierId; id: number | null; endsAt: string | null } | null;
  /** The tier they wear right now (the best of the three), or null. */
  effective: SupporterTierId | null;
  /** Where the effective tier comes from: a gift only when it is strictly above paid and earned. */
  source: 'paid' | 'earned' | 'gift' | null;
}

const rank = (t: SupporterTierId | null) => (t ? SUPPORTER_TIERS[t].rank : 0);

function best<T extends StandingRow>(rows: T[]): T | null {
  return rows.reduce<T | null>((a, r) => (!a || rank(r.tier as SupporterTierId) > rank(a.tier as SupporterTierId) ? r : a), null);
}

/** What a person pays for, what Anvil has given them, and which one they wear, at `now`. */
export function supporterStanding(rows: StandingRow[], now = Date.now()): SupporterStanding {
  const live = rows.filter((r) => rowInForce(r, now));
  const isGift = (r: StandingRow) => r.status === 'granted' && r.recurrence === GIFT_RECURRENCE;
  const paidRow = best(live.filter((r) => r.status !== 'granted'));
  const earnedRow = best(live.filter((r) => r.status === 'granted' && !isGift(r)));
  const giftRow = best(live.filter(isGift));
  const paid = (paidRow?.tier as SupporterTierId | undefined) ?? null;
  const earned = (earnedRow?.tier as SupporterTierId | undefined) ?? null;
  const giftTier = (giftRow?.tier as SupporterTierId | undefined) ?? null;
  const top = Math.max(rank(paid), rank(earned), rank(giftTier));
  // Ties go to what they pay for, then invite time: a gift only "lifts" someone it puts higher.
  const source = top === 0 ? null : rank(paid) === top ? 'paid' : rank(earned) === top ? 'earned' : 'gift';
  return {
    paid,
    earned,
    gift: giftRow ? { tier: giftTier!, id: giftRow.id ?? null, endsAt: giftRow.currentPeriodEnd } : null,
    effective: source === 'paid' ? paid : source === 'earned' ? earned : source === 'gift' ? giftTier : null,
    source,
  };
}

// =============================================================================
// The two things a staff gift can be
// =============================================================================
//
//   'lift'  until a date the person has AT LEAST this tier, laid over whatever they pay for. Two
//           lifts overlap; the best tier in force wins. What a gift always was.
//   'add'   N days ADDED to what they hold at this tier, never overlapping:
//             - they PAY through Gumroad for this tier: the site cannot delay Gumroad's next charge,
//               so the days are stored (a 'queued' row, in force for nobody) and start when that
//               paid membership stops, carrying them on for free if they stop paying;
//             - they hold a staff gift or Anvil trial at this tier: its end moves out by N;
//             - otherwise a fresh entitlement for N days, starting after any other free time they
//               hold at this tier (a gift someone bought them, invite time) so none of it is lost.

export type GiftMode = 'lift' | 'add';

export interface GiftPlanRow extends StandingRow {
  id: number;
  gumroadSubscriptionId?: string | null;
  queuedDays?: number | null;
}

const DAY_MS = 86_400_000;
const isStaffGift = (r: StandingRow) => r.recurrence === GIFT_RECURRENCE;

/** The Gumroad membership they pay for AT this tier right now, or null. */
export function paidAtTier<T extends GiftPlanRow>(rows: T[], tier: SupporterTierId, now = Date.now()): T | null {
  return rows.find((r) => r.tier === tier && !!r.gumroadSubscriptionId && (r.status === 'active' || r.status === 'cancelling') && rowInForce(r, now)) ?? null;
}

/**
 * The Gumroad membership they pay for at this tier OR A HIGHER ONE right now, or null. What stored
 * "add time" waits on: someone who upgraded from Supporter to Champion is still paying, and their
 * stored Supporter time must not start (and run out unseen) underneath the Champion they pay for.
 * Pass every login of the PERSON: the membership may sit on another login of theirs.
 */
export function paidAtOrAbove<T extends GiftPlanRow>(rows: T[], tier: SupporterTierId, now = Date.now()): T | null {
  return (
    rows.find(
      (r) => r.tier in SUPPORTER_TIERS && rank(r.tier as SupporterTierId) >= rank(tier) && !!r.gumroadSubscriptionId && (r.status === 'active' || r.status === 'cancelling') && rowInForce(r, now),
    ) ?? null
  );
}

export type AddTimePlan =
  /** They pay for this tier: stored to begin when the paid membership stops. `queuedId` is an existing stored row to add to. */
  | { kind: 'queue'; queuedId: number | null; queuedDays: number; paidUntil: string | null; cancelling: boolean }
  /** A running staff gift or trial at this tier: its end moves from `from` to `to`. */
  | { kind: 'extend'; giftId: number; from: string; to: string }
  /** Nothing of ours at this tier: a new entitlement from now to `to` (`after` = other free time at this tier it runs on from). */
  | { kind: 'new'; from: string; to: string; after: string | null }
  /** A staff gift at this tier with no end date: there is nothing to add to. */
  | { kind: 'endless'; giftId: number };

/** What "add N days at this tier" will do to this person, before it is done (and what giveGift then does). */
export function planAddTime(rows: GiftPlanRow[], tier: SupporterTierId, days: number, now = Date.now()): AddTimePlan {
  const paid = paidAtTier(rows, tier, now);
  if (paid) {
    const queued = rows.find((r) => r.tier === tier && r.status === QUEUED_STATUS && isStaffGift(r)) ?? null;
    return { kind: 'queue', queuedId: queued?.id ?? null, queuedDays: (queued?.queuedDays ?? 0) + days, paidUntil: paid.currentPeriodEnd, cancelling: paid.status === 'cancelling' };
  }
  const live = rows.filter((r) => r.tier === tier && r.status === 'granted' && rowInForce(r, now));
  const gifts = live.filter(isStaffGift);
  const endless = gifts.find((r) => Number.isNaN(parseStamp(r.currentPeriodEnd)));
  if (endless) return { kind: 'endless', giftId: endless.id };
  const gift = gifts.sort((a, b) => parseStamp(b.currentPeriodEnd) - parseStamp(a.currentPeriodEnd))[0];
  if (gift) {
    const end = parseStamp(gift.currentPeriodEnd);
    return { kind: 'extend', giftId: gift.id, from: new Date(end).toISOString(), to: new Date(end + days * DAY_MS).toISOString() };
  }
  // Other free time at this tier (a paid-for gift, invite time): the new days run on after it.
  const others = live.map((r) => parseStamp(r.currentPeriodEnd)).filter((t) => !Number.isNaN(t));
  const after = others.length ? Math.max(...others) : null;
  const base = Math.max(now, after ?? now);
  return { kind: 'new', from: new Date(now).toISOString(), to: new Date(base + days * DAY_MS).toISOString(), after: after != null ? new Date(after).toISOString() : null };
}

/** Would lifting them to this tier change what they wear? Not when they already hold it or better. */
export function liftChangesNothing(standing: SupporterStanding, tier: SupporterTierId): boolean {
  return rank(standing.effective) >= rank(tier);
}

const dayMonth = (iso: string | null | undefined) => {
  const ms = parseStamp(iso);
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const nameOf = (t: SupporterTierId | null) => (t ? SUPPORTER_TIERS[t].name : null);
/** "3 months" for a whole number of 30-day months, else "45 days". */
export function lengthWords(days: number): string {
  if (days >= 30 && days % 30 === 0) return `${days / 30} month${days === 30 ? '' : 's'}`;
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** What they have now, for the sentence staff read: "Has Supporter (paid)." */
function hasWords(s: SupporterStanding): string {
  if (!s.effective) return 'Has no Supporter tier.';
  const how = s.source === 'paid' ? 'paid' : s.source === 'earned' ? 'invite time' : 'a gift from Anvil';
  return `Has ${nameOf(s.effective)} (${how}).`;
}

/**
 * The plain sentence the staff form shows BEFORE saving a lift (dates in UTC; the form says so).
 * `nothing` = it would change nothing visible, and needs a second deliberate click.
 */
export function liftPreview(standing: SupporterStanding, tier: SupporterTierId, endsAt: string): { text: string; nothing: boolean } {
  const name = SUPPORTER_TIERS[tier].name;
  const until = dayMonth(endsAt);
  if (liftChangesNothing(standing, tier)) {
    return {
      nothing: true,
      text: `${hasWords(standing)} A lift to ${name} until ${until} changes nothing they can see, because they already have ${nameOf(standing.effective)}. It would only matter if that stopped before ${until}.`,
    };
  }
  const paying = standing.paid ? ' Their own membership and its charges are unchanged.' : '';
  return { nothing: false, text: `${hasWords(standing)} This lifts them to ${name} until ${until}.${paying}` };
}

/** The same for "add time". */
export function addTimePreview(plan: AddTimePlan, tier: SupporterTierId, days: number): string {
  const name = SUPPORTER_TIERS[tier].name;
  const len = lengthWords(days);
  switch (plan.kind) {
    case 'queue': {
      const until = dayMonth(plan.paidUntil);
      const total = plan.queuedDays !== days ? ` With what is already stored, that is ${lengthWords(plan.queuedDays)} in all.` : '';
      return `They pay for ${name} through Gumroad${until ? ` (${plan.cancelling ? 'cancelled, paid until' : 'next charge'} ${until})` : ''}. Anvil cannot delay Gumroad's charges, so nothing changes today and they keep being charged as before. The ${len} is stored and starts the day their paid ${name} stops, so it carries them on for free if they stop paying.${total}`;
    }
    case 'extend':
      return `They hold ${name} from Anvil until ${dayMonth(plan.from)}. This moves that end out by ${len}, to ${dayMonth(plan.to)}.`;
    case 'new':
      return plan.after
        ? `They hold other free ${name} time until ${dayMonth(plan.after)}. This adds ${len} after it: ${name} from Anvil until ${dayMonth(plan.to)}.`
        : `They hold nothing at ${name}. This gives ${name} for ${len}, from today until ${dayMonth(plan.to)}.`;
    case 'endless':
      return `They already hold ${name} from Anvil with no end date, so there is nothing to add to.`;
  }
}

/** What the PERSON reads on their plan page about a gift from Anvil that is in force or stored. */
export function giftLineForPerson(g: { tier: SupporterTierId; endsAt: string | null; queuedDays: number | null; queued: boolean }): string {
  const name = SUPPORTER_TIERS[g.tier].name;
  if (g.queued) return `${lengthWords(g.queuedDays ?? 0)} of ${name} added by Anvil, starting when your membership ends.`;
  const until = dayMonth(g.endsAt);
  return until ? `A gift from Anvil: ${name} until ${until}.` : `A gift from Anvil: ${name}.`;
}

// =============================================================================
// Who granted / ended a gift (from the audit log rows supporterGifts writes)
// =============================================================================

export interface GiftAuditRow {
  eventType: string;
  actorName: string | null;
  /** clan_audit_log.new_value, JSON. */
  newValue: string | null;
  occurredAt: string;
}

export interface GiftLike {
  id: number;
  tier: string;
  startedAt: string;
}

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stamp(s: string): number {
  return Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
}

/** Grant entries written before they carried the gift id are matched by tier and time (within this). */
const LEGACY_MATCH_MS = 5 * 60_000;

/**
 * Who granted each gift and who ended it early, from its audit entries. A grant names its gift id;
 * an older grant without one is matched to the same tier's gift started closest in time (within a few
 * minutes). `actorName` null on a matched entry means the staff login was since deleted.
 */
export function giftSources(gifts: GiftLike[], audit: GiftAuditRow[]): Map<number, { grantedBy: string | null; endedBy: string | null; note: string | null }> {
  const out = new Map<number, { grantedBy: string | null; endedBy: string | null; note: string | null }>();
  for (const g of gifts) out.set(g.id, { grantedBy: null, endedBy: null, note: null });
  const claimed = new Set<number>();
  const legacy: { row: GiftAuditRow; v: Record<string, unknown> }[] = [];
  for (const row of audit) {
    const v = parseJson(row.newValue);
    if (!v) continue;
    const id = typeof v.giftId === 'number' ? v.giftId : null;
    if (row.eventType === 'supporter_gift_ended' && id != null && out.has(id)) {
      out.get(id)!.endedBy = row.actorName ?? 'a deleted login';
    } else if (row.eventType === 'supporter_gift_granted') {
      if (id != null && out.has(id)) {
        Object.assign(out.get(id)!, { grantedBy: row.actorName ?? 'a deleted login', note: typeof v.note === 'string' ? v.note : null });
        claimed.add(id);
      } else if (id == null) legacy.push({ row, v });
    }
  }
  for (const { row, v } of legacy) {
    const at = stamp(row.occurredAt);
    let pick: GiftLike | null = null;
    let gap = Infinity;
    for (const g of gifts) {
      if (claimed.has(g.id) || g.tier !== v.tier) continue;
      const d = Math.abs(stamp(g.startedAt) - at);
      if (d <= LEGACY_MATCH_MS && d < gap) [pick, gap] = [g, d];
    }
    if (!pick) continue;
    claimed.add(pick.id);
    Object.assign(out.get(pick.id)!, { grantedBy: row.actorName ?? 'a deleted login', note: typeof v.note === 'string' ? v.note : null });
  }
  return out;
}

/**
 * Which option each gift was given with, and the time added to it since: from the same audit
 * entries. A grant from before the option existed is a lift (what every gift was then).
 */
export function giftModes(gifts: GiftLike[], audit: GiftAuditRow[]): Map<number, { mode: GiftMode; addedDays: number }> {
  const out = new Map<number, { mode: GiftMode; addedDays: number }>();
  for (const g of gifts) out.set(g.id, { mode: 'lift', addedDays: 0 });
  for (const row of audit) {
    const v = parseJson(row.newValue);
    const id = v && typeof v.giftId === 'number' ? v.giftId : null;
    if (!v || id == null || !out.has(id)) continue;
    if (row.eventType === 'supporter_gift_granted' && v.mode === 'add') out.get(id)!.mode = 'add';
    if (row.eventType === 'supporter_gift_extended' && typeof v.days === 'number') out.get(id)!.addedDays += v.days;
  }
  return out;
}
