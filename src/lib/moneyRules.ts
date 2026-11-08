// Owner money: the pure half (no database), so tests can run it and nothing here can leak.
//
// Money is integer cents PER CURRENCY and is never added across currencies. Anything not read off a
// Gumroad notification (lib/moneyLedger) is an ESTIMATE from the catalogue price and carries
// `estimated: true` so the page can say so.

import { LEVEL_AT } from './clanBoostRules.ts';
import { SUPPORTER_TIERS, parseStamp, type SupporterTierId } from './supporterTiers.ts';

export type ProductKey = 'supporter' | 'hosted' | 'creator' | 'boost' | 'other';
export const PRODUCT_LABEL: Record<ProductKey, string> = {
  supporter: 'Supporter tiers',
  hosted: 'Hosted plans (clans)',
  creator: 'Creator spaces',
  boost: 'Clan boosts',
  other: 'Other',
};
export const DAY = 86_400_000;

export interface MoneyEvent {
  key: string;
  at: number;
  /** charge = money in; refund = money back out (refund and dispute). */
  kind: 'charge' | 'refund';
  cents: number;
  /** Gumroad's fee when it told us; null = unknown (counted as 0, flagged). */
  feeCents: number | null;
  currency: string;
  product: ProductKey;
  label: string;
  estimated: boolean;
  /** billing_ledger id, for the click-through. Estimated events have none. */
  ledgerId: number | null;
}

export interface Bucket {
  gross: number;
  refunds: number;
  fees: number;
  net: number;
  /** Part of gross/refunds that is estimated. */
  estimatedGross: number;
  estimatedRefunds: number;
  feesUnknown: boolean;
  count: number;
}
export type ByCurrency = Record<string, Bucket>;

const emptyBucket = (): Bucket => ({ gross: 0, refunds: 0, fees: 0, net: 0, estimatedGross: 0, estimatedRefunds: 0, feesUnknown: false, count: 0 });

export function aggregate(events: MoneyEvent[], from: number, to: number): ByCurrency {
  const out: ByCurrency = {};
  for (const e of events) {
    if (e.at < from || e.at >= to) continue;
    const b = (out[e.currency] ??= emptyBucket());
    if (e.kind === 'charge') {
      b.gross += e.cents;
      b.count += 1;
      if (e.estimated) b.estimatedGross += e.cents;
      if (e.feeCents == null) b.feesUnknown = true;
      else b.fees += e.feeCents;
    } else {
      b.refunds += e.cents;
      if (e.estimated) b.estimatedRefunds += e.cents;
    }
  }
  for (const b of Object.values(out)) b.net = b.gross - b.refunds - b.fees;
  return out;
}

export interface Periods { today: ByCurrency; last7: ByCurrency; last30: ByCurrency; thisMonth: ByCurrency; lastMonth: ByCurrency; allTime: ByCurrency }

/** All periods in UTC. Last 7/30 are rolling windows ending now; "today" starts at 00:00 UTC. */
export function periodsAt(events: MoneyEvent[], now: number): Periods {
  const d = new Date(now);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const lastMonthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
  const end = now + 1;
  return {
    today: aggregate(events, dayStart, end),
    last7: aggregate(events, now - 7 * DAY, end),
    last30: aggregate(events, now - 30 * DAY, end),
    thisMonth: aggregate(events, monthStart, end),
    lastMonth: aggregate(events, lastMonthStart, monthStart),
    allTime: aggregate(events, -Infinity, end),
  };
}

export function splitByProduct(events: MoneyEvent[], from: number, to: number): Record<string, ByCurrency> {
  const out: Record<string, ByCurrency> = {};
  for (const p of Object.keys(PRODUCT_LABEL) as ProductKey[]) out[p] = aggregate(events.filter((e) => e.product === p), from, to);
  return out;
}

// ── Prices ──────────────────────────────────────────────────────────────────────────────────

export const usdCents = (usd: number | null | undefined): number => Math.round((usd ?? 0) * 100);

/** Catalogue price of a Supporter tier for a recurrence; yearly only when the row says so. */
export function supporterPriceCents(tier: string, recurrence: string | null | undefined): number | null {
  const t = SUPPORTER_TIERS[tier as SupporterTierId];
  if (!t) return null;
  return usdCents(recurrence === 'yearly' ? t.yearlyUsd : t.monthlyUsd);
}

/** A boost level is lifted by LEVEL_AT[level-1] boosts; a boost is one Champion slot, so price it so. ESTIMATE. */
export function boostLevelValueCents(level: number): number {
  const need = LEVEL_AT[Math.min(3, Math.max(1, level)) - 1] ?? 0;
  return need * usdCents(SUPPORTER_TIERS.champion.monthlyUsd);
}

