/**
 * Team competitions — the database half (pure scoring lives in lib/competitionTeams).
 *
 *  - teams mode: weekly_competition_teams + weekly_participants.team_id; auto-balance; late joiners.
 *  - clans mode: weekly_competition_clans (invite by slug → an admin+ of the invited clan accepts,
 *    the same authority rule as event co-hosting in lib/coHost), partner-clan enrolment, and the
 *    visibility rule: a clan sees a competition it owns, or one it ACCEPTED an invite into — and an
 *    accepted partner only reads; every write stays with the owning clan.
 */
import { sweepSeatsSql } from '@/lib/weeklyGuests';
import { clanBeforeSpace, parseTypedSlug, slugWhere } from '@/lib/clanSlugLookup';
import { and, asc, desc, eq, inArray, isNotNull, isNull, notInArray, or } from 'drizzle-orm';

import { db } from '@/db';
import {
  clanRoster,
  clanStaff,
  clans,
  playerSnapshots,
  weeklyCompetitionClans,
  weeklyCompetitionTeams,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { parseStamp } from '@/lib/dbTime';
import { atLeast } from '@/lib/clanRoles';
import { canSeeClan } from '@/lib/clanAccess';
import { blockClan, inviteGate, reinvitedAt } from '@/lib/clanBlocks';
import { rosterClanSeat } from '@/lib/seatScope';
import { countsTowardLeaderboard } from '@/lib/weekly';
import { readMetricFromSnapshot } from '@/lib/weeklyMetric';
import {
  autoBalance,
  competitionMode,
  groupStandingsFromRows,
  smallestTeam,
  teamColour,
  type CompetitionMode,
  type GroupDef,
  type GroupStandingsView,
} from '@/lib/competitionTeams';

type Competition = typeof weeklyCompetitions.$inferSelect;

export const MAX_TEAMS = 16;
/** Clans in one clan-vs-clan competition, host included. A sanity cap, not a design limit — the
 *  standings, posts, lists and visibility checks all take any number. */
export const MAX_RACING_CLANS = 50;

// ── visibility ──────────────────────────────────────────────────────────────────────────────────

/**
 * The competition `id` as seen from `clanId`: the row when the clan owns it, or when it accepted an
 * invite into it (clan vs clan). Null otherwise. `owner` says which — only the owner may write.
 */
export async function competitionForClan(
  clanId: number,
  id: number,
): Promise<{ comp: Competition; owner: boolean } | null> {
  if (!Number.isInteger(id)) return null;
  // clan-scope: this clan -- loaded by id, then admitted only if clanId owns it or holds an accepted invite (below).
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, id) });
  if (!comp) return null;
  if (comp.clanId === clanId) return { comp, owner: true };
  if (competitionMode(comp.mode) !== 'clans') return null;
  const row = await db.query.weeklyCompetitionClans.findFirst({
    where: and(
      eq(weeklyCompetitionClans.competitionId, id),
      eq(weeklyCompetitionClans.clanId, clanId),
      eq(weeklyCompetitionClans.status, 'accepted'),
    ),
  });
  return row ? { comp, owner: false } : null;
}

/** The clans racing a clans-mode competition: the host, then accepted partners (by acceptance). */
export async function racingClans(
  comp: Pick<Competition, 'id' | 'clanId'>,
): Promise<{ id: number; name: string; slug: string; visibility: string | null }[]> {
  const host = await db.query.clans.findFirst({
    where: eq(clans.id, comp.clanId),
    columns: { id: true, name: true, slug: true, visibility: true },
  });
  const partners = await db
    .select({ id: clans.id, name: clans.name, slug: clans.slug, visibility: clans.visibility })
    .from(weeklyCompetitionClans)
    .innerJoin(clans, eq(clans.id, weeklyCompetitionClans.clanId))
    .where(and(eq(weeklyCompetitionClans.competitionId, comp.id), eq(weeklyCompetitionClans.status, 'accepted')))
    .orderBy(asc(weeklyCompetitionClans.decidedAt), asc(weeklyCompetitionClans.id));
  return [...(host ? [host] : []), ...partners];
}

/**
 * May this viewer read a competition's standings? A clan-vs-clan board shows every racing clan's
 * players, so it is readable only when EVERY racing clan's privacy lets the viewer in — however many
 * clans race. Solo/teams boards hold one clan, whose page layout already gates it.
 */
export async function competitionReadableBy(
  comp: Pick<Competition, 'id' | 'clanId' | 'mode'>,
  viewer: { playerId: number | null; userId: number | null },
): Promise<boolean> {
  if (competitionMode(comp.mode) !== 'clans') return true;
  for (const c of await racingClans(comp)) {
    if (!(await canSeeClan({ clanId: c.id, visibility: c.visibility, playerId: viewer.playerId, userId: viewer.userId }))) return false;
  }
  return true;
}

