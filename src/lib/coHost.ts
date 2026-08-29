// Co-hosts — one clan helping run another's event, as a first-class object.
//
// Wiring a visiting clan into an event used to be four manual steps: invite them, make a team, tag it
// with their clan, hand their mods staff seats. This bundles that. The host invites a clan (pending);
// an admin of that clan accepts; accepting provisions their team (tagged with their clanId) and grants
// team_staff to their staff. The host keeps final authority — a co-host runs only its own team, which
// is exactly what team_staff already scopes (lib/teamStaff.resolveTeamManagement).
//
// Idempotent throughout: provisioning reuses an existing team for the (event, clan) pair and never
// double-grants a staff seat, so a retried accept is safe.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanStaff, clans, eventCohosts, events, teams, teamStaff } from '@/db/schema';
import { atLeast } from '@/lib/clanRoles';

/** A stable team colour per clan, matched to the nav/profile crest hue. */
export function teamColorForClan(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  // HSL(h, 55%, 50%) → hex, so teams.color (a hex string the board reads) matches the crest.
  const s = 0.55;
  const l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hx = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

export interface CohostRow {
  id: number;
  eventId: number;
  clanId: number;
  status: string;
  teamId: number | null;
  clanName: string;
  clanSlug: string;
  eventName: string;
  hostClanId: number;
}

/** Invite a clan to co-host an event. Returns the (possibly pre-existing) co-host row's id. */
export async function inviteCoHost(eventId: number, clanId: number, byUserId: number | null): Promise<{ id: number; created: boolean }> {
  const existing = await db
    .select({ id: eventCohosts.id })
    .from(eventCohosts)
    .where(and(eq(eventCohosts.eventId, eventId), eq(eventCohosts.clanId, clanId)))
    .then((r) => r[0]);
  if (existing) return { id: existing.id, created: false };
  const [row] = await db
    .insert(eventCohosts)
    .values({ eventId, clanId, status: 'pending', invitedByUserId: byUserId })
    .returning({ id: eventCohosts.id });
  return { id: row.id, created: true };
}

/** Pending co-host invites addressed to a clan — what its staff see and decide on. */
export async function pendingCoHostInvites(clanId: number): Promise<CohostRow[]> {
  return db
    .select({
      id: eventCohosts.id,
      eventId: eventCohosts.eventId,
      clanId: eventCohosts.clanId,
      status: eventCohosts.status,
      teamId: eventCohosts.teamId,
      clanName: clans.name,
      clanSlug: clans.slug,
      eventName: events.name,
      hostClanId: events.clanId,
    })
    .from(eventCohosts)
    .innerJoin(events, eq(events.id, eventCohosts.eventId))
    .innerJoin(clans, eq(clans.id, eventCohosts.clanId))
    .where(and(eq(eventCohosts.clanId, clanId), eq(eventCohosts.status, 'pending')));
}

/** Every co-host on an event (any status) — the host's roll-up. */
export async function cohostsForEvent(eventId: number): Promise<CohostRow[]> {
  return db
    .select({
      id: eventCohosts.id,
      eventId: eventCohosts.eventId,
      clanId: eventCohosts.clanId,
      status: eventCohosts.status,
      teamId: eventCohosts.teamId,
      clanName: clans.name,
      clanSlug: clans.slug,
      eventName: events.name,
      hostClanId: events.clanId,
    })
    .from(eventCohosts)
    .innerJoin(events, eq(events.id, eventCohosts.eventId))
    .innerJoin(clans, eq(clans.id, eventCohosts.clanId))
    .where(eq(eventCohosts.eventId, eventId));
}

/** True when a co-host clan has accepted — the access grant a co-host's members ride in on. */
export async function isAcceptedCohost(eventId: number, clanId: number): Promise<boolean> {
  const row = await db
    .select({ id: eventCohosts.id })
    .from(eventCohosts)
    .where(and(eq(eventCohosts.eventId, eventId), eq(eventCohosts.clanId, clanId), eq(eventCohosts.status, 'accepted')))
    .then((r) => r[0]);
  return !!row;
}

/** Clan ids of every clan that has ACCEPTED a co-host seat on this event. */
export async function acceptedCohostClanIds(eventId: number): Promise<number[]> {
  const rows = await db
    .select({ clanId: eventCohosts.clanId })
    .from(eventCohosts)
    .where(and(eq(eventCohosts.eventId, eventId), eq(eventCohosts.status, 'accepted')));
  return rows.map((r) => r.clanId);
}

/**
 * Hand a clan's staff (moderator and up — the people who run its side) the team_staff seats to run a
 * team. Idempotent: a seat only where one isn't already held, so a retry never duplicates. Shared by
 * provisionCoHostTeam (new team) and adoptTeamAsCoHost (existing team).
 */
async function grantTeamStaffToClan(teamId: number, clanId: number, byUserId: number | null): Promise<void> {
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { name: true } });
  const clanStaffRows = await db
    .select({ userId: clanStaff.userId, role: clanStaff.role })
    .from(clanStaff)
    .where(eq(clanStaff.clanId, clanId));
  const wanted = clanStaffRows.filter((r) => atLeast(r.role, 'moderator')).map((r) => r.userId);
  if (wanted.length === 0) return;
  const already = new Set(
    (
      await db
        .select({ userId: teamStaff.userId })
        .from(teamStaff)
        .where(and(eq(teamStaff.teamId, teamId), inArray(teamStaff.userId, wanted)))
    ).map((r) => r.userId),
  );
  const toGrant = wanted.filter((u) => !already.has(u));
  if (toGrant.length > 0) {
    await db.insert(teamStaff).values(
      toGrant.map((userId) => ({ teamId, userId, grantedByUserId: byUserId, note: `${clan?.name ?? 'Co-host'} staff (co-host)` })),
    );
  }
}

