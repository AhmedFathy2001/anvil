// Anvil Supporter tiers: the pure half (no database), so tests and client components can import it.
//
// Supporter is a PERSONAL subscription, separate from the clan plans in lib/plans. It never changes
// tracking, scoring or anything about an event; it buys flair and hosting room. Three tiers, each a
// superset of the one below. Prices live on Gumroad (one product, three tiers, monthly and yearly);
// they are repeated here only for display.

import { SUPPORTER_INK, effectiveSupporterStyle, parseSupporterStyle, presetById, type SupporterStyle } from './supporterStyle.ts';

export type SupporterTierId = 'supporter' | 'champion' | 'patron';

export interface SupporterTier {
  id: SupporterTierId;
  name: string;
  /** Higher outranks lower when a person somehow holds two at once. */
  rank: number;
  monthlyUsd: number;
  yearlyUsd: number;
}

export const SUPPORTER_TIERS: Record<SupporterTierId, SupporterTier> = {
  supporter: { id: 'supporter', name: 'Supporter', rank: 1, monthlyUsd: 1, yearlyUsd: 10 },
  champion: { id: 'champion', name: 'Champion', rank: 2, monthlyUsd: 2, yearlyUsd: 20 },
  patron: { id: 'patron', name: 'Patron', rank: 3, monthlyUsd: 5, yearlyUsd: 50 },
};

export const SUPPORTER_TIER_ORDER: SupporterTierId[] = ['supporter', 'champion', 'patron'];

// Name colours: each tier's default ink, the presets and a person's own choice (lib/supporterStyle).
export { SUPPORTER_INK } from './supporterStyle.ts';

/**
 * Re-key a tier map (keyed by normalised RSN) by the names exactly as a page spells them, so a client
 * component can look a row up by its own `rsn` without the normaliser. Only supporters appear, so
 * the record stays small however long the list.
 */
export function tiersByName<T = SupporterTierId>(
  names: string[],
  tiers: Map<string, T>,
  normalize: (name: string) => string,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const name of names) {
    const tier = tiers.get(normalize(name));
    if (tier) out[name] = tier;
  }
  return out;
}

/** The tier a Gumroad tier name means ("Champion" → champion). Unknown names are null, never a guess. */
export function supporterTierForGumroad(name: string | null | undefined): SupporterTierId | null {
  const key = (name ?? '').trim().toLowerCase();
  return SUPPORTER_TIER_ORDER.find((id) => SUPPORTER_TIERS[id].name.toLowerCase() === key) ?? null;
}

/** supporter_subscriptions.recurrence of a staff gift. */
export const GIFT_RECURRENCE = 'gift';
/** …of a gift another person paid for (lib/supporterGiftPurchase). */
export const PAID_GIFT_RECURRENCE = 'gift-paid';
const isGiftRecurrence = (r: string | null | undefined) => r === GIFT_RECURRENCE || r === PAID_GIFT_RECURRENCE;

export type SupporterStatus = 'active' | 'cancelling' | 'granted' | 'ended' | 'refunded';

/** The fields of a supporter_subscriptions row that decide what it is worth right now. */
export interface SupporterRowLike {
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
  startedAt: string;
  /** When the current unbroken paid run began (drizzle/0253); falls back to startedAt. */
  tenureStartedAt?: string | null;
  endedAt?: string | null;
  /** 'monthly' | 'yearly', 'referral…', 'gift' (staff, lib/supporterGifts), 'lab'. */
  recurrence?: string | null;
  /** The owning login's users.supporter_style (JSON), when the read joined it. */
  style?: string | null;
  /** The owning login, when the read has it (ties between a person's logins). */
  userId?: number | null;
}

export interface SupporterState {
  tier: SupporterTier;
  /** When the earliest membership started, for "supporter since" and tenure flair. */
  since: string;
  /** Months since `since`, whole months only. */
  months: number;
  /** Whole months of unbroken PAID support (tenureStart): what the star's shape grows with. */
  tenureMonths: number;
  /** The tenure step that shape is, and the one after it (null at Legend). */
  tenure: TenureStep;
  nextTenure: TenureStep | null;
  /** The row in force is cancelled and ends at its period end. */
  endsAt: string | null;
  renewsAt: string | null;
  /** The tier in force is time earned through invites (lib/referrals), not a subscription. */
  earned: boolean;
  /** The tier in force is a gift: from Anvil staff (lib/supporterGifts) or paid for by someone else. */
  gift: boolean;
  /** Their name colours as worn at this tier (already gated: a lapsed Patron's custom is gone). */
  style: SupporterStyle | null;
}