/**
 * The whole read rule for a competition's standings, for everything that is NOT the page: its JSON,
 * its link preview, its card.
 *
 * The page gets the first half for free — the root layout swaps a private clan's pages for its card
 * (lib/clanAccess) — and asks competitionReadableBy for the second. A route beside the page has no
 * layout, so it has to ask both, or the id in the URL reads what the page refuses to show.
 *
 * `ANONYMOUS_VIEWER` is who a link preview is for: whoever the link gets pasted to.
 */
export async function competitionStandingsReadableBy(
  comp: Pick<Competition, 'id' | 'clanId' | 'mode'>,
  viewer: { playerId: number | null; userId: number | null },
): Promise<boolean> {
  const host = await db.query.clans.findFirst({ where: eq(clans.id, comp.clanId), columns: { id: true, visibility: true } });
  if (!host) return false;
  if (!(await canSeeClan({ clanId: host.id, visibility: host.visibility, playerId: viewer.playerId, userId: viewer.userId }))) return false;
  return competitionReadableBy(comp, viewer);
}

export const ANONYMOUS_VIEWER = { playerId: null, userId: null } as const;

/** Active clans-mode competitions `clanId` is a partner in (not the host) — for the plugin and lists. */
export async function partnerCompetitions(clanId: number, status?: string): Promise<Competition[]> {
  const rows = await db
    .select({ comp: weeklyCompetitions })
    .from(weeklyCompetitionClans)
    .innerJoin(weeklyCompetitions, eq(weeklyCompetitions.id, weeklyCompetitionClans.competitionId))
    .where(
      and(
        eq(weeklyCompetitionClans.clanId, clanId),
        eq(weeklyCompetitionClans.status, 'accepted'),
        eq(weeklyCompetitions.mode, 'clans'),
        status ? eq(weeklyCompetitions.status, status) : undefined,
      ),
    )
    .orderBy(desc(weeklyCompetitions.startDate));
  return rows.map((r) => r.comp);
}

// ── mode ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Change a competition's mode. Switching away from teams leaves the teams in place (switching back
 * restores them); away from clans keeps the invite rows but partner participants are removed, since
 * they are only on the board because of the clan-vs-clan link.
 */
export async function setCompetitionMode(comp: Competition, mode: CompetitionMode, teamLateJoin?: boolean): Promise<void> {
  const patch: Partial<Competition> = { mode };
  if (typeof teamLateJoin === 'boolean') patch.teamLateJoin = teamLateJoin;
  await db.update(weeklyCompetitions).set(patch).where(eq(weeklyCompetitions.id, comp.id));
  if (competitionMode(comp.mode) === 'clans' && mode !== 'clans') {
    await db
      .delete(weeklyParticipants)
      .where(and(eq(weeklyParticipants.competitionId, comp.id), isNotNull(weeklyParticipants.clanId)));
  }
}

// ── who from the host clan races ────────────────────────────────────────────────────────────────

/**
 * Has this competition not begun? Upcoming by status AND by its own start time: the status is
 * flipped by a cron tick, so for a minute or so after the start it still says 'upcoming' while
 * baselines are about to be read.
 */
export function competitionNotStarted(comp: Pick<Competition, 'status' | 'startDate'>, now: number = Date.now()): boolean {
  if (comp.status !== 'upcoming') return false;
  const start = parseStamp(comp.startDate);
  return start !== null && start > now;
}

/**
 * Take the host clan's own entrants off a competition that has NOT started — the organiser switched
 * it to "Selected people" and chose to pick from scratch rather than keep the roster that was swept
 * in when it was created. Partner clans' rows (clan vs clan) are theirs and stay.
 *
 * Refused once the competition has started: by then a row carries a baseline and a standing, and
 * removing people in bulk mid-race is a different decision (one at a time, on Participants).
 * Returns how many were removed, or null when refused.
 */
export async function clearHostEntrants(comp: Pick<Competition, 'id' | 'status' | 'startDate'>, now: number = Date.now()): Promise<number | null> {
  if (!competitionNotStarted(comp, now)) return null;
  const removed = await db
    .delete(weeklyParticipants)
    // A host row is one with no clan of its own (db/schema weeklyParticipants.clanId).
    .where(and(eq(weeklyParticipants.competitionId, comp.id), isNull(weeklyParticipants.clanId)))
    .returning({ id: weeklyParticipants.id });
  return removed.length;
}

/**
 * A repeating "Selected people" competition's next week starts with the same people (lib/weeklyRepeat):
 * the host's entrants of last week who still hold an active seat on the host's roster. Without it the
 * next week would start empty, since nothing sweeps a selected host side in. Opt-outs are per
 * competition and are not carried. A no-op for an "All members" competition.
 */