/** Monthly value of a charge: yearly spread over 12, anything else as monthly. */
export function monthlyCents(cents: number, recurrence: string | null | undefined): number {
  return recurrence === 'yearly' ? Math.round(cents / 12) : cents;
}

function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime();
}
export const stepFor = (ms: number, recurrence: string | null | undefined, n: number) => addMonths(ms, recurrence === 'yearly' ? 12 * n : n);

// ── Estimated history (before the ledger existed) ──────────────────────────────────────────

export interface SupporterRow {
  id: number; userId: number; tier: string; status: string; recurrence: string | null;
  startedAt: string; endedAt: string | null; currentPeriodEnd: string | null; gumroadSubscriptionId: string | null;
}
export interface ClanRow {
  id: number; name: string; kind: string; plan: string; status: string; priceUsd: number | null; free: boolean;
  gumroadSubscriptionId: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; trialEndsAt: string | null;
}

/** A Supporter row someone paid for (not staff time, not invite time). */
export const isPaidSupporter = (r: Pick<SupporterRow, 'status' | 'recurrence' | 'gumroadSubscriptionId'>) =>
  r.status !== 'granted' && r.recurrence !== 'gift' && r.recurrence !== 'invite' && !!r.recurrence && (['active', 'cancelling', 'ended', 'refunded'] as string[]).includes(r.status);

const MAX_CHARGES = 240;

/**
 * Charges and refunds we can infer for time BEFORE `before` (the first ledger row). Supporter: one
 * charge per period from `startedAt` until it ended. Clan: only the current period's charge (the
 * table keeps no start date). Both ESTIMATED; renewals Gumroad skipped or retried are not known.
 */
export function estimateHistory(supporters: SupporterRow[], clanRows: ClanRow[], before: number, now: number): MoneyEvent[] {
  const out: MoneyEvent[] = [];
  const cut = Math.min(before, now + 1);
  for (const r of supporters) {
    if (!isPaidSupporter(r)) continue;
    const price = supporterPriceCents(r.tier, r.recurrence);
    const start = parseStamp(r.startedAt);
    if (price == null || Number.isNaN(start)) continue;
    const ended = parseStamp(r.endedAt);
    const last = r.status === 'ended' || r.status === 'refunded' ? (Number.isNaN(ended) ? start : ended) : now;
    let lastCharge: MoneyEvent | null = null;
    for (let n = 0; n < MAX_CHARGES; n++) {
      const at = stepFor(start, r.recurrence, n);
      if (at > last || at >= cut) break;
      lastCharge = { key: `est-s${r.id}-${n}`, at, kind: 'charge', cents: price, feeCents: null, currency: 'usd', product: 'supporter', label: SUPPORTER_TIERS[r.tier as SupporterTierId].name, estimated: true, ledgerId: null };
      out.push(lastCharge);
    }
    if (r.status === 'refunded' && lastCharge && !Number.isNaN(ended) && ended < cut) {
      out.push({ ...lastCharge, key: `est-s${r.id}-refund`, at: ended, kind: 'refund' });
    }
  }
  for (const c of clanRows) {
    if (c.free || !c.gumroadSubscriptionId || c.priceUsd == null) continue;
    const end = parseStamp(c.currentPeriodEnd);
    if (Number.isNaN(end)) continue;
    const at = addMonths(end, -1); // the recurrence is not stored on the clan: monthly assumed
    if (at > now || at >= cut) continue;
    out.push({ key: `est-c${c.id}`, at, kind: 'charge', cents: usdCents(c.priceUsd), feeCents: null, currency: 'usd', product: c.kind === 'creator' ? 'creator' : 'hosted', label: c.name, estimated: true, ledgerId: null });
  }
  return out;
}

// ── Recurring revenue ───────────────────────────────────────────────────────────────────────

export interface LedgerPrice { cents: number; currency: string; recurrence: string | null }
export interface Sub {
  key: string; product: ProductKey; label: string; cents: number; currency: string; recurrence: string | null;
  cancelling: boolean; renewsAt: number | null; estimated: boolean;
}

