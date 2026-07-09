import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, teams, eventSignups } from '@/db/schema';
import { and, count, eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import {
  loadTeamChannelConfig,
  provisionTeamDiscord,
  assignTeamRoles,
  assignBingoRoleToApprovedSignups,
  unassignSharedRoles,
  teardownTeamDiscord,
} from '@/lib/discord-teams';

// GET — current provisioning state for the admin Teams tab: whether the feature is
// configured, and which teams already have a role + channels.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const cfg = await loadTeamChannelConfig();
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));

  // For the pre-draft "give bingo role" button: how many sign-ups are approved, and
  // whether a bingo role is even configured to hand out.
  const approvedSignups = await db
    .select({ c: count() })
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, id), eq(eventSignups.status, 'approved')))
    .then((r) => r[0]?.c ?? 0);

  return NextResponse.json({
    enabled: cfg !== null,
    categoryId: event.discordCategoryId,
    draftStatus: event.draftStatus,
    bingoRoleConfigured: !!cfg?.bingoRoleId,
    captainRoleConfigured: !!cfg?.captainRoleId,
    approvedSignups,
    teams: eventTeams.map((t) => ({
      id: t.id,
      name: t.name,
      hasRole: !!t.discordRoleId,
      hasTextChannel: !!t.discordTextChannelId,
      hasVoiceChannel: !!t.discordVoiceChannelId,
    })),
    // True once every team has its role + both channels.
    fullyProvisioned:
      eventTeams.length > 0 &&
      eventTeams.every((t) => t.discordRoleId && t.discordTextChannelId && t.discordVoiceChannelId),
  });
}

// POST — actions: provision | assign-rosters | teardown.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const cfg = await loadTeamChannelConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: 'Discord team channels are disabled or unconfigured. Enable it under Integrations and set the bot token + server ID.' },
      { status: 409 },
    );
  }

  const { action } = await request.json();

  switch (action) {
    case 'provision': {
      const report = await provisionTeamDiscord(id);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Provisioning failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }

    case 'assign-rosters': {
      if (event.draftStatus !== 'completed') {
        return NextResponse.json({ error: 'The draft must be completed before assigning team roles.' }, { status: 409 });
      }
      const report = await assignTeamRoles(id);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Assignment failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }

    case 'assign-bingo-role': {
      const report = await assignBingoRoleToApprovedSignups(id);
      if (!report.ok) return NextResponse.json({ error: report.reason || 'Assignment failed' }, { status: 400 });
      return NextResponse.json({ success: true, report });
    }

    case 'unassign-shared-roles': {
      const report = await unassignSharedRoles(id);
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