export async function carryOverSelectedEntrants(prev: Competition, next: Competition): Promise<number> {
  if (prev.hostEntrants !== 'selected') return 0;
  // People who signed themselves up are not carried: each week is entered afresh, and with a fee,
  // paid afresh (lib/weeklySignups).
  if (prev.selfSignup) return 0;
  const seats = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn })
    .from(weeklyParticipants)
    .innerJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(
      and(
        eq(weeklyParticipants.competitionId, prev.id),
        isNull(weeklyParticipants.clanId),
        // The host's own roster, by the same seat rules as the sweep (lib/weekly enrollAllPlayers).
        eq(clanRoster.clanId, prev.clanId),
        isNull(clanRoster.leftAt),
        eq(clanRoster.status, 'active'),
        rosterClanSeat(),
      ),
    );
  let carried = 0;
  for (const seat of seats) {
    const ins = await db
      .insert(weeklyParticipants)
      .values({ competitionId: next.id, clanMemberId: seat.id, rsn: seat.rsn, rsnNormalized: normalizeRsn(seat.rsn) })
      .onConflictDoNothing()
      .returning({ id: weeklyParticipants.id });
    carried += ins.length;
  }
  return carried;
}

// ── teams ───────────────────────────────────────────────────────────────────────────────────────

export async function listTeams(competitionId: number) {
  return db
    .select()
    .from(weeklyCompetitionTeams)
    .where(eq(weeklyCompetitionTeams.competitionId, competitionId))
    .orderBy(asc(weeklyCompetitionTeams.sortOrder), asc(weeklyCompetitionTeams.id));
}

export async function createTeam(competitionId: number, name: string, colour?: string) {
  const existing = await listTeams(competitionId);
  if (existing.length >= MAX_TEAMS) return { ok: false as const, error: `At most ${MAX_TEAMS} teams` };
  const clean = name.trim().slice(0, 40);
  if (!clean) return { ok: false as const, error: 'Name the team' };
  const [row] = await db
    .insert(weeklyCompetitionTeams)
    .values({
      competitionId,
      name: clean,
      colour: teamColour(colour, existing.length),
      sortOrder: existing.length,
    })
    .returning();
  return { ok: true as const, team: row };
}

/** Rename/recolour. Scoped by competition so a team id from another competition is a no-op. */
export async function updateTeam(competitionId: number, teamId: number, patch: { name?: string; colour?: string }) {
  const set: { name?: string; colour?: string } = {};
  if (typeof patch.name === 'string' && patch.name.trim()) set.name = patch.name.trim().slice(0, 40);
  if (typeof patch.colour === 'string') set.colour = teamColour(patch.colour);
  if (!Object.keys(set).length) return 0;
  const r = await db
    .update(weeklyCompetitionTeams)
    .set(set)
    .where(and(eq(weeklyCompetitionTeams.id, teamId), eq(weeklyCompetitionTeams.competitionId, competitionId)))
    .returning({ id: weeklyCompetitionTeams.id });
  return r.length;
}

/** Delete a team; its members become unassigned (FK set null). */
export async function deleteTeam(competitionId: number, teamId: number) {
  const r = await db
    .delete(weeklyCompetitionTeams)
    .where(and(eq(weeklyCompetitionTeams.id, teamId), eq(weeklyCompetitionTeams.competitionId, competitionId)))
    .returning({ id: weeklyCompetitionTeams.id });
  return r.length;
}

/**
 * Put participants on teams (teamId null = unassign). Both ids are checked against the competition:
 * a participant or team from another competition is skipped, never moved.
 */
export async function assignParticipants(
  competitionId: number,
  assignments: { participantId: number; teamId: number | null }[],
): Promise<number> {
  const teamIds = new Set((await listTeams(competitionId)).map((t) => t.id));
  let moved = 0;
  for (const a of assignments) {
    if (!Number.isInteger(a.participantId)) continue;
    if (a.teamId !== null && !teamIds.has(a.teamId)) continue;
    const r = await db
      .update(weeklyParticipants)
      .set({ teamId: a.teamId })
      .where(and(eq(weeklyParticipants.id, a.participantId), eq(weeklyParticipants.competitionId, competitionId)))
      .returning({ id: weeklyParticipants.id });
    moved += r.length;
  }
  return moved;
}

/**
 * Participant strength for auto-balance: the stat itself (XP/KC) as it stands now. The row's own
 * reading first; a competition that has not started has none yet, so fall back to the account's
 * latest stored hiscores snapshot from any competition.
 */
async function strengths(comp: Competition, rows: { id: number; currentValue: number | null; baselineValue: number | null; accountId: number | null }[]) {
  const out: { id: number; strength: number }[] = [];
  const missing = rows.filter((r) => r.currentValue == null && r.baselineValue == null && r.accountId != null);
  const fromSnapshot = new Map<number, number>();
  if (missing.length) {
    const snaps = await db
      .select({ accountId: playerSnapshots.accountId, payload: playerSnapshots.payload, at: playerSnapshots.capturedAt })
      .from(playerSnapshots)
      .where(inArray(playerSnapshots.accountId, missing.map((m) => m.accountId!)))
      .orderBy(desc(playerSnapshots.capturedAt));
    for (const s of snaps) {
      if (fromSnapshot.has(s.accountId)) continue;
      try {
        const r = readMetricFromSnapshot(JSON.parse(s.payload), comp.type as never, comp.metric);
        if (r.kind === 'value') fromSnapshot.set(s.accountId, r.value);
      } catch {
        // Unreadable payload — this account balances as 0.
      }
    }
  }
  for (const r of rows) {
    const v = r.currentValue ?? r.baselineValue ?? (r.accountId != null ? fromSnapshot.get(r.accountId) : undefined) ?? 0;
    out.push({ id: r.id, strength: Math.max(0, v) });
  }
  return out;
}

