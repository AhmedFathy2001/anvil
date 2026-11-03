import { NextResponse } from 'next/server';

import { verifyAdmin, verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { eventInClan } from '@/lib/eventScope';
import {
  assignBingoRoleToApprovedSignups,
  assignTeamRoles,
  createMissingTeamDiscord,
  inspectTeamDiscord,
  teardownOneTeamDiscord,
  teardownTeamDiscord,
  type TeamDiscordPart,
} from '@/lib/discord-teams';

/**
 * The event Discord tab's "In your Discord now": what Anvil made in the clan's own server for this
 * event, checked live, and the actions on it. Only ids Anvil stored (the event category, each team's
 * role/text/voice) are listed or deleted; the shared player role is the clan's and is never deleted.
 *
 * Host staff see it; only admins act. A co-host manages its own server from its own side.
 */

async function scope(eventIdRaw: string, write: boolean) {
  const eventId = Number(eventIdRaw);
  if (!Number.isInteger(eventId)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  const allowed = write ? await verifyAdmin() : !!(await verifyAdminOrModerator());
  if (!allowed) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) } as const;
  const clan = await requireClan();
  // Ids are global and this one came from the URL: the event must be this clan's.
  const event = await eventInClan(clan.id, eventId);
  if (!event) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  return { eventId, event } as const;
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId, false);
  if ('error' in s) return s.error;
  const inventory = await inspectTeamDiscord(s.eventId);
  if (!inventory) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ inventory, canManage: await verifyAdmin() });
}

const PARTS: TeamDiscordPart[] = ['role', 'text', 'voice'];

/**
 * Body: { action: 'create-missing' | 'resync-roles' | 'delete-all' | 'delete-one', teamId?, part? }.
 * Answers with the fresh inventory so the tab redraws from what Discord now says.
 */
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const s = await scope((await params).eventId, true);
  if ('error' in s) return s.error;
  const body = (await request.json().catch(() => ({}))) as { action?: string; teamId?: unknown; part?: unknown };
  const id = s.eventId;

  // An event server (co-hosted joint/single layout) owns the team roles and channels; building them in
  // the host's server too would duplicate every team. Cleanup of anything stored here stays allowed.
  if (s.event.discordLayout !== 'own' && (body.action === 'create-missing' || body.action === 'resync-roles')) {
    return NextResponse.json(
      { error: 'This event uses a separate event server. Manage it from the Event Discord server panel below.' },
      { status: 409 },
    );
  }

  let message: string;
  switch (body.action) {
    case 'create-missing': {
      const r = await createMissingTeamDiscord(id);
      if (!r.ok) return NextResponse.json({ error: r.reason ?? 'Some things could not be created.', report: r }, { status: 400 });
      const made = r.provision?.teams.length ?? 0;
      message = `Checked ${made} team${made === 1 ? '' : 's'}${r.playerRoleCreated ? ' and created the player role' : ''}.`;
      break;
    }
    case 'resync-roles': {
      const inv = await inspectTeamDiscord(id);
      if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const parts: string[] = [];
      if (inv.rostersReady && inv.teamChannels) {
        // Team role + (unless the event says never) the player role, to everyone on a team.
        const r = await assignTeamRoles(id);
        if (!r.ok) return NextResponse.json({ error: r.reason ?? 'Role sync failed.' }, { status: 400 });
        parts.push(`${r.assigned} player${r.assigned === 1 ? '' : 's'} given their team role${r.skipped ? `, ${r.skipped} skipped (no linked Discord)` : ''}`);
      }
      if (inv.playerRoleTiming === 'approve' || (inv.playerRoleTiming === 'draft' && inv.rostersReady && !inv.teamChannels)) {
        const r = await assignBingoRoleToApprovedSignups(id);
        if (!r.ok) return NextResponse.json({ error: r.reason ?? 'Player role sync failed.' }, { status: 400 });
        parts.push(`${r.assigned} approved sign-up${r.assigned === 1 ? '' : 's'} given the player role`);
      }
      if (parts.length === 0) {
        return NextResponse.json(
          { error: 'Nothing to hand out yet: rosters are not final, or this event gives no roles.' },
          { status: 409 },
        );
      }
      message = `${parts.join('; ')}.`;
      break;
    }
    case 'delete-all': {
      const r = await teardownTeamDiscord(id);
      if (!r.ok) return NextResponse.json({ error: r.reason ?? 'Cleanup failed.' }, { status: 400 });
      const failed = r.rolesFailed + r.channelsFailed + (r.categoryFailed ? 1 : 0);
      message = `Deleted ${r.rolesDeleted} role${r.rolesDeleted === 1 ? '' : 's'} and ${r.channelsDeleted + (r.categoryDeleted ? 1 : 0)} channel${r.channelsDeleted + (r.categoryDeleted ? 1 : 0) === 1 ? '' : 's'}.`;
      if (failed > 0) message += ` ${failed} could not be deleted. ${r.failDetail ?? ''}`.trimEnd();
      break;
    }
    case 'delete-one': {
      const teamId = Number(body.teamId);
      const part = PARTS.find((p) => p === body.part);
      if (!Number.isInteger(teamId) || !part) return NextResponse.json({ error: 'Pick a team and what to delete.' }, { status: 400 });
      // The team is checked against this (already clan-scoped) event inside teardownOneTeamDiscord.
      const r = await teardownOneTeamDiscord(id, teamId, part);
      if (!r.ok) return NextResponse.json({ error: r.reason ?? 'Delete failed.' }, { status: 400 });
      message = r.deleted ? 'Deleted.' : 'Nothing was stored for that, so nothing was deleted.';
      break;
    }
    default:
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  return NextResponse.json({ message, inventory: await inspectTeamDiscord(id), canManage: true });
}
