import crypto from 'crypto';
import { db } from '@/db';
import { clanMembers, players, teams, eventSignups } from '@/db/schema';
import { and, eq, inArray, isNull, isNotNull, or } from 'drizzle-orm';
import { generatePlayerToken } from '@/lib/auth';

export interface MemberInput {
  clanMemberId: number;
  name: string;
  discord: string | null;
  timezone: string | null;
}

// Create a player row for each member that doesn't have one yet. A member who ALREADY has a row
// that's unassigned (sitting in the draft pool) is ASSIGNED to the team when a team is given,
// instead of getting a duplicate row — this is what lets an admin put an already-enrolled/guest
// pool player onto a team after the draft. Members already on a team are left as-is.
export async function upsertPlayers(
  eventId: number,
  members: MemberInput[],
  assignTeamId: number | null,
): Promise<(typeof players.$inferSelect)[]> {
  const memberIds = members.map((m) => m.clanMemberId);
  const existing = memberIds.length
    ? await db.select().from(players).where(and(eq(players.eventId, eventId), inArray(players.clanMemberId, memberIds)))
    : [];
  const byMember = new Map<number, typeof players.$inferSelect>();
  for (const p of existing) if (p.clanMemberId != null) byMember.set(p.clanMemberId, p);

  const pickedAt = assignTeamId != null ? new Date().toISOString() : null;
  const results: (typeof players.$inferSelect)[] = [];
  const toInsert: (typeof players.$inferInsert)[] = [];

  for (const m of members) {
    const row = byMember.get(m.clanMemberId);
    if (row) {
      if (assignTeamId != null && row.teamId == null) {
        const [updated] = await db
          .update(players)
          .set({ teamId: assignTeamId, pickedAt })
          .where(eq(players.id, row.id))
          .returning();
        results.push(updated);
      } else {
        results.push(row); // already in the pool, or already on a team — no duplicate
      }
    } else {
      toInsert.push({
        eventId,
        clanMemberId: m.clanMemberId,
        name: m.name,
        discord: m.discord,
        timezone: m.timezone,
        playerToken: generatePlayerToken(),
        teamId: assignTeamId,
        pickedAt,
      });
    }
  }
  if (toInsert.length > 0) {
    results.push(...(await db.insert(players).values(toInsert).returning()));
  }
  return results;
}

// Keep sign-ups and the pool consistent: adding someone as a player records an approved sign-up.
// Linked members attach to their users row; an unlinked in-game member gets a GUEST sign-up
// (userId null). An existing sign-up (any status) is left untouched so an admin's manual status
// decisions aren't silently overridden.
export async function backfillApprovedSignups(eventId: number, clanMemberIds: number[]): Promise<void> {
  if (clanMemberIds.length === 0) return;
  const members = await db.select().from(clanMembers).where(inArray(clanMembers.id, clanMemberIds));
  for (const m of members) {
    // Dedup: linked → by (event, user); guest → by (event, clan member).
    const existing = await db.query.eventSignups.findFirst({
      where:
        m.userId != null
          ? and(eq(eventSignups.eventId, eventId), eq(eventSignups.userId, m.userId))
          : and(eq(eventSignups.eventId, eventId), eq(eventSignups.clanMemberId, m.id)),
    });
    if (existing) continue;
    await db
      .insert(eventSignups)
      .values({ eventId, userId: m.userId ?? null, clanMemberId: m.id, status: 'approved', profileData: '{}' })
      .catch(() => {}); // unique (event,user) race — ignore
  }
}

// ─── Auto-enroll: pull every plugin-active clan member into an event ──────────────────────────

export type EnrollPlacement = 'one_team' | 'draft_pool' | 'individual';

// A member counts as "plugin active" when they've connected/verified an account through the plugin:
// an account hash (captured during the plugin handshake) or a plugin verification. Non-guest, still
// in the clan, and cron-active. This is exactly who can complete plugin-tracked tiles.
function eligibleWhere() {
  return and(
    isNull(clanMembers.leftAt),
    eq(clanMembers.status, 'active'),
    eq(clanMembers.isGuest, 0),
    or(isNotNull(clanMembers.accountHash), eq(clanMembers.verificationMethod, 'plugin')),
  );
}

export interface EligibleMember {
  id: number;
  rsn: string;
  enrolledPlayerId: number | null;
  enrolledTeamId: number | null;
}

// The plugin-active roster for an event, flagged with whether each member already has a player row
// (and whether it's on a team). Powers the auto-enroll panel's preview count.
export async function listEligiblePluginMembers(eventId: number): Promise<EligibleMember[]> {
  const rows = await db
    .select({
      id: clanMembers.id,
      rsn: clanMembers.rsn,
      enrolledPlayerId: players.id,
      enrolledTeamId: players.teamId,
    })
    .from(clanMembers)
    .leftJoin(players, and(eq(players.clanMemberId, clanMembers.id), eq(players.eventId, eventId)))
    .where(eligibleWhere())
    .orderBy(clanMembers.rsn);
  return rows;
}

// Deterministic, well-spread team color for the Nth auto-created team (individual mode can mint many).
// Golden-angle hue rotation guarantees adjacent teams look distinct even past the fixed palette.
export function teamColorForIndex(i: number): string {
  const hue = (i * 137.508) % 360;
  const s = 0.62;
  const l = 0.52;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
    : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c]
    : hue < 300 ? [x, 0, c]
    : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export interface AutoEnrollResult {
  placement: EnrollPlacement;
  eligible: number;   // total plugin-active members considered
  added: number;      // members who gained a NEW player row this run
  teamsCreated: number;
}