/** Re-split every counting participant across the existing teams, balanced by current level/KC. */
export async function autoBalanceTeams(comp: Competition): Promise<{ ok: boolean; error?: string; assigned: number }> {
  const teams = await listTeams(comp.id);
  if (teams.length < 2) return { ok: false, error: 'Make at least two teams first', assigned: 0 };
  // clan-scope: this clan -- one competition's participants; the caller (competitionForRequest) settled the owning clan.
  const rows = await db
    .select({
      id: weeklyParticipants.id,
      currentValue: weeklyParticipants.currentValue,
      baselineValue: weeklyParticipants.baselineValue,
      accountId: clanRoster.accountId,
    })
    .from(weeklyParticipants)
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(weeklyParticipants.competitionId, comp.id), countsTowardLeaderboard()));
  const split = autoBalance(await strengths(comp, rows), teams.length);
  const assignments = [...split].map(([participantId, idx]) => ({ participantId, teamId: teams[idx].id }));
  return { ok: true, assigned: await assignParticipants(comp.id, assignments) };
}

/**
 * Late joiners: in a teams competition with late-join on, every counting participant without a team
 * goes into the smallest team. Runs after each enrolment pass. No teams yet = nothing to do (the
 * admin is still setting up).
 */
export async function placeLateJoiners(competitionId: number): Promise<number> {
  // clan-scope: global -- runs from the platform-wide enrolment tick; reads one competition by id.
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, competitionId) });
  if (!comp || competitionMode(comp.mode) !== 'teams' || !comp.teamLateJoin) return 0;
  const teams = await listTeams(competitionId);
  if (!teams.length) return 0;
  // clan-scope: this clan -- one competition's participants, scoped by competition id.
  const rows = await db
    .select({ id: weeklyParticipants.id, teamId: weeklyParticipants.teamId })
    .from(weeklyParticipants)
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(weeklyParticipants.competitionId, competitionId), countsTowardLeaderboard()));
  const unassigned = rows.filter((r) => r.teamId == null);
  if (!unassigned.length) return 0;
  const counts = teams.map((t) => ({ id: t.id, members: rows.filter((r) => r.teamId === t.id).length }));
  let placed = 0;
  for (const p of unassigned) {
    const teamId = smallestTeam(counts);
    if (teamId == null) break;
    await db.update(weeklyParticipants).set({ teamId }).where(eq(weeklyParticipants.id, p.id));
    counts.find((c) => c.id === teamId)!.members++;
    placed++;
  }
  return placed;
}

// ── clans (clan vs clan) ────────────────────────────────────────────────────────────────────────

/** Invite a clan, by slug, into a clans-mode competition the host clan owns. Re-opens a declined invite. */
export async function inviteClanToCompetition(
  comp: Competition,
  hostClanId: number,
  slug: string,
  byUserId: number | null,
): Promise<{ ok: true; id: number } | { ok: false; error: string; status: number }> {
  if (comp.clanId !== hostClanId) return { ok: false, error: 'Not your competition', status: 404 };
  if (competitionMode(comp.mode) !== 'clans') return { ok: false, error: 'Switch the competition to clan vs clan first', status: 400 };
  if (comp.status === 'completed') return { ok: false, error: 'This competition has ended', status: 400 };
  // Typed by a person: `/s/x` or `/c/x` says which; a bare slug is the clan, else the space.
  const typed = parseTypedSlug(slug);
  const target = typed
    ? await db.query.clans.findFirst({ where: slugWhere(typed.slug, typed.kind), orderBy: [clanBeforeSpace] })
    : undefined;
  if (!target) return { ok: false, error: 'No clan with that address', status: 404 };
  if (target.id === hostClanId) return { ok: false, error: 'That is your own clan', status: 400 };
  const existing = await db.query.weeklyCompetitionClans.findFirst({
    where: and(eq(weeklyCompetitionClans.competitionId, comp.id), eq(weeklyCompetitionClans.clanId, target.id)),
  });
  if (existing && existing.status !== 'declined') return { ok: true, id: existing.id };

  // Any number of clans may race — capped only for sanity (MAX_RACING_CLANS, host included).
  const racing = await db
    .select({ id: weeklyCompetitionClans.id })
    .from(weeklyCompetitionClans)
    .where(and(eq(weeklyCompetitionClans.competitionId, comp.id), inArray(weeklyCompetitionClans.status, ['pending', 'accepted'])));
  if (racing.length + 1 >= MAX_RACING_CLANS) {
    return { ok: false, error: `At most ${MAX_RACING_CLANS} clans can race one competition`, status: 400 };
  }

  // Blocks and the invite rate limit (lib/clanBlocks). A clan that blocked us is refused SILENTLY:
  // the row is written already declined, so they never see it and we see "declined" — no "you're
  // blocked" message to probe with.
  const gate = await inviteGate(hostClanId, target.id);
  if (gate.kind === 'refused') return { ok: false, error: gate.error, status: gate.status };
  if (gate.kind === 'silent') {
    if (existing) return { ok: true, id: existing.id };
    const [row] = await db
      .insert(weeklyCompetitionClans)
      .values({ competitionId: comp.id, clanId: target.id, invitedByUserId: byUserId, status: 'declined', decidedAt: new Date().toISOString() })
      .returning({ id: weeklyCompetitionClans.id });
    return { ok: true, id: row.id };
  }

  if (existing) {
    if (existing.status === 'declined') {
      await db
        .update(weeklyCompetitionClans)
        .set({ status: 'pending', invitedByUserId: byUserId, decidedAt: null, decidedByUserId: null, createdAt: reinvitedAt() })
        .where(eq(weeklyCompetitionClans.id, existing.id));
    }
    return { ok: true, id: existing.id };
  }
  const [row] = await db
    .insert(weeklyCompetitionClans)
    .values({ competitionId: comp.id, clanId: target.id, invitedByUserId: byUserId })
    .returning({ id: weeklyCompetitionClans.id });
  return { ok: true, id: row.id };
}