/** Parse either stored timestamp shape ('YYYY-MM-DD HH:MM:SS' or ISO) as UTC. */
export function parseStamp(stamp: string | null | undefined): number {
  if (!stamp) return NaN;
  const iso = stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`;
  return Date.parse(iso);
}

/** Does this row grant its tier at `now`? */
export function rowInForce(row: SupporterRowLike, now: number): boolean {
  if (!(row.tier in SUPPORTER_TIERS)) return false;
  if (row.status === 'active') return true;
  if (row.status === 'cancelling' || row.status === 'granted') {
    // They paid for the term; it stops when the term does. No end on record means we cannot say when
    // it runs out, so it counts until Gumroad tells us it ended.
    const end = parseStamp(row.currentPeriodEnd);
    return Number.isNaN(end) || end > now;
  }
  return false;
}

/** Whole months between two instants, counted by calendar month. */
export function wholeMonths(fromMs: number, toMs: number): number {
  if (!(toMs > fromMs)) return 0;
  const a = new Date(fromMs);
  const b = new Date(toMs);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/**
 * A person's supporter state from all their rows, or null when nothing is in force. The best tier
 * in force wins; "since" is the first row ever, refunded ones excluded (money taken back is not
 * tenure).
 */
function betterRow(b: SupporterRowLike, a: SupporterRowLike): boolean {
  const rb = SUPPORTER_TIERS[b.tier as SupporterTierId].rank;
  const ra = SUPPORTER_TIERS[a.tier as SupporterTierId].rank;
  if (rb !== ra) return rb > ra;
  if (!!b.style !== !!a.style) return !!b.style;
  return (b.userId ?? Infinity) < (a.userId ?? Infinity);
}

export function supporterState(rows: SupporterRowLike[], now = Date.now()): SupporterState | null {
  const live = rows.filter((r) => rowInForce(r, now));
  if (live.length === 0) return null;
  // The best tier; between equal tiers (one person, several logins) the one with chosen colours,
  // then the oldest login: a fixed answer, so every read of the same person paints them the same.
  const best = live.reduce((a, b) => (betterRow(b, a) ? b : a));
  const starts = rows
    .filter((r) => r.status !== 'refunded')
    .map((r) => parseStamp(r.startedAt))
    .filter((t) => !Number.isNaN(t));
  const sinceMs = starts.length ? Math.min(...starts) : parseStamp(best.startedAt);
  const run = paidRunStart(rows, now);
  const tenureMonths = run == null ? 0 : wholeMonths(run, now);
  const { step, next } = tenureFor(tenureMonths);
  return {
    tier: SUPPORTER_TIERS[best.tier as SupporterTierId],
    since: new Date(sinceMs).toISOString(),
    months: wholeMonths(sinceMs, now),
    tenureMonths,
    tenure: step,
    nextTenure: next,
    endsAt: best.status === 'cancelling' || best.status === 'granted' ? best.currentPeriodEnd : null,
    renewsAt: best.status === 'active' ? best.currentPeriodEnd : null,
    earned: best.status === 'granted' && !isGiftRecurrence(best.recurrence),
    gift: best.status === 'granted' && isGiftRecurrence(best.recurrence),
    style: effectiveSupporterStyle(best.tier as SupporterTierId, parseSupporterStyle(best.style)),
  };
}

/**
 * Tenure: the Supporter star changes SHAPE with unbroken paid time (colour stays the tier's). Not
 * supporter-specific, so a clan plan's time can climb the same ladder later.
 *   chat:  the in-game chat icon (plugin chat-flair `t`), one per step 1-6: star, ringed, filled ring,
 *          hex, filled hex, solid hex (the plugin's pixel sprites).
 *   glyph: the plugin panel's icon for the same four.
 */
export type TenureStepId = 'apprentice' | 'journeyman' | 'artisan' | 'master' | 'grandmaster' | 'legend';
/** The plugin panel's badge for each step (its pixel sprite, lib/tenureSprites). */
export type TenureGlyph = 'tenure-1' | 'tenure-2' | 'tenure-3' | 'tenure-4' | 'tenure-5' | 'tenure-6';

export interface TenureStep {
  id: TenureStepId;
  name: string;
  months: number;
  chat: 1 | 2 | 3 | 4 | 5 | 6;
  glyph: TenureGlyph;
}

export const TENURE_LADDER: readonly TenureStep[] = [
  { id: 'apprentice', name: 'Apprentice', months: 0, chat: 1, glyph: 'tenure-1' },
  { id: 'journeyman', name: 'Journeyman', months: 3, chat: 2, glyph: 'tenure-2' },
  { id: 'artisan', name: 'Artisan', months: 6, chat: 3, glyph: 'tenure-3' },
  { id: 'master', name: 'Master', months: 12, chat: 4, glyph: 'tenure-4' },
  { id: 'grandmaster', name: 'Grandmaster', months: 24, chat: 5, glyph: 'tenure-5' },
  { id: 'legend', name: 'Legend', months: 36, chat: 6, glyph: 'tenure-6' },
];

/** The step `months` of unbroken time has reached, and the next one (null at the top). */
export function tenureFor(months: number): { step: TenureStep; next: TenureStep | null } {
  let i = 0;
  while (i + 1 < TENURE_LADDER.length && months >= TENURE_LADDER[i + 1].months) i++;
  return { step: TENURE_LADDER[i], next: TENURE_LADDER[i + 1] ?? null };
}

/** A lapse shorter than this (a failed card, a late renewal) doesn't break a paid run. */
export const TENURE_GRACE_MS = 30 * 86_400_000;

/** Time the person paid for: not refunded, not a staff gift, not time earned through invites. */
function isPaidRow(r: SupporterRowLike): boolean {
  if (r.status === 'refunded' || r.status === 'granted') return false;
  const rec = r.recurrence ?? '';
  return rec !== GIFT_RECURRENCE && !rec.startsWith('referral');
}

/**
 * When the person's current unbroken paid run began, or null when they have none still within the
 * grace period. Rows (several logins, several memberships) are merged into runs, joining any two
 * less than TENURE_GRACE_MS apart; the run that ends last decides. Changing tier never breaks it.
 */
export function paidRunStart(rows: SupporterRowLike[], now = Date.now()): number | null {
  const spans: [number, number][] = [];
  for (const r of rows) {
    if (!isPaidRow(r) || !(r.tier in SUPPORTER_TIERS)) continue;
    const start = parseStamp(r.tenureStartedAt ?? r.startedAt);
    if (Number.isNaN(start)) continue;
    let end: number;
    if (r.status === 'active') end = now;
    else if (r.status === 'cancelling') {
      const e = parseStamp(r.currentPeriodEnd);
      end = Number.isNaN(e) ? now : Math.min(e, now);
    } else {
      const e = parseStamp(r.endedAt);
      const p = parseStamp(r.currentPeriodEnd);
      end = !Number.isNaN(e) ? e : !Number.isNaN(p) ? p : start;
    }
    spans.push([start, Math.max(start, end)]);
  }
  if (spans.length === 0) return null;
  spans.sort((a, b) => a[0] - b[0]);
  let best: [number, number] | null = null;
  let cur = spans[0];
  for (const s of spans.slice(1)) {
    if (s[0] <= cur[1] + TENURE_GRACE_MS) cur = [cur[0], Math.max(cur[1], s[1])];
    else {
      if (!best || cur[1] >= best[1]) best = cur;
      cur = s;
    }
  }
  if (!best || cur[1] >= best[1]) best = cur;
  return now - best[1] <= TENURE_GRACE_MS ? best[0] : null;
}

/**
 * A membership row coming back to life. Its unbroken paid run (tenure, lib/supporterTiers) restarts
 * when it was gone longer than the grace period, or its money was taken back; a short lapse keeps it.
 */
export function runStartOnReturn(
  row: { status: string; endedAt: string | null; currentPeriodEnd: string | null },
  now = Date.now(),
): { tenureStartedAt?: string } {
  if (row.status === 'refunded') return { tenureStartedAt: new Date(now).toISOString() };
  if (row.status !== 'ended') return {};
  const gone = now - parseStamp(row.endedAt ?? row.currentPeriodEnd);
  return Number.isNaN(gone) || gone > TENURE_GRACE_MS ? { tenureStartedAt: new Date(now).toISOString() } : {};
}

/** "1 year, 2 months" / "7 months" / "under a month". */
export function tenureLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (y && m) return `${part(y, 'year')}, ${part(m, 'month')}`;
  if (y) return part(y, 'year');
  return m ? part(m, 'month') : 'under a month';
}

/** Short form for tight rows: "1 yr" / "7 mo" / "new". */
export function tenureShort(months: number): string {
  return months >= 12 ? `${Math.floor(months / 12)} yr` : months > 0 ? `${months} mo` : 'new';
}

/**
 * Put a supporter's star on a Discord embed's author line (Discord can't colour a name; the author
 * icon is the one place a small picture sits beside it). Only an embed with an author and no icon
 * of its own; returns a copy. `origin` is the apex, since Discord fetches the picture itself. A
 * Champion or Patron who picked their own colours gets a star drawn in them; everyone else the
 * tier's static star. Past Apprentice the star wears its tenure frame (lib/tenureStarSvg).
 */
export function withSupporterAuthor<T extends Record<string, unknown>>(
  embed: T,
  tier: SupporterTierId | null | undefined,
  origin: string,
  style: SupporterStyle | null = null,
  tenure: TenureStepId | null = null,
): T {
  const author = embed.author as { name?: unknown; icon_url?: unknown } | undefined;
  if (!tier || !author || typeof author.name !== 'string' || author.icon_url) return embed;
  return { ...embed, author: { ...author, icon_url: supporterStarUrl(tier, style, origin, tenure) } };
}

/** The star picture for a tier as this person wears it (see withSupporterAuthor). */
export function supporterStarUrl(tier: SupporterTierId, style: SupporterStyle | null, origin: string, tenure: TenureStepId | null = null): string {
  const eff = effectiveSupporterStyle(tier, style);
  // Discord is a dark surface: their own dark look when they set one, else the main look.
  const look = eff?.dark ?? eff;
  const own = look?.stops ?? (look?.preset ? presetById(look.preset)?.stops : undefined);
  const framed = tenure != null;
  if (!own && !framed) return `${origin}/icons/supporter-${tier}.png`;
  // A tenure badge in the tier's own colours when they chose none.
  const ink = SUPPORTER_INK[tier];
  const stops = own ?? ink.grad ?? [ink.color];
  return `${origin}/api/og/supporter-star/${stops.map((h) => h.slice(1)).join('-')}${framed ? `?t=${tenure}` : ''}`;
}
