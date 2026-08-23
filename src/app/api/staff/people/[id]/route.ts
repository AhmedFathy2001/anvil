import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, players, users, eventParticipants } from '@/db/schema';
import { requirePlatformApi, CAN_GRANT, CAN_WRITE } from '@/lib/platformAccess';
import { PLATFORM_ROLES, type PlatformRole } from '@/lib/clanRoles';

/**
 * Platform-level actions on a PERSON: the site-wide ban, and the platform role.
 *
 * BOTH OF THESE ARE THINGS A CLAN ADMIN MUST BE STRUCTURALLY UNABLE TO REACH.
 *
 * A clan barring someone is a different mechanism entirely — a clan's own removal, which says
 * nothing about any other clan and leaves the person's account, profile and history intact. This
 * route is the other level: barred everywhere, no login, no clan, no participation. Nothing under
 * /api/admin can call it, and it lives behind a platform role that no clan grant can confer.
 *
 * The role change is narrower still: `root` only, because 'staff' granting platform roles is
 * 'staff' promoting itself.
 */

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const playerId = Number((await params).id);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return NextResponse.json({ error: 'Bad person id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  // The role change needs root; the ban needs staff. Ask for whichever this request actually is,
  // rather than one gate covering both — the weaker action shouldn't require the stronger role, and
  // the stronger one must never accept the weaker.
  const wantsRole = 'platformRole' in body;
  const gate = await requirePlatformApi(wantsRole ? CAN_GRANT : CAN_WRITE);
  if ('response' in gate) return gate.response;
  const { actor } = gate;

  const person = await db.query.players.findFirst({ where: eq(players.id, playerId) });
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (wantsRole) {
    const next = String(body.platformRole) as PlatformRole;
    if (!PLATFORM_ROLES.includes(next)) {
      return NextResponse.json({ error: 'Bad platform role' }, { status: 400 });
    }
    const login = await db.query.users.findFirst({ where: eq(users.playerId, playerId) });
    if (!login) {
      // A platform role attaches to a login, and someone who has never signed in has none. Said
      // plainly rather than silently doing nothing.
      return NextResponse.json({ error: 'That person has no Discord login to grant a role to' }, { status: 400 });
    }
    if (login.id === actor.user.userId) {
      // No self-demotion, and no self-promotion. The genesis env var is the only way to mint the
      // first root, and after that a root's own seat is changed by another root.
      return NextResponse.json({ error: 'You cannot change your own platform role' }, { status: 400 });
    }

    await db
      .update(users)
      // Bumped so the change takes effect on the next request rather than whenever their cookie
      // happens to expire. A demotion that waits 30 days is not a demotion.
      .set({ platformRole: next, sessionVersion: (login.sessionVersion ?? 0) + 1 })
      .where(eq(users.id, login.id));

    await db
      .insert(clanAuditLog)
      .values({
        clanId: null, // a platform action belongs to no clan
        eventType: 'platform_role_changed',
        actorUserId: actor.user.userId,
        oldValue: JSON.stringify({ platformRole: login.platformRole }),
        newValue: JSON.stringify({ platformRole: next, playerId }),
        notes: `by platform ${actor.role}`,
      })
      .catch(() => {});

    return NextResponse.json({ ok: true, platformRole: next });
  }

  if ('banned' in body) {
    const banned = Boolean(body.banned);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null;

    await db
      .update(players)
      .set({
        banned,
        bannedAt: banned ? new Date().toISOString() : null,
        bannedReason: banned ? reason || null : null,
      })
      .where(eq(players.id, playerId));

    // Kill their live sessions too, or a ban means nothing until the cookie ages out.
    const login = await db.query.users.findFirst({ where: eq(users.playerId, playerId) });
    if (login) {
      await db
        .update(users)
        .set({ sessionVersion: (login.sessionVersion ?? 0) + 1 })
        .where(eq(users.id, login.id));
    }

    await db
      .insert(clanAuditLog)
      .values({
        clanId: null,
        eventType: banned ? 'platform_banned' : 'platform_unbanned',
        actorUserId: actor.user.userId,
        oldValue: JSON.stringify({ banned: person.banned }),
        newValue: JSON.stringify({ banned, reason, playerId }),
        notes: `by platform ${actor.role}`,
      })
      .catch(() => {});

    return NextResponse.json({ ok: true, banned });
  }

  return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
}