async function isClanAdmin(clanId: number, userId: number): Promise<boolean> {
  const staff = await db
    .select({ role: clanStaff.role })
    .from(clanStaff)
    .where(and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, userId)))
    .then((r) => r[0]);
  return !!staff && atLeast(staff.role, 'admin');
}

export type EntrantsChoice = { entrants: 'all' } | { entrants: 'selected'; rsns: string[] };

export function parseEntrantsChoice(raw: unknown): EntrantsChoice | null {
  const o = raw as { entrants?: unknown; rsns?: unknown } | null;
  if (!o || o.entrants === undefined || o.entrants === 'all') return { entrants: 'all' };
  if (o.entrants === 'selected') {
    const rsns = Array.isArray(o.rsns) ? o.rsns.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 500) : [];
    return { entrants: 'selected', rsns };
  }
  return null;
}

/**
 * The invited clan answers. Only an admin+ (clan_staff) of the INVITED clan may — the same bar as
 * accepting an event co-host invite. Nobody from that clan is entered until it accepts; on accept its
 * side is entered per its choice — every member ('all', the default) or the people it picks
 * ('selected'). Each player can then opt out (setOptOut).
 *
 * 'block' declines AND blocks the sending clan (lib/clanBlocks): its later invites are refused silently.
 */
export async function respondToCompetitionInvite(
  inviteId: number,
  byUserId: number,
  action: 'accept' | 'decline' | 'block',
  choice: EntrantsChoice = { entrants: 'all' },
): Promise<{ ok: true; competitionId: number; unknown?: string[] } | { ok: false; error: string }> {
  const row = await db.query.weeklyCompetitionClans.findFirst({ where: eq(weeklyCompetitionClans.id, inviteId) });
  if (!row) return { ok: false, error: 'Invite not found' };
  if (!(await isClanAdmin(row.clanId, byUserId))) return { ok: false, error: 'Only an owner or admin of the invited clan can answer' };
  // clan-scope: this clan -- the invite row names the clan; the competition is read for its status and host only.
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, row.competitionId) });
  if (!comp) return { ok: false, error: 'Invite not found' };

  if (action === 'decline' || action === 'block') {
    if (row.status === 'accepted') return { ok: false, error: 'Already racing — ask the host to remove your clan' };
    await db
      .update(weeklyCompetitionClans)
      .set({ status: 'declined', decidedByUserId: byUserId, decidedAt: new Date().toISOString() })
      .where(eq(weeklyCompetitionClans.id, inviteId));
    if (action === 'block') await blockClan(row.clanId, comp.clanId, byUserId);
    return { ok: true, competitionId: row.competitionId };
  }
  if (comp.status === 'completed') return { ok: false, error: 'This competition has ended' };
  if (row.status === 'declined') return { ok: false, error: 'This invite was declined' };
  if (row.status !== 'accepted') {
    await db
      .update(weeklyCompetitionClans)
      .set({ status: 'accepted', entrants: choice.entrants, decidedByUserId: byUserId, decidedAt: new Date().toISOString() })
      .where(eq(weeklyCompetitionClans.id, inviteId));
  }
  const unknown = await applyClanEntrants(row.competitionId, row.clanId, choice);
  return { ok: true, competitionId: row.competitionId, unknown };
}

