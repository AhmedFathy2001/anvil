// Staff Supporter gifts, the pure half (lib/supporterGifts does the reads and writes;
// tests/supporter-gift-rules.test.ts).
//
// A gift is its own supporter_subscriptions row (status 'granted', recurrence 'gift'), laid over
// whatever the person pays for: it never edits the paid row. The best tier in force wins, so a gift
// above the paid tier shows until it ends or is ended, then the paid tier (if still paid) is back.

import { GIFT_RECURRENCE, SUPPORTER_TIERS, rowInForce, type SupporterRowLike, type SupporterTierId } from './supporterTiers.ts';

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
