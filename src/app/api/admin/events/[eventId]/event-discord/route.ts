import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { events } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import {
  adminStatus,
  clanRoleOnEvent,
  configureEventServer,
  provisionClanPlanning,
  provisionEventServer,
  syncEventServerMembers,
  teardownClanPlanning,
  teardownEventServer,
} from '@/lib/eventDiscord';
import { assignCohostBingoRoleToApprovedSignups, unassignCohostBingoRole } from '@/lib/discord-teams';

/**
 * The event Discord server for a co-hosted event (lib/eventDiscord).
 *
 * Answered at the ACTING clan's own address: the host from its admin, a co-host from its admin. Each
 * clan only ever drives its own bot — the event server is driven by the bot of the clan that bound it,
 * and planning channels by the clan whose server they live in.
 */
async function authorize(params: Promise<{ eventId: string }>) {
  const id = Number((await params).eventId);
  if (!Number.isInteger(id)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const actor = await verifyUser();
  if (!actor || !atLeast(actor.role, 'admin')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const clan = await requireClan();
  const role = await clanRoleOnEvent(id, clan.id);
  // Same 404 for "no such event" and "not yours", so ids can't be probed.
  if (!role) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { id, actor, clan, role };
}

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorize(params);
  if ('error' in auth) return auth.error;
  const status = await adminStatus(auth.id, auth.clan.id);
  if (!status) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(status);
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorize(params);
  if ('error' in auth) return auth.error;
  const { id, actor, clan, role } = auth;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action;

  // clan-scope: global -- authorize() settled this clan runs the event.
  const event = await db.query.events.findFirst({ where: eq(events.id, id), columns: { eventGuildClanId: true } });
  const drivesEventServer = role === 'host' || event?.eventGuildClanId === clan.id;
  const denyEventServer = () =>
    NextResponse.json({ error: 'Only the host or the clan that set up the event server can do that.' }, { status: 403 });

  switch (action) {
    case 'configure': {
      const r = await configureEventServer({
        eventId: id,
        actorClanId: clan.id,
        actorUserId: actor.userId,
        layout: body.layout,
        guildId: body.guildId,
      });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
      break;
    }
    case 'provision': {
      if (!drivesEventServer) return denyEventServer();
      const r = await provisionEventServer(id);
      if (!r.ok) return NextResponse.json({ error: r.error, report: r }, { status: 400 });
      return NextResponse.json({ success: true, report: r, status: await adminStatus(id, clan.id) });
    }
    case 'sync-members': {
      if (!drivesEventServer) return denyEventServer();
      const r = await syncEventServerMembers(id);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ success: true, report: r, status: await adminStatus(id, clan.id) });
    }
    case 'setup-all': {
      if (!drivesEventServer) return denyEventServer();
      const p = await provisionEventServer(id);
      if (!p.ok) return NextResponse.json({ error: p.error, report: p }, { status: 400 });
      const m = await syncEventServerMembers(id);
      if (!m.ok) return NextResponse.json({ error: m.error }, { status: 400 });
      return NextResponse.json({ success: true, report: { provision: p, members: m }, status: await adminStatus(id, clan.id) });
    }
    case 'planning': {
      const r = await provisionClanPlanning(id, clan.id);
      if (!r.ok) return NextResponse.json({ error: r.error, report: r }, { status: 400 });
      return NextResponse.json({ success: true, report: r, status: await adminStatus(id, clan.id) });
    }
    case 'teardown-event-server': {
      if (!drivesEventServer) return denyEventServer();
      const r = await teardownEventServer(id);
      if (!r.ok) return NextResponse.json({ error: r.error, report: r }, { status: 400 });
      break;
    }
    case 'teardown-planning': {
      const r = await teardownClanPlanning(id, clan.id);
      if (!r.ok) return NextResponse.json({ error: r.error, report: r }, { status: 400 });
      break;
    }
    case 'cohost-role-assign':
    case 'cohost-role-remove': {
      // A co-host's own contestant role, in its own server, for its own members only. The host's
      // shared roles live on its Teams tab.
      if (role !== 'cohost') return NextResponse.json({ error: 'This is for co-hosts.' }, { status: 403 });
      const r = action === 'cohost-role-assign'
        ? await assignCohostBingoRoleToApprovedSignups(id, clan.id)
        : await unassignCohostBingoRole(id, clan.id);
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
      return NextResponse.json({ success: true, report: r, status: await adminStatus(id, clan.id) });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json({ success: true, status: await adminStatus(id, clan.id) });
}