/**
 * A partner clan changes its side later: all members, or a picked list. Owner/admin of THAT clan
 * only, on an accepted invite of a running or upcoming competition.
 */
export async function setPartnerEntrants(
  inviteId: number,
  byUserId: number,
  choice: EntrantsChoice,
): Promise<{ ok: true; unknown: string[] } | { ok: false; error: string }> {
  const row = await db.query.weeklyCompetitionClans.findFirst({ where: eq(weeklyCompetitionClans.id, inviteId) });
  if (!row || row.status !== 'accepted') return { ok: false, error: 'Invite not found' };
  if (!(await isClanAdmin(row.clanId, byUserId))) return { ok: false, error: 'Only an owner or admin of your clan can choose who races' };
  // clan-scope: this clan -- read by the invite's competition id for its status only.
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, row.competitionId) });
  if (!comp || comp.status === 'completed') return { ok: false, error: 'This competition has ended' };
  await db.update(weeklyCompetitionClans).set({ entrants: choice.entrants }).where(eq(weeklyCompetitionClans.id, inviteId));
  return { ok: true, unknown: await applyClanEntrants(row.competitionId, row.clanId, choice) };
}

/**
 * Put one partner clan's side in line with its choice. 'all' enters every eligible member (the same
 * seat rules as the host's sweep). 'selected' enters exactly the picked RSNs that are seats in THAT
 * clan, and takes off anyone of that clan not picked. Returns picked names that matched no seat.
 * Opt-outs survive: a re-entered row keeps opted_out.
 */
async function applyClanEntrants(competitionId: number, clanId: number, choice: EntrantsChoice): Promise<string[]> {
  if (choice.entrants === 'all') {
    await enrollPartnerClans(competitionId);
    return [];
  }
  const wanted = new Map(choice.rsns.map((r) => [normalizeRsn(r), r]));
  const seats = wanted.size
    ? await db
        .select({ id: clanRoster.id, rsn: clanRoster.rsn, rsnNormalized: clanRoster.rsnNormalized })
        .from(clanRoster)
        .where(
          and(
            eq(clanRoster.clanId, clanId),
            isNull(clanRoster.leftAt),
            rosterClanSeat(),
            inArray(clanRoster.rsnNormalized, [...wanted.keys()]),
          ),
        )
    : [];
  const seatIds = seats.map((x) => x.id);
  // Off the board: this clan's entrants who weren't picked.
  await db
    .delete(weeklyParticipants)
    .where(
      and(
        eq(weeklyParticipants.competitionId, competitionId),
        eq(weeklyParticipants.clanId, clanId),
        seatIds.length ? notInArray(weeklyParticipants.clanMemberId, seatIds) : undefined,
      ),
    );
  for (const seat of seats) {
    await db
      .insert(weeklyParticipants)
      .values({ competitionId, clanMemberId: seat.id, clanId, rsn: seat.rsn, rsnNormalized: normalizeRsn(seat.rsn) })
      .onConflictDoNothing();
  }
  const found = new Set(seats.map((x) => x.rsnNormalized));
  return [...wanted].filter(([k]) => !found.has(k)).map(([, v]) => v);
}

// ── opting out ──────────────────────────────────────────────────────────────────────────────────

/**
 * A player opts out of (or back into) one competition. Every row of theirs in it — any of their
 * characters — flips; the row stays so the roster sweep doesn't re-enter them. Refused once the
 * competition has ended. `by` is the person (site session) or one account (plugin token).
 */
export async function setOptOut(
  competitionId: number,
  by: { playerId: number } | { accountId: number },
  optedOut: boolean,
  /** One character of theirs only (a seat id); omitted = every character they have entered. */
  seatId?: number | null,
): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
  // clan-scope: this clan -- the caller resolved the competition through competitionForClan.
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, competitionId), columns: { status: true } });
  if (!comp) return { ok: false, error: 'Not found' };
  if (comp.status === 'completed') return { ok: false, error: 'This competition has ended' };
  const all = await mySeatIds(by);
  // A seat that isn't theirs is simply not in the list: nothing of anybody else's moves.
  const seatIds = seatId != null ? all.filter((id) => id === seatId) : all;
  if (!seatIds.length) return { ok: false, error: 'You are not entered in this competition' };
  const r = await db
    .update(weeklyParticipants)
    .set({ optedOut })
    .where(and(eq(weeklyParticipants.competitionId, competitionId), inArray(weeklyParticipants.clanMemberId, seatIds)))
    .returning({ id: weeklyParticipants.id });
  if (!r.length) return { ok: false, error: 'You are not entered in this competition' };
  return { ok: true, changed: r.length };
}

async function mySeatIds(by: { playerId: number } | { accountId: number }): Promise<number[]> {
  // clan-scope: global -- the subject is one person's (or one account's) own seats, across clans by design.
  const rows = await db
    .select({ id: clanRoster.id })
    .from(clanRoster)
    .where('playerId' in by ? eq(clanRoster.playerId, by.playerId) : eq(clanRoster.accountId, by.accountId));
  return rows.map((r) => r.id);
}

