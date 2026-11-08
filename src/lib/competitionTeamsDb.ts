/**
 * Team competitions — the database half (pure scoring lives in lib/competitionTeams).
 *
 *  - teams mode: weekly_competition_teams + weekly_participants.team_id; auto-balance; late joiners.
 *  - clans mode: weekly_competition_clans (invite by slug → an admin+ of the invited clan accepts,
 *    the same authority rule as event co-hosting in lib/coHost), partner-clan enrolment, and the
 *    visibility rule: a clan sees a competition it owns, or one it ACCEPTED an invite into — and an
 *    accepted partner only reads; every write stays with the owning clan.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';

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
import { atLeast } from '@/lib/clanRoles';
import { rosterClanSeat } from '@/lib/seatScope';
import { countsTowardLeaderboard } from '@/lib/weekly';
import { readMetricFromSnapshot } from '@/lib/weeklyMetric';
import { weeklyRsnKey } from '@/lib/weeklyRsn';
import {
  autoBalance,
  competitionMode,
  rankGroups,
  smallestTeam,
  teamColour,
  type CompetitionMode,
  type GroupDef,
  type GroupEntry,
  type GroupStanding,
} from '@/lib/competitionTeams';

type Competition = typeof weeklyCompetitions.$inferSelect;

export const MAX_TEAMS = 16;

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
export async function racingClans(comp: Pick<Competition, 'id' | 'clanId'>): Promise<{ id: number; name: string; slug: string }[]> {
  const host = await db.query.clans.findFirst({ where: eq(clans.id, comp.clanId), columns: { id: true, name: true, slug: true } });
  const partners = await db
    .select({ id: clans.id, name: clans.name, slug: clans.slug })
    .from(weeklyCompetitionClans)
    .innerJoin(clans, eq(clans.id, weeklyCompetitionClans.clanId))
    .where(and(eq(weeklyCompetitionClans.competitionId, comp.id), eq(weeklyCompetitionClans.status, 'accepted')))
    .orderBy(asc(weeklyCompetitionClans.decidedAt), asc(weeklyCompetitionClans.id));
  return [...(host ? [host] : []), ...partners];
}

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
  const target = await db.query.clans.findFirst({ where: eq(clans.slug, slug.trim().toLowerCase()) });
  if (!target) return { ok: false, error: 'No clan with that address', status: 404 };
  if (target.id === hostClanId) return { ok: false, error: 'That is your own clan', status: 400 };
  const existing = await db.query.weeklyCompetitionClans.findFirst({
    where: and(eq(weeklyCompetitionClans.competitionId, comp.id), eq(weeklyCompetitionClans.clanId, target.id)),
  });
  if (existing) {
    if (existing.status === 'declined') {
      await db
        .update(weeklyCompetitionClans)
        .set({ status: 'pending', invitedByUserId: byUserId, decidedAt: null, decidedByUserId: null })
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

/**
 * The invited clan answers. Only an admin+ (clan_staff) of the INVITED clan may — the same bar as
 * accepting an event co-host invite. Accepting enrols that clan's roster straight away.
 */
export async function respondToCompetitionInvite(
  inviteId: number,
  byUserId: number,
  action: 'accept' | 'decline',
): Promise<{ ok: true; competitionId: number } | { ok: false; error: string }> {
  const row = await db.query.weeklyCompetitionClans.findFirst({ where: eq(weeklyCompetitionClans.id, inviteId) });
  if (!row) return { ok: false, error: 'Invite not found' };
  const staff = await db
    .select({ role: clanStaff.role })
    .from(clanStaff)
    .where(and(eq(clanStaff.clanId, row.clanId), eq(clanStaff.userId, byUserId)))
    .then((r) => r[0]);
  if (!staff || !atLeast(staff.role, 'admin')) return { ok: false, error: 'Only an owner or admin of the invited clan can answer' };
  // clan-scope: this clan -- the invite row names the clan; the competition is read for its status only.
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, row.competitionId) });
  if (!comp || comp.status === 'completed') return { ok: false, error: 'This competition has ended' };

  if (action === 'decline') {
    if (row.status === 'accepted') return { ok: false, error: 'Already accepted — ask the host to remove your clan' };
    await db
      .update(weeklyCompetitionClans)
      .set({ status: 'declined', decidedByUserId: byUserId, decidedAt: new Date().toISOString() })
      .where(eq(weeklyCompetitionClans.id, inviteId));
    return { ok: true, competitionId: row.competitionId };
  }
  if (row.status === 'declined') return { ok: false, error: 'This invite was declined' };
  if (row.status !== 'accepted') {
    await db
      .update(weeklyCompetitionClans)
      .set({ status: 'accepted', decidedByUserId: byUserId, decidedAt: new Date().toISOString() })
      .where(eq(weeklyCompetitionClans.id, inviteId));
  }
  await enrollPartnerClans(row.competitionId);
  return { ok: true, competitionId: row.competitionId };
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
}

