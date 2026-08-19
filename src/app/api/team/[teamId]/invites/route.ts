import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { events, teamInvites, teams } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { resolveTeamManagement } from '@/lib/teamStaff';
import { parseEventRules } from '@/lib/eventRules';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import {
  MAX_INVITE_USES,
  MAX_INVITE_HOURS,
  describeInvite,
  generateInviteToken,
  invitePath,
  inviteExpiry,
  isWellFormedToken,
  mayMintInvite,
} from '@/lib/teamInvites';
import { atLeast } from '@/lib/clanRoles';

// The links that put someone straight onto one team (lib/teamInvites). Minting is the whole
// permission question here: a host may always, a captain or a staff seat only when the event's
// `captainInvites` rule says so — clan-v-clan wants it, a normal clan event does not.

/** Everything a mint/list caller needs, or the reason they can't. */
async function gate(teamId: number) {
  const session = await verifyUser();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const membership = await resolveTeamManagement(teamId);
  const isAdmin = atLeast(session.role, 'admin') || session.role === 'moderator';
  if (!membership && !isAdmin) {
    return { error: NextResponse.json({ error: 'Not your team' }, { status: 403 }) };
  }

  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return { error: NextResponse.json({ error: 'Team not found' }, { status: 404 }) };
  const event = await db.query.events.findFirst({ where: eq(events.id, team.eventId) });
  if (!event) return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };

  const captainInvites = parseEventRules(event.rules).captainInvites;
  return {
    session,
    team,
    event,
    captainInvites,
    mayMint: mayMintInvite({
      isAdmin,
      isCaptain: !!membership?.isCaptain,
      isStaff: !!membership?.isStaff,
      captainInvites,
    }),
  };
}

async function listFor(teamId: number, eventId: number) {
  const rows = await db
    .select()
    .from(teamInvites)
    .where(eq(teamInvites.teamId, teamId))
    .orderBy(desc(teamInvites.createdAt));
  const now = Date.now();
  return rows.map((r) => ({
    token: r.token,
    url: invitePath(eventId, r.token),
    maxUses: r.maxUses,
    uses: r.uses,
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
    createdAt: r.createdAt,
    summary: describeInvite(r, now),
  }));
}

/** GET — the team's links, plus whether this caller may make another. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const id = parseInt(teamId, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const ctx = await gate(id);
  if ('error' in ctx) return ctx.error;

  return NextResponse.json({
    mayMint: ctx.mayMint,
    captainInvites: ctx.captainInvites,
    invites: await listFor(id, ctx.team.eventId),
  });
}

/** POST — mint one. `maxUses`/`expiresHours` are optional; absent means unlimited / no expiry. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const rl = await rateLimit(request, 'team-invite', { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many links — slow down.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const { teamId } = await params;
  const id = parseInt(teamId, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const ctx = await gate(id);
  if ('error' in ctx) return ctx.error;
  if (!ctx.mayMint) {
    return NextResponse.json(
      { error: "Only a host can make invite links for this event. Ask them to turn on captain invites if you need to." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as { maxUses?: unknown; expiresHours?: unknown } | null;
  const rawUses = body?.maxUses;
  if (rawUses != null && (typeof rawUses !== 'number' || !Number.isInteger(rawUses) || rawUses < 1 || rawUses > MAX_INVITE_USES)) {
    return NextResponse.json({ error: `maxUses must be between 1 and ${MAX_INVITE_USES}` }, { status: 400 });
  }
  const rawHours = body?.expiresHours;
  if (rawHours != null && (typeof rawHours !== 'number' || !Number.isFinite(rawHours) || rawHours <= 0 || rawHours > MAX_INVITE_HOURS)) {
    return NextResponse.json({ error: `expiresHours must be between 1 and ${MAX_INVITE_HOURS}` }, { status: 400 });
  }

  const token = generateInviteToken((n) => crypto.randomBytes(n));
  await db.insert(teamInvites).values({
    token,
    teamId: id,
    eventId: ctx.team.eventId,
    maxUses: typeof rawUses === 'number' ? rawUses : null,
    expiresAt: inviteExpiry(typeof rawHours === 'number' ? rawHours : null, Date.now()),
    createdByUserId: ctx.session.userId,
  });

  return NextResponse.json({
    ok: true,
    token,
    url: invitePath(ctx.team.eventId, token),
    invites: await listFor(id, ctx.team.eventId),
  });
}

/**
 * DELETE — turn one off. Revoked rather than deleted: the link stops working, and who came through
 * it stays on the record.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const id = parseInt(teamId, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const token = new URL(request.url).searchParams.get('token');
  if (!isWellFormedToken(token)) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

  const ctx = await gate(id);
  if ('error' in ctx) return ctx.error;
  if (!ctx.mayMint) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  await db
    .update(teamInvites)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(teamInvites.teamId, id), eq(teamInvites.token, token!)));

  return NextResponse.json({ ok: true, invites: await listFor(id, ctx.team.eventId) });
}
