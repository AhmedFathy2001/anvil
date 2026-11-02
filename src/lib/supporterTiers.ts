// Anvil Supporter tiers: the pure half (no database), so tests and client components can import it.
//
// Supporter is a PERSONAL subscription, separate from the clan plans in lib/plans. It never changes
// tracking, scoring or anything about an event; it buys flair and hosting room. Three tiers, each a
// superset of the one below. Prices live on Gumroad (one product, three tiers, monthly and yearly);
// they are repeated here only for display.

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

/**
 * A tier's name colours where CSS can't reach (the plugin panel): a solid colour every renderer
 * understands, and the gradient stops a newer one draws across the name. Matches `.supporter-name-*`.
 */
export const SUPPORTER_INK: Record<SupporterTierId, { color: `#${string}`; grad?: `#${string}`[] }> = {
  supporter: { color: '#ffd35c' },
  champion: { color: '#e05ad0', grad: ['#ff9a5a', '#e05ad0', '#7a8cff'] },
  patron: { color: '#ff7ab8', grad: ['#ffd27a', '#ff7ab8', '#7ae0ff'] },
};

/** The tier a Gumroad tier name means ("Champion" → champion). Unknown names are null, never a guess. */
export function supporterTierForGumroad(name: string | null | undefined): SupporterTierId | null {
  const key = (name ?? '').trim().toLowerCase();
  return SUPPORTER_TIER_ORDER.find((id) => SUPPORTER_TIERS[id].name.toLowerCase() === key) ?? null;
}

export type SupporterStatus = 'active' | 'cancelling' | 'ended' | 'refunded';

/** The fields of a supporter_subscriptions row that decide what it is worth right now. */
export interface SupporterRowLike {
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
  startedAt: string;
}

export interface SupporterState {
  tier: SupporterTier;
  /** When the earliest membership started, for "supporter since" and tenure flair. */
  since: string;
  /** Months since `since`, whole months only. */
  months: number;
  /** The row in force is cancelled and ends at its period end. */
  endsAt: string | null;
  renewsAt: string | null;
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
  if (row.status === 'cancelling') {
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
export function supporterState(rows: SupporterRowLike[], now = Date.now()): SupporterState | null {
  const live = rows.filter((r) => rowInForce(r, now));
  if (live.length === 0) return null;
  const best = live.reduce((a, b) =>
    SUPPORTER_TIERS[b.tier as SupporterTierId].rank > SUPPORTER_TIERS[a.tier as SupporterTierId].rank ? b : a,
  );
  const starts = rows
    .filter((r) => r.status !== 'refunded')
    .map((r) => parseStamp(r.startedAt))
    .filter((t) => !Number.isNaN(t));
  const sinceMs = starts.length ? Math.min(...starts) : parseStamp(best.startedAt);
  return {
    tier: SUPPORTER_TIERS[best.tier as SupporterTierId],
    since: new Date(sinceMs).toISOString(),
    months: wholeMonths(sinceMs, now),
    endsAt: best.status === 'cancelling' ? best.currentPeriodEnd : null,
    renewsAt: best.status === 'active' ? best.currentPeriodEnd : null,
  };
}

/** Tenure flair steps: the look changes at these months. */
export const TENURE_STEPS = [3, 6, 12] as const;

/** The highest tenure step reached (0 = none yet), and the next one to aim for (null at the top). */
export function tenureStep(months: number): { reached: number; next: number | null } {
  const reached = [...TENURE_STEPS].reverse().find((s) => months >= s) ?? 0;
  const next = TENURE_STEPS.find((s) => months < s) ?? null;
  return { reached, next };
}

/**
 * Put a supporter's star on a Discord embed's author line (Discord can't colour a name; the author
 * icon is the one place a small picture sits beside it). Only an embed with an author and no icon
 * of its own; returns a copy. `origin` is the apex, since Discord fetches the picture itself.
 */
export function withSupporterAuthor<T extends Record<string, unknown>>(embed: T, tier: SupporterTierId | null | undefined, origin: string): T {
  const author = embed.author as { name?: unknown; icon_url?: unknown } | undefined;
  if (!tier || !author || typeof author.name !== 'string' || author.icon_url) return embed;
  return { ...embed, author: { ...author, icon_url: `${origin}/icons/supporter-${tier}.png` } };
}