/** Active paid subscriptions, priced from their last real charge when the ledger has one, else the catalogue. */
export function activeSubs(supporters: SupporterRow[], clanRows: ClanRow[], lastPrice: Map<string, LedgerPrice>, now: number): Sub[] {
  const out: Sub[] = [];
  for (const r of supporters) {
    if (r.status !== 'active' && r.status !== 'cancelling') continue;
    if (!isPaidSupporter(r)) continue;
    const led = r.gumroadSubscriptionId ? lastPrice.get(r.gumroadSubscriptionId) : undefined;
    const cat = supporterPriceCents(r.tier, r.recurrence);
    const cents = led?.cents ?? cat;
    if (cents == null) continue;
    out.push({ key: `s${r.id}`, product: 'supporter', label: SUPPORTER_TIERS[r.tier as SupporterTierId]?.name ?? r.tier, cents, currency: led?.currency ?? 'usd', recurrence: led?.recurrence ?? r.recurrence, cancelling: r.status === 'cancelling', renewsAt: nz(parseStamp(r.currentPeriodEnd)), estimated: !led });
  }
  for (const c of clanRows) {
    if (c.free || !c.gumroadSubscriptionId || c.status === 'suspended') continue;
    const trialEnd = parseStamp(c.trialEndsAt);
    if (!Number.isNaN(trialEnd) && trialEnd > now) continue; // still a free trial: pipeline, not revenue
    const led = lastPrice.get(c.gumroadSubscriptionId);
    const cents = led?.cents ?? (c.priceUsd != null ? usdCents(c.priceUsd) : null);
    if (cents == null) continue;
    out.push({ key: `c${c.id}`, product: c.kind === 'creator' ? 'creator' : 'hosted', label: c.name, cents, currency: led?.currency ?? 'usd', recurrence: led?.recurrence ?? 'monthly', cancelling: c.cancelAtPeriodEnd, renewsAt: nz(parseStamp(c.currentPeriodEnd)), estimated: !led || !led.recurrence });
  }
  return out;
}
const nz = (n: number) => (Number.isNaN(n) ? null : n);

export function mrr(subs: Sub[]): { total: Record<string, { cents: number; estimated: number }>; atRisk: Record<string, number> } {
  const total: Record<string, { cents: number; estimated: number }> = {};
  const atRisk: Record<string, number> = {};
  for (const s of subs) {
    const m = monthlyCents(s.cents, s.recurrence);
    const t = (total[s.currency] ??= { cents: 0, estimated: 0 });
    t.cents += m;
    if (s.estimated) t.estimated += m;
    if (s.cancelling) atRisk[s.currency] = (atRisk[s.currency] ?? 0) + m;
  }
  return { total, atRisk };
}

export function upcomingRenewals(subs: Sub[], now: number, days = 30): Sub[] {
  return subs
    .filter((s) => !s.cancelling && s.renewsAt != null && s.renewsAt > now && s.renewsAt <= now + days * DAY)
    .sort((a, b) => (a.renewsAt ?? 0) - (b.renewsAt ?? 0));
}

// ── Masking ─────────────────────────────────────────────────────────────────────────────────

/** "jane.doe@mail.example.com" -> "j•••@m•••.com". Lists show this; the full address is a click away, owner only. */
export function maskEmail(email: string | null | undefined): string {
  const e = (email ?? '').trim();
  const at = e.lastIndexOf('@');
  if (at < 1) return '—';
  const local = e.slice(0, at);
  const host = e.slice(at + 1);
  const dot = host.lastIndexOf('.');
  const name = dot > 0 ? host.slice(0, dot) : host;
  const tld = dot > 0 ? host.slice(dot) : '';
  return `${local[0]}•••@${name[0] ?? ''}•••${tld}`;
}

// ── Trials ──────────────────────────────────────────────────────────────────────────────────

export type TrialStatus = 'active' | 'ending' | 'expired' | 'converted' | 'revoked';

export interface TrialFacts { endsAt: number; revokedAt: number | null; convertedAt: number | null }

/** converted beats everything but revoked; ending = active with 7 days or less left. */
export function trialStatus(t: TrialFacts, now: number): TrialStatus {
  if (t.revokedAt != null) return 'revoked';
  if (t.convertedAt != null) return 'converted';
  if (t.endsAt <= now) return 'expired';
  return t.endsAt - now <= 7 * DAY ? 'ending' : 'active';
}

/** What converting is worth per month: tier price, or the boost-level estimate. */
export function trialValueCents(kind: string, tier: string): { cents: number; estimated: boolean } {
  if (kind === 'supporter') return { cents: supporterPriceCents(tier, 'monthly') ?? 0, estimated: false };
  return { cents: boostLevelValueCents(Number(tier)), estimated: true };
}

/** Pipeline = value of the trials still running (active or ending). Revoked, expired, converted add nothing. */
export function pipelineCents(trials: { status: TrialStatus; valueCents: number }[]): number {
  return trials.filter((t) => t.status === 'active' || t.status === 'ending').reduce((n, t) => n + t.valueCents, 0);
}

export const TRIAL_MAX_DAYS = 365;
export function validTrialDays(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= TRIAL_MAX_DAYS;
}

/** A person converted if a paid Supporter row started after the trial did. */
export function supporterConverted(rows: { startedAt: string; status: string; recurrence: string | null; gumroadSubscriptionId: string | null }[], trialStart: number): boolean {
  return rows.some((r) => isPaidSupporter(r) && parseStamp(r.startedAt) >= trialStart);
}

/** A clan converted if its own boosts now reach the level the trial lent it. */
export function boostConverted(organicLevel: number, trialLevel: number): boolean {
  return organicLevel >= trialLevel && trialLevel > 0;
}