/** Is this person entered, and opted out? For "You're in · Opt out" on the site and in the panel. */
export async function entryStatus(
  competitionId: number,
  by: { playerId: number } | { accountId: number },
): Promise<{ entered: boolean; optedOut: boolean; seats: { seatId: number; rsn: string; optedOut: boolean }[] }> {
  const seatIds = await mySeatIds(by);
  if (!seatIds.length) return { entered: false, optedOut: false, seats: [] };
  const rows = await db
    .select({ optedOut: weeklyParticipants.optedOut, seatId: weeklyParticipants.clanMemberId, rsn: weeklyParticipants.rsn })
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, competitionId), inArray(weeklyParticipants.clanMemberId, seatIds)));
  if (!rows.length) return { entered: false, optedOut: false, seats: [] };
  // Each character of theirs on its own, so one can sit a week out while another races.
  const seats = rows.map((r) => ({ seatId: r.seatId!, rsn: r.rsn, optedOut: r.optedOut })).sort((a, b) => a.rsn.localeCompare(b.rsn));
  return { entered: true, optedOut: rows.every((r) => r.optedOut), seats };
}

/** Host removes a partner (any status). Its participants leave the board with it. */
export async function removeCompetitionClan(comp: Competition, hostClanId: number, inviteId: number): Promise<boolean> {
  if (comp.clanId !== hostClanId) return false;
  const [row] = await db
    .delete(weeklyCompetitionClans)
    .where(and(eq(weeklyCompetitionClans.id, inviteId), eq(weeklyCompetitionClans.competitionId, comp.id)))
    .returning({ clanId: weeklyCompetitionClans.clanId });
  if (!row) return false;
  await db
    .delete(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, comp.id), eq(weeklyParticipants.clanId, row.clanId)));
  return true;
}

/** Every invite of a competition (host's admin view). */
export async function competitionInvites(competitionId: number) {
  return db
    .select({
      id: weeklyCompetitionClans.id,
      clanId: weeklyCompetitionClans.clanId,
      status: weeklyCompetitionClans.status,
      name: clans.name,
      slug: clans.slug,
      createdAt: weeklyCompetitionClans.createdAt,
      decidedAt: weeklyCompetitionClans.decidedAt,
    })
    .from(weeklyCompetitionClans)
    .innerJoin(clans, eq(clans.id, weeklyCompetitionClans.clanId))
    .where(eq(weeklyCompetitionClans.competitionId, competitionId))
    .orderBy(asc(weeklyCompetitionClans.id));
}

export interface CompetitionInviteRow {
  id: number;
  status: string;
  competitionId: number;
  title: string;
  type: string;
  metric: string;
  startDate: string;
  endDate: string;
  hostName: string;
  hostSlug: string;
  /** 'clan' | 'creator' — which address the host slug is under. */
  hostKind: string;
  /** This clan's side: 'all' members or 'selected' people. */
  entrants: string;
  /** Who this clan entered, when 'selected' (to prefill the picker). */
  picked: string[];
}

/** Invites addressed to `clanId` that are pending, plus accepted ones still running (for the admin list). */
export async function competitionInvitesForClan(clanId: number): Promise<CompetitionInviteRow[]> {
  const rows = await db
    .select({
      id: weeklyCompetitionClans.id,
      status: weeklyCompetitionClans.status,
      entrants: weeklyCompetitionClans.entrants,
      clanId: weeklyCompetitionClans.clanId,
      competitionId: weeklyCompetitions.id,
      title: weeklyCompetitions.title,
      type: weeklyCompetitions.type,
      metric: weeklyCompetitions.metric,
      startDate: weeklyCompetitions.startDate,
      endDate: weeklyCompetitions.endDate,
      compStatus: weeklyCompetitions.status,
      hostName: clans.name,
      hostSlug: clans.slug,
      hostKind: clans.kind,
    })
    .from(weeklyCompetitionClans)
    .innerJoin(weeklyCompetitions, eq(weeklyCompetitions.id, weeklyCompetitionClans.competitionId))
    .innerJoin(clans, eq(clans.id, weeklyCompetitions.clanId))
    .where(
      and(
        eq(weeklyCompetitionClans.clanId, clanId),
        or(eq(weeklyCompetitionClans.status, 'pending'), eq(weeklyCompetitionClans.status, 'accepted')),
      ),
    )
    .orderBy(desc(weeklyCompetitions.startDate));
  const live = rows.filter((r) => r.compStatus !== 'completed');
  const out: CompetitionInviteRow[] = [];
  for (const { compStatus, clanId: cid, ...r } of live) {
    void compStatus;
    const picked =
      r.status === 'accepted' && r.entrants === 'selected'
        ? (
            await db
              .select({ rsn: weeklyParticipants.rsn })
              .from(weeklyParticipants)
              .where(and(eq(weeklyParticipants.competitionId, r.competitionId), eq(weeklyParticipants.clanId, cid)))
          ).map((p) => p.rsn)
        : [];
    out.push({ ...r, picked });
  }
  return out;
}

