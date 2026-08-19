import { NextResponse } from 'next/server';
import { verifyAdminOrModerator, verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { requireClan, requireClanFromRequest } from '@/lib/clanContext';
import { accounts, clanMemberships, clanRoster, users } from '@/db/schema';
import { findOrCreateAccount, findOrCreateSeat, findRosterSeat } from '@/lib/roster';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';

// GET — list all clan members (active + departed) for the admin roster view.
export async function GET(request: Request) {
  const user = await verifyUser();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rows = await db
    .select()
    .from(clanRoster)
    .where(eq(clanRoster.clanId, clan.id))
    .orderBy(desc(clanRoster.joinedAt));

  // Resolve linked-user ban state + authoritative Discord id (users.discordId beats the legacy
  // clan_members.discordId column) so the roster can show/toggle the site ban.
  const userIds = [...new Set(rows.map((r) => r.playerId).filter((v): v is number => v != null))];
  // users.role rides along so the roster can filter by site role without a second round-trip.
  const userRows = userIds.length
    ? await db
        .select({ id: users.id, banned: users.banned, discordId: users.discordId, role: users.role })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const bannedIds = new Set(userRows.filter((u) => u.banned).map((u) => u.id));
  const userDiscordId = new Map(userRows.map((u) => [u.id, u.discordId]));
  const userRole = new Map(userRows.map((u) => [u.id, u.role]));

  // Effective Discord id per member: users.discordId beats the legacy clan_members.discordId column.
  const effectiveDiscordId = (r: (typeof rows)[number]): string | null =>
    (r.playerId != null ? userDiscordId.get(r.playerId) : null) ?? r.discordId ?? null;

  return NextResponse.json(
    rows.map((r) => {
      const did = effectiveDiscordId(r);
      return {
        ...r,
        userBanned: r.playerId != null && bannedIds.has(r.playerId),
        userRole: r.playerId != null ? userRole.get(r.playerId) ?? null : null,
        effectiveDiscordId: did,
      };
    }),
  );
}

// POST — manual add (admin entering a guest / member the plugin can't reach).
export async function POST(request: Request) {
  // Roster work is moderation: mods add, edit and remove members like admins do. Nothing here can
  // change what someone can DO on the site — UpdatableFields covers rank/notes/guest/primary only,
  // and site roles + the tile-authoring capability are set through /api/admin/staff, which stays
  // admin-only. So a moderator can never promote themselves or anyone else.
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { rsn?: string; discordId?: string; rank?: string; isGuest?: boolean; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rsn = (body.rsn || '').trim();
  if (!rsn) return NextResponse.json({ error: 'rsn required' }, { status: 400 });

  const clan = await requireClan();
  const rsnNormalized = normalizeRsn(rsn);
  // Scoped to this clan: the same RSN is legitimately on other clans' rosters, and an unscoped lookup
  // would 409 "already in roster" against a member of a clan this admin has nothing to do with.
  const existing = await findRosterSeat(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.rsnNormalized, rsnNormalized)));
  if (existing && !existing.leftAt) {
    return NextResponse.json({ error: 'Already in roster', id: existing.id }, { status: 409 });
  }
  if (existing && existing.leftAt) {
    await db
      .update(accounts)
      .set({ rsn, discordId: body.discordId ?? existing.discordId })
      .where(eq(accounts.id, existing.accountId));
    await db
      .update(clanMemberships)
      .set({
        leftAt: null,
        rank: body.rank ?? existing.rank,
        kind: body.isGuest ? 'guest' : 'member',
        notes: body.notes ?? existing.notes,
      })
      .where(eq(clanMemberships.id, existing.id));
    return NextResponse.json({ id: existing.id, reactivated: true });
  }

  const account = await findOrCreateAccount({ rsn, rsnNormalized });
  if (body.discordId) {
    await db.update(accounts).set({ discordId: body.discordId }).where(eq(accounts.id, account.id));
  }
  // An admin saying so is one of the three ways membership is granted, so this may seat a member.
  const seatId = await findOrCreateSeat(clan.id, account.id, {
    kind: body.isGuest ? 'guest' : 'member',
    source: 'admin',
  });
  await db
    .update(clanMemberships)
    .set({ rank: body.rank ?? null, notes: body.notes ?? null })
    .where(eq(clanMemberships.id, seatId));

  const [seat] = await db
    .select()
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.id, seatId)));
  return NextResponse.json(seat);
}