// Enroll every plugin-active clan member into the event, idempotently. `one_team` puts everyone on a
// single shared team; `individual` gives each member their own team; `draft_pool` leaves them
// unassigned for a later draft. Re-running only fills gaps (existing players/teams are reused).
export async function autoEnrollActivePluginMembers(
  eventId: number,
  placement: EnrollPlacement,
): Promise<AutoEnrollResult> {
  const eligible = await listEligiblePluginMembers(eventId);
  const newlyEnrolled = eligible.filter((m) => m.enrolledPlayerId == null).length;
  let teamsCreated = 0;

  const toMember = (m: EligibleMember): MemberInput => ({
    clanMemberId: m.id,
    name: m.rsn,
    discord: null,
    timezone: null,
  });

  if (placement === 'draft_pool') {
    await upsertPlayers(eventId, eligible.map(toMember), null);
  } else if (placement === 'one_team') {
    const teamId = await findOrCreateTeam(eventId, 'Clan', teamColorForIndex(0), (created) => {
      if (created) teamsCreated++;
    });
    await upsertPlayers(eventId, eligible.map(toMember), teamId);
  } else {
    // individual — one team per member, skipping anyone already placed on a team.
    const existingTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));
    const teamByName = new Map(existingTeams.map((t) => [t.name.trim().toLowerCase(), t.id]));
    let colorIdx = existingTeams.length;
    for (const m of eligible) {
      if (m.enrolledTeamId != null) continue; // already on a team — leave them there
      const key = m.rsn.trim().toLowerCase();
      let teamId = teamByName.get(key);
      if (teamId == null) {
        teamId = await insertTeam(eventId, m.rsn, teamColorForIndex(colorIdx++));
        teamByName.set(key, teamId);
        teamsCreated++;
      }
      await upsertPlayers(eventId, [toMember(m)], teamId);
    }
  }

  await backfillApprovedSignups(eventId, eligible.map((m) => m.id));

  return { placement, eligible: eligible.length, added: newlyEnrolled, teamsCreated };
}

// Give every player already in the event's pool (teamId null) a team, per the chosen non-draft
// format: 'individual' = a solo team named after each player, 'one_team' = everyone onto one shared
// "Clan" team. Complements autoEnrollActivePluginMembers (which only covers plugin-active clan
// members) by teaming up sign-up-form players and manually-added guests too — this is what lets the
// format-first Teams flow skip manual team creation entirely. Idempotent: players already on a team
// are untouched, same-named teams are reused.
export async function placeUnassignedPlayers(
  eventId: number,
  placement: 'one_team' | 'individual',
): Promise<{ placed: number; teamsCreated: number }> {
  const pool = await db
    .select()
    .from(players)
    .where(and(eq(players.eventId, eventId), isNull(players.teamId)));
  if (pool.length === 0) return { placed: 0, teamsCreated: 0 };

  let teamsCreated = 0;
  const pickedAt = new Date().toISOString();

  if (placement === 'one_team') {
    const teamId = await findOrCreateTeam(eventId, 'Clan', teamColorForIndex(0), (created) => {
      if (created) teamsCreated++;
    });
    await db
      .update(players)
      .set({ teamId, pickedAt })
      .where(and(eq(players.eventId, eventId), isNull(players.teamId)));
    return { placed: pool.length, teamsCreated };
  }

  // individual — one solo team per pool player, reusing an existing team with their name (re-runs
  // and mixed auto-enroll/pool flows must not spawn "Nisbro (2)" duplicates).
  const existingTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));
  const teamByName = new Map(existingTeams.map((t) => [t.name.trim().toLowerCase(), t.id]));
  let colorIdx = existingTeams.length;
  for (const p of pool) {
    const key = p.name.trim().toLowerCase();
    let teamId = teamByName.get(key);
    if (teamId == null) {
      teamId = await insertTeam(eventId, p.name, teamColorForIndex(colorIdx++));
      teamByName.set(key, teamId);
      teamsCreated++;
    }
    await db.update(players).set({ teamId, pickedAt }).where(eq(players.id, p.id));
  }
  return { placed: pool.length, teamsCreated };
}

// captain_password is a legacy NOT NULL column on older live DBs (retired in schema, dropped by
// migration but may linger). Auto-created utility teams have no captain, so stuff a random inert
// value to satisfy any lingering constraint — nothing reads it.
function placeholderCaptainPassword(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function insertTeam(eventId: number, name: string, color: string): Promise<number> {
  const [team] = await db
    .insert(teams)
    .values({ eventId, name, color, captainPassword: placeholderCaptainPassword(), captainUserId: null })
    .returning({ id: teams.id });
  return team.id;
}

async function findOrCreateTeam(
  eventId: number,
  name: string,
  color: string,
  onResolve: (created: boolean) => void,
): Promise<number> {
  // Reuse an existing same-named team so re-running one_team doesn't spawn duplicate "Clan" teams.
  const named = await db.select().from(teams).where(eq(teams.eventId, eventId));
  const match = named.find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (match) {
    onResolve(false);
    return match.id;
  }
  const id = await insertTeam(eventId, name, color);
  onResolve(true);
  return id;
}