/**
 * Enrol every accepted partner clan that chose 'all' members, tagged with its clan. Pending invites
 * enter nobody.
 * Same seat rules as lib/weekly enrollAllPlayers (active, not left, not an event seat, guests per
 * the competition's own flag). Idempotent: someone already entered (e.g. in both clans) keeps the
 * row they have.
 */
export async function enrollPartnerClans(competitionId: number): Promise<number> {
  // clan-scope: global -- runs from the platform-wide enrolment tick; each partner roster read below names its clan.
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, competitionId) });
  if (!comp || competitionMode(comp.mode) !== 'clans') return 0;
  const partners = await db
    .select({ clanId: weeklyCompetitionClans.clanId })
    .from(weeklyCompetitionClans)
    .where(
      and(
        eq(weeklyCompetitionClans.competitionId, competitionId),
        eq(weeklyCompetitionClans.status, 'accepted'),
        // 'selected' clans enter only the people they pick (applyClanEntrants) — never swept.
        eq(weeklyCompetitionClans.entrants, 'all'),
      ),
    );
  let enrolled = 0;
  for (const { clanId } of partners) {
    const seats = await db
      .select({ id: clanRoster.id, rsn: clanRoster.rsn })
      .from(clanRoster)
      .where(
        and(
          eq(clanRoster.clanId, clanId),
          isNull(clanRoster.leftAt),
          eq(clanRoster.status, 'active'),
          rosterClanSeat(),
          sweepSeatsSql(comp.includeGuests),
        ),
      );
    for (const s of seats) {
      const ins = await db
        .insert(weeklyParticipants)
        .values({ competitionId, clanMemberId: s.id, clanId, rsn: s.rsn, rsnNormalized: normalizeRsn(s.rsn) })
        .onConflictDoNothing()
        .returning({ id: weeklyParticipants.id });
      enrolled += ins.length;
    }
  }
  return enrolled;
}

// ── standings ───────────────────────────────────────────────────────────────────────────────────

export type { GroupStandingsView };

/**
 * Team or clan standings for a competition. `viewer` identifies "your" group — by roster seat ids
 * (site) or by RSN (plugin). Null for solo competitions. The ranking itself is
 * groupStandingsFromRows (lib/competitionTeams), shared with the events list.
 */
export async function buildGroupStandings(
  comp: Pick<Competition, 'id' | 'clanId' | 'mode'>,
  viewer?: { memberIds?: number[]; rsn?: string | null },
): Promise<GroupStandingsView | null> {
  const mode = competitionMode(comp.mode);
  if (mode === 'solo') return null;

  const rows = await db
    .select({
      rsn: weeklyParticipants.rsn,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
      gainAt: weeklyParticipants.gainAt,
      teamId: weeklyParticipants.teamId,
      clanId: weeklyParticipants.clanId,
      clanMemberId: weeklyParticipants.clanMemberId,
    })
    .from(weeklyParticipants)
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(weeklyParticipants.competitionId, comp.id), countsTowardLeaderboard()));

  let defs: (GroupDef & { slug?: string })[];
  if (mode === 'teams') {
    defs = (await listTeams(comp.id)).map((t) => ({ key: t.id, name: t.name, colour: t.colour }));
  } else {
    defs = (await racingClans(comp)).map((c, i) => ({ key: c.id, name: c.name, slug: c.slug, colour: teamColour(null, i) }));
  }
  return groupStandingsFromRows(comp, rows, defs, viewer);
}

// ── repeating competitions ──────────────────────────────────────────────────────────────────────

/**
 * A repeating competition's next week keeps its format (lib/weeklyRepeat): the same teams (names
 * and colours — membership is re-balanced after enrolment), or for clan vs clan, a fresh PENDING
 * invite to every clan that raced last week. Agreeing to one week is not agreeing to every week.
 */
export async function carryOverTeamSetup(prev: Competition, next: Competition): Promise<void> {
  const mode = competitionMode(prev.mode);
  if (mode === 'teams') {
    for (const t of await listTeams(prev.id)) {
      await db.insert(weeklyCompetitionTeams).values({ competitionId: next.id, name: t.name, colour: t.colour, sortOrder: t.sortOrder });
    }
  } else if (mode === 'clans') {
    const raced = await db
      .select({ clanId: weeklyCompetitionClans.clanId })
      .from(weeklyCompetitionClans)
      .where(and(eq(weeklyCompetitionClans.competitionId, prev.id), eq(weeklyCompetitionClans.status, 'accepted')));
    for (const r of raced) {
      await db
        .insert(weeklyCompetitionClans)
        .values({ competitionId: next.id, clanId: r.clanId, invitedByUserId: prev.createdById })
        .onConflictDoNothing();
    }
  }
}
