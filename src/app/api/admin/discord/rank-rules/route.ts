import { NextResponse } from 'next/server';
import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, clanStaff, users } from '@/db/schema';
import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { fetchGuildRoles } from '@/lib/discord-roles';
import { isSafeAutomatedRole } from '@/lib/discordRoleSafety';
import {
  MAX_RANK_RULES,
  RANK_ORDER_KEY,
  RANK_RULES_KEY,
  RANK_RULES_REMOVE_KEY,
  STAFF_LEVELS,
  applyRankRules,
  effectiveRankOrder,
  highestRank,
  normalizeRank,
  parseRankOrder,
  parseRankRules,
  type StaffSuggestion,
} from '@/lib/rankRules';
import { getSetting, setSetting } from '@/lib/settings';

/**
 * Rank rules on the Roles page (lib/rankRules): which Discord role each in-game rank earns, the
 * clan's rank ladder that "or higher" reads, and the site-access suggestions waiting for an admin.
 * Site access is only ever SUGGESTED here; approving one goes through the ordinary staff route,
 * with its usual checks. Admins only.
 */

/** Where someone's current grant sits on the suggestion scale. */
function currentLevel(row: { role: string; canEditTiles: boolean } | undefined): StaffSuggestion {
  if (!row) return 'none';
  if (row.role === 'owner' || row.role === 'admin') return 'admin';
  if (row.role === 'treasurer') return 'treasurer';
  if (row.role === 'moderator') return 'moderator';
  return row.canEditTiles ? 'editor' : 'none';
}

async function view(clanId: number) {
  const [rulesRaw, orderRaw, removeRaw, guildRoles, rankCounts] = await Promise.all([
    getSetting(clanId, RANK_RULES_KEY),
    getSetting(clanId, RANK_ORDER_KEY),
    getSetting(clanId, RANK_RULES_REMOVE_KEY),
    fetchGuildRoles(clanId).catch(() => []),
    db
      .select({ rank: clanRoster.rank, n: count() })
      .from(clanRoster)
      .where(and(eq(clanRoster.clanId, clanId), isNull(clanRoster.leftAt), eq(clanRoster.kind, 'member')))
      .groupBy(clanRoster.rank),
  ]);
  const rules = parseRankRules(rulesRaw);
  const position = new Map<string, number>();
  for (const r of guildRoles) {
    const k = normalizeRank(r.name);
    if (k) position.set(k, r.position);
  }
  const roster = rankCounts.filter((r) => r.rank).map((r) => ({ rank: r.rank as string, count: Number(r.n) }));
  const order = effectiveRankOrder(parseRankOrder(orderRaw), roster, (k) => position.get(k) ?? null);

  // Site-access suggestions: linked members whose highest rank a rule says should have more access
  // than they hold now. Promotions only — a grant made by hand is never second-guessed downward.
  const suggestions: { userId: number; name: string; rank: string; current: StaffSuggestion; suggested: StaffSuggestion }[] = [];
  if (rules.some((r) => r.staff !== 'none')) {
    const seats = await db
      .select({ userId: users.id, name: users.displayName, rank: clanRoster.rank })
      .from(clanRoster)
      .innerJoin(users, eq(users.playerId, clanRoster.playerId))
      .where(and(eq(clanRoster.clanId, clanId), isNull(clanRoster.leftAt), eq(clanRoster.kind, 'member')));
    const byUser = new Map<number, { name: string; ranks: (string | null)[] }>();
    for (const s of seats) {
      const e = byUser.get(s.userId) ?? { name: s.name ?? 'Member', ranks: [] };
      e.ranks.push(s.rank);
      byUser.set(s.userId, e);
    }
    const grants = await db
      .select({ userId: clanStaff.userId, role: clanStaff.role, canEditTiles: clanStaff.canEditTiles })
      .from(clanStaff)
      .where(eq(clanStaff.clanId, clanId));
    const grantOf = new Map(grants.map((g) => [g.userId, g]));
    for (const [userId, u] of byUser) {
      const top = highestRank(u.ranks, order);
      const suggested = applyRankRules(rules, order, top).staff;
      const current = currentLevel(grantOf.get(userId));
      if (STAFF_LEVELS.indexOf(suggested) > STAFF_LEVELS.indexOf(current)) {
        suggestions.push({ userId, name: u.name, rank: top ?? '', current, suggested });
      }
    }
  }

  return {
    rules,
    order,
    remove: removeRaw !== 'false',
    rosterRanks: Object.fromEntries(roster.map((r) => [normalizeRank(r.rank), r.count])),
    roles: guildRoles
      .filter((r) => r.name !== '@everyone' && isSafeAutomatedRole(r, ''))
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.color ?? 0 })),
    suggestions,
  };
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  return NextResponse.json(await view(clan.id));
}

/** { rules?, order?, remove? } — each saved when present. */
export async function PUT(request: Request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  const body = (await request.json().catch(() => ({}))) as { rules?: unknown; order?: unknown; remove?: unknown };
  if (body.rules !== undefined) {
    if (Array.isArray(body.rules) && body.rules.length > MAX_RANK_RULES) {
      return NextResponse.json({ error: `At most ${MAX_RANK_RULES} rules.` }, { status: 400 });
    }
    await setSetting(clan.id, RANK_RULES_KEY, JSON.stringify(parseRankRules(body.rules)));
  }
  if (body.order !== undefined) await setSetting(clan.id, RANK_ORDER_KEY, JSON.stringify(parseRankOrder(body.order)));
  if (typeof body.remove === 'boolean') await setSetting(clan.id, RANK_RULES_REMOVE_KEY, body.remove ? 'true' : 'false');
  return NextResponse.json(await view(clan.id));
}