/** Invites addressed to `clanId` that are pending, plus accepted ones still running (for the admin list). */
export async function competitionInvitesForClan(clanId: number): Promise<CompetitionInviteRow[]> {
  const rows = await db
    .select({
      id: weeklyCompetitionClans.id,
      status: weeklyCompetitionClans.status,
      competitionId: weeklyCompetitions.id,
      title: weeklyCompetitions.title,
      type: weeklyCompetitions.type,
      metric: weeklyCompetitions.metric,
      startDate: weeklyCompetitions.startDate,
      endDate: weeklyCompetitions.endDate,
      compStatus: weeklyCompetitions.status,
      hostName: clans.name,
      hostSlug: clans.slug,
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
  return rows
    .filter((r) => r.compStatus !== 'completed')
    .map(({ compStatus, ...r }) => (void compStatus, r));
}

/**
 * Enrol every accepted partner clan's roster into a clans-mode competition, tagged with its clan.
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
    .where(and(eq(weeklyCompetitionClans.competitionId, competitionId), eq(weeklyCompetitionClans.status, 'accepted')));
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
          comp.includeGuests === 1 ? undefined : eq(clanRoster.kind, 'member'),
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

export interface GroupStandingsView {
  mode: CompetitionMode;
  groups: (GroupStanding & { isYours: boolean; slug?: string })[];
  /** Teams mode: counting players on no team (score individually, for no team). */
  unassigned: GroupEntry[];
  /** Key of the viewer's team/clan, when known. */
  yourGroupKey: number | null;
}

/**
 * Team or clan standings for a competition. `viewer` identifies "your" group — by roster seat ids
 * (site) or by RSN (plugin). Null for solo competitions.
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

  // Same dedupe as every other board: one row per player, the one with the most progress.
  const byRsn = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = weeklyRsnKey(r.rsn);
    const prev = byRsn.get(key);
    if (!prev || (r.currentValue ?? 0) > (prev.currentValue ?? 0)) byRsn.set(key, r);
  }
  const people = [...byRsn.values()];

  let defs: (GroupDef & { slug?: string })[];
  const groupOf = (r: (typeof people)[number]): number | null =>
    mode === 'teams' ? r.teamId : (r.clanId ?? comp.clanId);
  if (mode === 'teams') {
    defs = (await listTeams(comp.id)).map((t) => ({ key: t.id, name: t.name, colour: t.colour }));
  } else {
    defs = (await racingClans(comp)).map((c, i) => ({ key: c.id, name: c.name, slug: c.slug, colour: teamColour(null, i) }));
  }
  const keys = new Set(defs.map((d) => d.key));
  const members = people.map((r) => ({
    rsn: r.rsn,
    gained: (r.currentValue ?? 0) - (r.baselineValue ?? 0),
    gainAt: r.gainAt,
    groupKey: groupOf(r),
  }));
  const ranked = rankGroups(defs, members);

  const wantedRsn = viewer?.rsn ? weeklyRsnKey(viewer.rsn) : '';
  const memberIds = new Set(viewer?.memberIds ?? []);
  const me = people.find(
    (r) => (r.clanMemberId != null && memberIds.has(r.clanMemberId)) || (wantedRsn && weeklyRsnKey(r.rsn) === wantedRsn),
  );
  const yourGroupKey = me ? groupOf(me) : null;

  const unassigned = members
    .filter((m) => m.groupKey == null || !keys.has(m.groupKey))
    .map((m) => ({ rsn: m.rsn, gained: Math.max(0, m.gained) }))
    .sort((a, b) => b.gained - a.gained || a.rsn.localeCompare(b.rsn))
    .map((e, i) => ({ rank: i + 1, ...e }));

  const slugByKey = new Map(defs.map((d) => [d.key, d.slug]));
  return {
    mode,
    groups: ranked.map((g) => ({ ...g, isYours: g.key === yourGroupKey, slug: slugByKey.get(g.key) })),
    unassigned: mode === 'teams' ? unassigned : [],
    yourGroupKey: yourGroupKey != null && keys.has(yourGroupKey) ? yourGroupKey : null,
  };
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
