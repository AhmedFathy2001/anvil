import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { clanMembers, federationBans, users } from '@/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';

// GET — list all clan members (active + departed) for the admin roster view.
export async function GET() {
  const user = await verifyUser();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(clanMembers)
    .orderBy(desc(clanMembers.joinedAt));

  // Resolve linked-user ban state + authoritative Discord id (users.discordId beats the legacy
  // clan_members.discordId column) so the roster can show/toggle both the site ban and the
  // federation ban.
  const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is number => v != null))];
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

  // Effective Discord id per member (federation bans are keyed on discord_id, WIRE §4).
  const effectiveDiscordId = (r: (typeof rows)[number]): string | null =>
    (r.userId != null ? userDiscordId.get(r.userId) : null) ?? r.discordId ?? null;

  // Which of those discord ids are federation-banned.
  const discordIds = [...new Set(rows.map(effectiveDiscordId).filter((v): v is string => !!v))];
  const fedBanned = discordIds.length
    ? new Set(
        (
          await db
            .select({ discordId: federationBans.discordId })
            .from(federationBans)
            .where(inArray(federationBans.discordId, discordIds))
        ).map((b) => b.discordId),
      )
    : new Set<string>();

  return NextResponse.json(
    rows.map((r) => {
      const did = effectiveDiscordId(r);
      return {
        ...r,
        userBanned: r.userId != null && bannedIds.has(r.userId),
        userRole: r.userId != null ? userRole.get(r.userId) ?? null : null,
        effectiveDiscordId: did,
        federationBanned: did != null && fedBanned.has(did),
      };
    }),
  );
}

// POST — manual add (admin entering a guest / member the plugin can't reach).
export async function POST(request: Request) {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
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

  const rsnNormalized = normalizeRsn(rsn);
  const existing = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, rsnNormalized),
  });
  if (existing && !existing.leftAt) {
    return NextResponse.json({ error: 'Already in roster', id: existing.id }, { status: 409 });
  }
  if (existing && existing.leftAt) {
    await db
      .update(clanMembers)
      .set({
        rsn,
        leftAt: null,
        rank: body.rank ?? existing.rank,
        discordId: body.discordId ?? existing.discordId,
        isGuest: body.isGuest ? 1 : 0,
        notes: body.notes ?? existing.notes,
      })
      .where(eq(clanMembers.id, existing.id));
    return NextResponse.json({ id: existing.id, reactivated: true });
  }

  const inserted = await db
    .insert(clanMembers)
    .values({
      rsn,
      rsnNormalized,
      rank: body.rank ?? null,
      discordId: body.discordId ?? null,
      isGuest: body.isGuest ? 1 : 0,
      source: 'manual',
      notes: body.notes ?? null,
    })
    .returning();

  return NextResponse.json(inserted[0]);
}
