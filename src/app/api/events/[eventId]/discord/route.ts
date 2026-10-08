import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { events, teams, eventSignups } from '@/db/schema';
import { and, count, eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import {
  loadTeamChannelConfig,
  provisionTeamDiscord,
  assignTeamRoles,
  assignBingoRoleToApprovedSignups,
  eventRostersReadyForAssignment,
  unassignSharedRoles,
  teardownTeamDiscord,
  cohostBingoRoleReady,
  assignCohostBingoRoleToApprovedSignups,
  unassignCohostBingoRole,
} from '@/lib/discord-teams';
import { cohostsForEvent, isAcceptedCohost } from '@/lib/coHost';
import { requestCohostDiscordSetup } from '@/lib/cohostDiscordSetup';

// GET — current provisioning state for the admin Teams tab: whether the feature is
// configured, and which teams already have a role + channels.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const clan = await requireClan();
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const isHost = event.clanId === clan.id;
  const [cfg, eventTeams, rostersReady, cohosts, cohostRoleConfigured] = await Promise.all([
    loadTeamChannelConfig(clan.id),
    db.select().from(teams).where(eq(teams.eventId, id)),
    eventRostersReadyForAssignment(id, event.draftStatus),
    isHost ? cohostsForEvent(id) : Promise.resolve([]),
    isHost ? Promise.resolve(false) : cohostBingoRoleReady(id, clan.id),
  ]);

  // For the pre-draft "give bingo role" button: how many sign-ups are approved, and
  // whether a bingo role is even configured to hand out.
  const approvedSignups = await db
    .select({ c: count() })
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, id), eq(eventSignups.status, 'approved')))
    .then((r) => r[0]?.c ?? 0);

  const ownTeam = eventTeams.find((team) => team.clanId === clan.id) ?? null;
  return NextResponse.json({
    isHost,
    clanName: clan.name,
    enabled: isHost ? cfg !== null : true,
    categoryId: event.discordCategoryId,
    draftStatus: event.draftStatus,
    rostersReady,
    bingoRoleConfigured: isHost ? !!cfg?.bingoRoleId : cohostRoleConfigured,
    captainRoleConfigured: !!cfg?.captainRoleId,
    approvedSignups,
    cohosts: cohosts
      .filter((cohost) => cohost.status === 'accepted')
      .map((cohost) => ({ clanId: cohost.clanId, clanName: cohost.clanName })),
    teams: eventTeams.map((t) => ({
      id: t.id,
      name: t.name,
      clanId: t.clanId,
      hasRole: !!t.discordRoleId,
      hasTextChannel: !!t.discordTextChannelId,
      hasVoiceChannel: !!t.discordVoiceChannelId,
    })),
    // True once every team has its role + both channels.
    fullyProvisioned:
      eventTeams.length > 0 &&
      eventTeams.every((t) => t.discordRoleId && t.discordTextChannelId && t.discordVoiceChannelId),
    ownTeamId: ownTeam?.id ?? null,
    ownTeamName: ownTeam?.name ?? null,
  });
}

// POST — actions: provision | assign-rosters | teardown.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const clan = await requireClan();
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await request.json();
  const { action } = body;
  const scope = body.scope === 'own-clan' ? 'own-clan' : 'all-teams';

  // A co-host acts only on its own explicitly configured contestant role. It can never provision,
  // assign, or remove anything in the host's server.
  if (event.clanId !== clan.id) {
    if (!(await isAcceptedCohost(id, clan.id))) {
      return NextResponse.json({ error: 'Only accepted co-hosts can manage their Discord setup.' }, { status: 403 });
    }
    if (action === 'assign-cohost-bingo-role') {
      const report = await assignCohostBingoRoleToApprovedSignups(id, clan.id);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Assignment failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }
    if (action === 'unassign-cohost-bingo-role') {
      const report = await unassignCohostBingoRole(id, clan.id);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Removal failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }
    return NextResponse.json({ error: 'This action belongs to the event host.' }, { status: 403 });
  }

  if (action === 'request-cohost-setup') {
    const report = await requestCohostDiscordSetup(id, event.name, clan.name);
    return NextResponse.json({ success: true, report });
  }

  const cfg = await loadTeamChannelConfig(clan.id);
  if (!cfg) {
    return NextResponse.json(
      { error: 'Discord team channels are disabled or unconfigured. Enable it under Integrations and set the bot token + server ID.' },
      { status: 409 },
    );
  }

  // An event server (joint/single, lib/eventDiscord) owns the team roles and channels; creating them
  // in the host's server too would duplicate every team. Cleanup actions stay available.
  if (event.discordLayout !== 'own' && ['provision', 'assign-rosters', 'sync-all'].includes(action)) {
    return NextResponse.json(
      { error: 'This event uses a separate event server. Manage it from the Event Discord server panel.' },
      { status: 409 },
    );
  }

  switch (action) {
    case 'provision': {
      const report = await provisionTeamDiscord(id, scope);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Provisioning failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }

    case 'assign-rosters': {
      if (!(await eventRostersReadyForAssignment(id, event.draftStatus))) {
        return NextResponse.json({ error: 'Every team must have players and every entrant must be assigned first.' }, { status: 409 });
      }
      const report = await assignTeamRoles(id, scope);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Assignment failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }

    // One-click "set up everything": create the roles/channels, then assign contestant roles.
    // The same pair that runs automatically when the draft completes — exposed as a button so an
    // admin can (re-)run it after the fact. A completed draft OR fully assigned direct rosters are
    // final enough to sync.
    case 'sync-all': {
      if (!(await eventRostersReadyForAssignment(id, event.draftStatus))) {
        return NextResponse.json({ error: 'Every team must have players and every entrant must be assigned first.' }, { status: 409 });
      }
      const provision = await provisionTeamDiscord(id, scope);
      if (!provision.ok) return NextResponse.json({ error: provision.reason || 'Provisioning failed' }, { status: 400 });
      const assign = await assignTeamRoles(id, scope);
      if (!assign.ok) return NextResponse.json({ error: assign.reason || 'Role assignment failed' }, { status: 400 });
      return NextResponse.json({ success: true, report: { provision, assign } });
    }

    case 'assign-bingo-role': {
      const report = await assignBingoRoleToApprovedSignups(id, scope);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Assignment failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }

    case 'unassign-shared-roles': {
      const report = await unassignSharedRoles(id, scope);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Removal failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }

    case 'teardown': {
      const report = await teardownTeamDiscord(id);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Teardown failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
