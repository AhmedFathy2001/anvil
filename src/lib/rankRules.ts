// Rank rules: "when someone's in-game rank is X (or higher), give them this Discord role" — and,
// as a suggestion an admin approves, a site staff role. Roles add up as people climb: passing a
// rank keeps the roles of every rule below it.
//
// The roster only knows a rank by its TITLE (clan_roster.rank; custom titles are common), so "or
// higher" needs an order. The clan keeps one — its rank ladder, top first — pre-filled from the
// standard OSRS order and whatever else its roster holds, and reorderable on the Roles page.
//
// Pure (no db): the Roles page, its API and role sync (lib/discord-roles) all read it.

export type StaffSuggestion = 'none' | 'editor' | 'moderator' | 'treasurer' | 'admin';
export const STAFF_LEVELS: readonly StaffSuggestion[] = ['none', 'editor', 'moderator', 'treasurer', 'admin'];

export interface RankRule {
  id: string;
  /** Normalised rank title (lower case, single spaces). */
  rank: string;
  /** 'up' = this rank or any above it on the ladder; 'eq' = exactly this rank. */
  mode: 'up' | 'eq';
  /** The Discord role to give. Null while the admin hasn't picked one. */
  roleId: string | null;
  /** Earned once, kept: a demotion doesn't take it back (leaving the clan still does). */
  keep: boolean;
  /** Site access to SUGGEST for an admin to approve. Never granted on its own. */
  staff: StaffSuggestion;
}

export const RANK_RULES_KEY = 'discord_rank_rules';
export const RANK_ORDER_KEY = 'discord_rank_order';
/** 'false' = rule roles stay when a rank drops (except on leaving). Default: they are taken back. */
export const RANK_RULES_REMOVE_KEY = 'discord_rank_rules_remove';

/** Standard OSRS clan titles, highest first — the starting ladder. */
export const STANDARD_RANKS = ['owner', 'deputy owner', 'coordinator', 'overseer', 'general', 'captain', 'lieutenant', 'sergeant', 'corporal', 'recruit'];

export const MAX_RANK_RULES = 30;

export function normalizeRank(rank: string | null | undefined): string | null {
  if (typeof rank !== 'string') return null;
  const v = rank.trim().toLowerCase().replace(/[_\s]+/g, ' ');
  return v.length > 0 && v.length <= 60 ? v : null;
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseRankRules(raw: unknown): RankRule[] {
  const v = parseJson(raw);
  if (!Array.isArray(v)) return [];
  const out: RankRule[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const rank = normalizeRank(typeof o.rank === 'string' ? o.rank : null);
    if (!rank) continue;
    let id = typeof o.id === 'string' && /^[\w-]{1,40}$/.test(o.id) ? o.id : `r${out.length + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    out.push({
      id,
      rank,
      mode: o.mode === 'eq' ? 'eq' : 'up',
      roleId: typeof o.roleId === 'string' && /^\d{5,25}$/.test(o.roleId) ? o.roleId : null,
      keep: o.keep === true,
      staff: STAFF_LEVELS.includes(o.staff as StaffSuggestion) ? (o.staff as StaffSuggestion) : 'none',
    });
    if (out.length >= MAX_RANK_RULES) break;
  }
  return out;
}

export function parseRankOrder(raw: unknown): string[] {
  const v = parseJson(raw);
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const r of v) {
    const k = normalizeRank(typeof r === 'string' ? r : null);
    if (k && !out.includes(k)) out.push(k);
  }
  return out.slice(0, 100);
}

/**
 * The ladder to show and judge by: the clan's saved order, then any rank its roster holds that the
 * saved order hasn't placed yet (standard titles in their usual spot, custom ones by Discord role
 * position when known, else rarest first — the few holding a title are usually its senior ones).
 */
export function effectiveRankOrder(
  saved: string[],
  roster: { rank: string; count: number }[],
  rolePosition: (rank: string) => number | null = () => null,
): string[] {
  const order = [...saved];
  const missing = roster
    .map((r) => ({ ...r, rank: normalizeRank(r.rank) }))
    .filter((r): r is { rank: string; count: number } => !!r.rank && !order.includes(r.rank) && r.rank !== 'friend' && r.rank !== 'guest');
  const score = (r: { rank: string; count: number }) => {
    const std = STANDARD_RANKS.indexOf(r.rank);
    if (std !== -1) return 10_000 - std * 100;
    const pos = rolePosition(r.rank);
    if (pos != null) return 5_000 + pos;
    return 1_000 - Math.min(r.count, 999);
  };
  missing.sort((a, b) => score(b) - score(a));
  for (const m of missing) {
    // Slot a standard rank in beside its neighbours if the saved order has them; else append.
    const std = STANDARD_RANKS.indexOf(m.rank);
    if (std !== -1) {
      const below = STANDARD_RANKS.slice(std + 1).find((r) => order.includes(r));
      if (below) {
        order.splice(order.indexOf(below), 0, m.rank);
        continue;
      }
    }
    order.push(m.rank);
  }
  return order;
}

/** Does this rule cover someone holding `rank`? Unknown ranks only match exact rules. */
export function ruleMatches(rule: RankRule, rank: string | null, order: string[]): boolean {
  const k = normalizeRank(rank);
  if (!k) return false;
  if (k === rule.rank) return true;
  if (rule.mode === 'eq') return false;
  const held = order.indexOf(k);
  const at = order.indexOf(rule.rank);
  return held !== -1 && at !== -1 && held < at;
}

/** The highest of several ranks (one person, several accounts) by the ladder. */
export function highestRank(ranks: (string | null | undefined)[], order: string[]): string | null {
  let best: string | null = null;
  let bestIdx = Number.POSITIVE_INFINITY;
  for (const r of ranks) {
    const k = normalizeRank(r);
    if (!k) continue;
    const idx = order.indexOf(k);
    const score = idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    if (best === null || score < bestIdx) {
      best = k;
      bestIdx = score;
    }
  }
  return best;
}

export interface RuleOutcome {
  /** Roles this person should hold from the rules. */
  give: Set<string>;
  /** Every role the rules manage that may be taken back (rules marked keep excluded). */
  managed: Set<string>;
  /** The highest site access a matching rule suggests. */
  staff: StaffSuggestion;
}

export function applyRankRules(rules: RankRule[], order: string[], rank: string | null, removeOnDrop = true): RuleOutcome {
  const give = new Set<string>();
  const managed = new Set<string>();
  let staff: StaffSuggestion = 'none';
  for (const rule of rules) {
    if (!rule.roleId && rule.staff === 'none') continue;
    const hit = ruleMatches(rule, rank, order);
    if (rule.roleId) {
      if (hit) give.add(rule.roleId);
      if (removeOnDrop && !rule.keep) managed.add(rule.roleId);
    }
    if (hit && STAFF_LEVELS.indexOf(rule.staff) > STAFF_LEVELS.indexOf(staff)) staff = rule.staff;
  }
  // A role a kept rule gives is never taken back, even if another rule also manages it.
  for (const rule of rules) if (rule.keep && rule.roleId) managed.delete(rule.roleId);
  return { give, managed, staff };
}