/**
 * Create (or reuse) the team a co-host clan fields on an event, and hand its staff the seats to run
 * it. Idempotent: one team per (event, clan), and a staff seat only where one isn't already held.
 */
export async function provisionCoHostTeam(eventId: number, clanId: number, byUserId: number | null): Promise<number> {
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { name: true, slug: true } });
  if (!clan) throw new Error('No such clan');

  // Reuse a team already tagged to this clan on this event (a re-run, or a hand-made one).
  let teamId =
    (
      await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.eventId, eventId), eq(teams.clanId, clanId)))
        .then((r) => r[0])
    )?.id ?? null;

  if (teamId == null) {
    const [team] = await db
      .insert(teams)
      .values({ eventId, clanId, name: clan.name, color: teamColorForClan(clan.slug) })
      .returning({ id: teams.id });
    teamId = team.id;
  }

  await grantTeamStaffToClan(teamId, clanId, byUserId);
  return teamId;
}

/**
 * Adopt an EXISTING team as a co-host's, keeping every player already on it.
 *
 * This is the cutover shape, not the fresh-invite shape. An old clan-vs-clan event is one clan's event
 * with a team per clan drawn by hand — the players are already there, on teams that just aren't tagged.
 * provisionCoHostTeam would make a NEW empty team and strand them; this tags the team they're on.
 *
 * Idempotent, and it refuses the two ways the (event, clan) unique tag could be violated: a team that
 * already belongs to a DIFFERENT clan, and another team on the event already standing in for THIS clan.
 */
export async function adoptTeamAsCoHost(
  eventId: number,
  teamId: number,
  coHostClanId: number,
  byUserId: number | null,
): Promise<{ ok: true; cohostId: number } | { ok: false; error: string }> {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { id: true, eventId: true, clanId: true },
  });
  if (!team || team.eventId !== eventId) return { ok: false, error: 'That team is not on this event' };
  if (team.clanId != null && team.clanId !== coHostClanId) return { ok: false, error: 'That team already belongs to another clan' };

  const clan = await db.query.clans.findFirst({ where: eq(clans.id, coHostClanId), columns: { id: true } });
  if (!clan) return { ok: false, error: 'No such clan' };

  // Another team already standing in for this clan would collide on teams_event_clan_unique.
  const clash = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.eventId, eventId), eq(teams.clanId, coHostClanId)))
    .then((r) => r[0]);
  if (clash && clash.id !== teamId) return { ok: false, error: 'Another team on this event is already this clan’s' };

  if (team.clanId == null) {
    await db.update(teams).set({ clanId: coHostClanId }).where(eq(teams.id, teamId));
  }
  await grantTeamStaffToClan(teamId, coHostClanId, byUserId);

  // Record the accepted co-host, pointing at the adopted team. Upsert on the (event, clan) pair.
  const existing = await db
    .select({ id: eventCohosts.id, status: eventCohosts.status })
    .from(eventCohosts)
    .where(and(eq(eventCohosts.eventId, eventId), eq(eventCohosts.clanId, coHostClanId)))
    .then((r) => r[0]);

  let cohostId: number;
  if (existing) {
    cohostId = existing.id;
    await db
      .update(eventCohosts)
      .set({ status: 'accepted', teamId, acceptedByUserId: byUserId, decidedAt: new Date().toISOString() })
      .where(eq(eventCohosts.id, cohostId));
  } else {
    const [row] = await db
      .insert(eventCohosts)
      .values({
        eventId,
        clanId: coHostClanId,
        status: 'accepted',
        teamId,
        invitedByUserId: byUserId,
        acceptedByUserId: byUserId,
        decidedAt: new Date().toISOString(),
      })
      .returning({ id: eventCohosts.id });
    cohostId = row.id;
  }

  return { ok: true, cohostId };
}

/**
 * Accept a co-host invite: mark it accepted and provision the team + staff. Only an admin (or owner)
 * of the INVITED clan may accept — the same bar as any decision that speaks for the clan. Idempotent:
 * an already-accepted invite just returns its team.
 */
export async function acceptCoHostInvite(
  cohostId: number,
  byUserId: number,
): Promise<{ ok: true; teamId: number } | { ok: false; error: string }> {
  const row = await db.query.eventCohosts.findFirst({ where: eq(eventCohosts.id, cohostId) });
  if (!row) return { ok: false, error: 'Invite not found' };
  if (row.status === 'declined') return { ok: false, error: 'This invite was declined' };

  // Authority: an admin+ of the invited clan.
  const staff = await db
    .select({ role: clanStaff.role })
    .from(clanStaff)
    .where(and(eq(clanStaff.clanId, row.clanId), eq(clanStaff.userId, byUserId)))
    .then((r) => r[0]);
  if (!staff || !atLeast(staff.role, 'admin')) return { ok: false, error: 'Only an admin of the invited clan can accept' };

  const teamId = await provisionCoHostTeam(row.eventId, row.clanId, byUserId);

  if (row.status !== 'accepted') {
    await db
      .update(eventCohosts)
      .set({ status: 'accepted', teamId, acceptedByUserId: byUserId, decidedAt: new Date().toISOString() })
      .where(eq(eventCohosts.id, cohostId));
  } else if (row.teamId == null) {
    await db.update(eventCohosts).set({ teamId }).where(eq(eventCohosts.id, cohostId));
  }

  return { ok: true, teamId };
}

/** Decline a co-host invite. Only an admin+ of the invited clan may. */
export async function declineCoHostInvite(cohostId: number, byUserId: number): Promise<{ ok: boolean; error?: string }> {
  const row = await db.query.eventCohosts.findFirst({ where: eq(eventCohosts.id, cohostId) });
  if (!row) return { ok: false, error: 'Invite not found' };
  if (row.status === 'accepted') return { ok: false, error: 'Already accepted — leave the event instead' };

  const staff = await db
    .select({ role: clanStaff.role })
    .from(clanStaff)
    .where(and(eq(clanStaff.clanId, row.clanId), eq(clanStaff.userId, byUserId)))
    .then((r) => r[0]);
  if (!staff || !atLeast(staff.role, 'admin')) return { ok: false, error: 'Only an admin of the invited clan can decline' };

  await db.update(eventCohosts).set({ status: 'declined', decidedAt: new Date().toISOString() }).where(eq(eventCohosts.id, cohostId));
  return { ok: true };
}
