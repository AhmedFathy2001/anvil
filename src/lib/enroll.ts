import crypto from 'crypto';
import { loginOf } from '@/lib/roster';
import { db } from '@/db';
import { clanRoster, eventParticipants, teams, eventSignups, accounts } from '@/db/schema';
import { and, eq, inArray, isNull, isNotNull, or } from 'drizzle-orm';
import { generatePlayerToken } from '@/lib/auth';
import { accountsOfSeats, accountsOnBoard, type Participant } from '@/lib/participants';

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
): Promise<(typeof eventParticipants.$inferSelect)[]> {
  // Who each seat actually IS. The board is keyed by account, not by seat — see lib/participants for
  // why the two stopped being the same thing — so a member arriving on their own clan's seat finds
  // the row they already have as a guest of the host clan, instead of getting a second one.
  const seatToAccount = await accountsOfSeats(members.map((m) => m.clanMemberId));
  const onBoard = await accountsOnBoard(eventId);

  // Seat lookup is kept alongside it, for rows whose account could not be resolved — a seat deleted
  // after its participant was made would otherwise read as a brand-new player.
  const memberIds = members.map((m) => m.clanMemberId);
  const bySeat = new Map<number, Participant>();
  if (memberIds.length) {
    const existing = await db
      .select()
      .from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, eventId), inArray(eventParticipants.clanMemberId, memberIds)));
    for (const p of existing) if (p.clanMemberId != null) bySeat.set(p.clanMemberId, p);
  }

  const pickedAt = assignTeamId != null ? new Date().toISOString() : null;
  const results: (typeof eventParticipants.$inferSelect)[] = [];
  const toInsert: (typeof eventParticipants.$inferInsert)[] = [];
  // Two seats for one account inside a single call is the same person named twice; the first wins.
  const claimed = new Set<number>();

  for (const m of members) {
    const accountId = seatToAccount.get(m.clanMemberId) ?? null;
    const row = (accountId != null ? onBoard.get(accountId) : undefined) ?? bySeat.get(m.clanMemberId);
    if (row) {
      if (assignTeamId != null && row.teamId == null) {
        const [updated] = await db
          .update(eventParticipants)
          .set({ teamId: assignTeamId, pickedAt })
          .where(eq(eventParticipants.id, row.id))
          .returning();
        results.push(updated);
      } else {
        results.push(row); // already in the pool, or already on a team — no duplicate
      }
    } else {
      if (accountId != null) {
        if (claimed.has(accountId)) continue;
        claimed.add(accountId);
      }
      toInsert.push({
        eventId,
        clanMemberId: m.clanMemberId,
        accountId,
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
    // The index has the final say. It can only refuse a row that arrived between the read above and
    // this write, and the row it kept is the one the caller wanted either way, so collect those
    // rather than failing the whole enrolment for a race.
    const inserted = await db
      .insert(eventParticipants)
      .values(toInsert)
      .onConflictDoNothing({ target: [eventParticipants.eventId, eventParticipants.accountId] })
      .returning();
    results.push(...inserted);

    if (inserted.length < toInsert.length) {
      const landed = new Set(inserted.map((r) => r.accountId).filter((a): a is number => a != null));
      const missed = toInsert
        .map((r) => r.accountId)
        .filter((a): a is number => a != null && !landed.has(a));
      if (missed.length > 0) {
        results.push(
          ...(await db
            .select()
            .from(eventParticipants)
            .where(and(eq(eventParticipants.eventId, eventId), inArray(eventParticipants.accountId, missed)))),
        );
      }
    }
  }
  return results;
}

// Keep sign-ups and the pool consistent: adding someone as a player records an approved sign-up.
// Linked members attach to their users row; an unlinked in-game member gets a GUEST sign-up
// (userId null). An existing sign-up (any status) is left untouched so an admin's manual status
// decisions aren't silently overridden.
export async function backfillApprovedSignups(eventId: number, clanMemberIds: number[]): Promise<void> {
  if (clanMemberIds.length === 0) return;
  const members = await db.select().from(clanRoster).where(inArray(clanRoster.id, clanMemberIds));
  for (const m of members) {
    // Dedup: claimed → by (event, login); unclaimed → by (event, seat).
    //
    // eventSignups.userId names a LOGIN and a seat names a PERSON, so the person has to be resolved
    // to their login rather than passed straight in — the two are different id sequences.
    const login = m.claimedAt ? await loginOf(m.playerId) : null;
    const existing = await db.query.eventSignups.findFirst({
      where:
        login != null
          ? and(eq(eventSignups.eventId, eventId), eq(eventSignups.userId, login))
          : and(eq(eventSignups.eventId, eventId), eq(eventSignups.clanMemberId, m.id)),
    });
    if (existing) continue;
    await db
      .insert(eventSignups)
      // `login`, not the person id. The comment above says exactly this and the dedup check three
      // lines up already uses it — the insert did not, so it wrote a PERSON id into a column that is
      // a foreign key to users.id. It does not fail: some unrelated login usually holds that number,
      // and the sign-up then belongs to them.
      .values({ eventId, userId: login, clanMemberId: m.id, status: 'approved', profileData: '{}' })
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
    isNull(clanRoster.leftAt),
    eq(clanRoster.status, 'active'),
    eq(clanRoster.kind, 'member'),
    or(isNotNull(clanRoster.accountHash), eq(clanRoster.verificationMethod, 'plugin')),
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
      id: clanRoster.id,
      rsn: clanRoster.rsn,
      enrolledPlayerId: eventParticipants.id,
      enrolledTeamId: eventParticipants.teamId,
    })
    .from(clanRoster)
    .leftJoin(eventParticipants, and(eq(eventParticipants.clanMemberId, clanRoster.id), eq(eventParticipants.eventId, eventId)))
    .where(eligibleWhere())
    .orderBy(clanRoster.rsn);
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

// How the 'individual' (one-team-each) format maps a person's accounts to teams. Mirrors the event's
// accountSlotMode: 'per-person' = one team per PERSON (their alts share it, contributions aggregate
// via rollupByOwner); 'per-account' = each account its own team (alts as separate teams).
export type SlotMode = 'per-person' | 'per-account';

interface PlaceableAccount {
  clanMemberId: number | null;
  rsn: string;
  playerId?: number; // present when the account is already a pool player row (placeUnassignedPlayers)
}

// owner userId + primary flag per clan-member account, for per-person grouping.
async function loadMemberMeta(
  clanMemberIds: (number | null)[],
): Promise<Map<number, { userId: number | null; isPrimary: boolean }>> {
  const ids = [...new Set(clanMemberIds.filter((x): x is number => x != null))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: clanRoster.id, userId: clanRoster.playerId, isPrimary: clanRoster.isPrimary })
    .from(clanRoster)
    .where(inArray(clanRoster.id, ids));
  return new Map(rows.map((r) => [r.id, { userId: r.userId, isPrimary: r.isPrimary === 1 }]));
}

// Reject an admin add that would put more than the event's cap of ONE person's accounts into the
// event. Owned accounts (same clanRoster.playerId) count together; guests / unlinked accounts are each
// their own person and so are never capped here. Returns an error string, or null when within cap.
// Mirrors the self-service signup cap (api/events/[eventId]/signup) for the admin add path.
export async function accountCapError(
  eventId: number,
  maxAccounts: number,
  addingClanMemberIds: number[],
): Promise<string | null> {
  if (addingClanMemberIds.length === 0) return null;
  const meta = await loadMemberMeta(addingClanMemberIds);
  const addingByOwner = new Map<number, Set<number>>();
  for (const cmId of addingClanMemberIds) {
    const userId = meta.get(cmId)?.userId;
    if (userId == null) continue; // guests aren't grouped into a person
    (addingByOwner.get(userId) ?? addingByOwner.set(userId, new Set()).get(userId)!).add(cmId);
  }
  if (addingByOwner.size === 0) return null;

  const ownerIds = [...addingByOwner.keys()];
  const existingRows = await db
    .select({ clanMemberId: eventParticipants.clanMemberId, userId: clanRoster.playerId })
    .from(eventParticipants)
    .innerJoin(clanRoster, eq(eventParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(eventParticipants.eventId, eventId), inArray(clanRoster.playerId, ownerIds)));
  const existingByOwner = new Map<number, Set<number>>();
  for (const r of existingRows) {
    if (r.userId == null || r.clanMemberId == null) continue;
    (existingByOwner.get(r.userId) ?? existingByOwner.set(r.userId, new Set()).get(r.userId)!).add(r.clanMemberId);
  }
  for (const [userId, adding] of addingByOwner) {
    const union = new Set([...(existingByOwner.get(userId) ?? []), ...adding]);
    if (union.size > maxAccounts) {
      return `This event allows at most ${maxAccounts} account${maxAccounts === 1 ? '' : 's'} per person.`;
    }
  }
  return null;
}

// Stable person key: owned accounts (same clanRoster.playerId) collapse to one person; guests /
// unlinked accounts stand alone (keyed by their clanMemberId, else the player row). Kept consistent
// between grouping and existing-team resolution so a re-run routes an alt to the person's own team.
function personKeyOf(clanMemberId: number | null, userId: number | null | undefined, playerId?: number): string {
  if (userId != null) return `u${userId}`;
  if (clanMemberId != null) return `s${clanMemberId}`;
  return `p${playerId ?? 'x'}`;
}

// The team each person already has an account on, for this event (personKey → teamId). Lets the
// per-person placement route a newly-pooled alt onto the person's existing team instead of spawning
// a second team for them on a re-run.
async function existingTeamByPerson(eventId: number): Promise<Map<string, number>> {
  const rows = await db
    .select({ playerId: eventParticipants.id, teamId: eventParticipants.teamId, clanMemberId: eventParticipants.clanMemberId, userId: clanRoster.playerId })
    .from(eventParticipants)
    .leftJoin(clanRoster, eq(eventParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(eventParticipants.eventId, eventId), isNotNull(eventParticipants.teamId)));
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.teamId == null) continue;
    const key = personKeyOf(r.clanMemberId, r.userId, r.playerId);
    if (!map.has(key)) map.set(key, r.teamId); // first team wins (a person shouldn't span teams)
  }
  return map;
}

// Group accounts into one bucket per PERSON. Owned accounts (clanRoster.playerId) share a person key;
// guests / unlinked accounts are each their own person. Each group is named after the person's
// primary account RSN (else the first account seen), and carries its personKey for existing-team reuse.
async function groupAccountsByPerson(
  accounts: PlaceableAccount[],
): Promise<{ personKey: string; teamName: string; accounts: PlaceableAccount[] }[]> {
  const meta = await loadMemberMeta(accounts.map((a) => a.clanMemberId));
  const groups = new Map<string, { personKey: string; teamName: string; accounts: PlaceableAccount[]; hasPrimary: boolean }>();
  accounts.forEach((a) => {
    const m = a.clanMemberId != null ? meta.get(a.clanMemberId) : undefined;
    const key = personKeyOf(a.clanMemberId, m?.userId, a.playerId);
    let g = groups.get(key);
    if (!g) {
      g = { personKey: key, teamName: a.rsn, accounts: [], hasPrimary: false };
      groups.set(key, g);
    }
    g.accounts.push(a);
    // Name the team after the person's primary account when one is in the group.
    if (m?.isPrimary && !g.hasPrimary) {
      g.teamName = a.rsn;
      g.hasPrimary = true;
    }
  });
  return [...groups.values()].map(({ personKey, teamName, accounts }) => ({ personKey, teamName, accounts }));
}

// Enroll every plugin-active clan member into the event, idempotently. `one_team` puts everyone on a
// single shared team; `individual` gives each member their own team (or one team per person when
// slotMode is 'per-person'); `draft_pool` leaves them unassigned for a later draft. Re-running only
// fills gaps (existing players/teams are reused).
export async function autoEnrollActivePluginMembers(
  eventId: number,
  placement: EnrollPlacement,
  slotMode: SlotMode = 'per-person',
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
    // individual — skip anyone already on a team; the rest become teams per the slot mode.
    const toPlace = eligible.filter((m) => m.enrolledTeamId == null);
    const existingTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));
    const teamByName = new Map(existingTeams.map((t) => [t.name.trim().toLowerCase(), t.id]));
    let colorIdx = existingTeams.length;
    const groups =
      slotMode === 'per-person'
        ? await groupAccountsByPerson(toPlace.map((m) => ({ clanMemberId: m.id, rsn: m.rsn })))
        : toPlace.map((m) => ({ personKey: `s${m.id}`, teamName: m.rsn, accounts: [{ clanMemberId: m.id, rsn: m.rsn }] }));
    // Re-run safety: route a person's newly-added account to the team they already sit on.
    const personTeam = slotMode === 'per-person' ? await existingTeamByPerson(eventId) : new Map<string, number>();
    for (const g of groups) {
      const key = g.teamName.trim().toLowerCase();
      let teamId = personTeam.get(g.personKey) ?? teamByName.get(key);
      if (teamId == null) {
        teamId = await insertTeam(eventId, g.teamName, teamColorForIndex(colorIdx++));
        teamByName.set(key, teamId);
        teamsCreated++;
      }
      personTeam.set(g.personKey, teamId);
      await upsertPlayers(
        eventId,
        g.accounts.map((a) => ({ clanMemberId: a.clanMemberId!, name: a.rsn, discord: null, timezone: null })),
        teamId,
      );
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
  slotMode: SlotMode = 'per-person',
): Promise<{ placed: number; teamsCreated: number }> {
  const pool = await db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), isNull(eventParticipants.teamId)));
  if (pool.length === 0) return { placed: 0, teamsCreated: 0 };

  let teamsCreated = 0;
  const pickedAt = new Date().toISOString();

  if (placement === 'one_team') {
    const teamId = await findOrCreateTeam(eventId, 'Clan', teamColorForIndex(0), (created) => {
      if (created) teamsCreated++;
    });
    await db
      .update(eventParticipants)
      .set({ teamId, pickedAt })
      .where(and(eq(eventParticipants.eventId, eventId), isNull(eventParticipants.teamId)));
    return { placed: pool.length, teamsCreated };
  }

  // individual — a team per person ('per-person', alts share it) or per account ('per-account'),
  // named after the person's primary account. Reuse a same-named team so re-runs / mixed
  // auto-enroll+pool flows never spawn "Nisbro (2)" duplicates.
  const existingTeams = await db.select().from(teams).where(eq(teams.eventId, eventId));
  const teamByName = new Map(existingTeams.map((t) => [t.name.trim().toLowerCase(), t.id]));
  let colorIdx = existingTeams.length;
  const groups =
    slotMode === 'per-person'
      ? await groupAccountsByPerson(pool.map((p) => ({ clanMemberId: p.clanMemberId, rsn: p.name, playerId: p.id })))
      : pool.map((p) => ({
          personKey: personKeyOf(p.clanMemberId, null, p.id),
          teamName: p.name,
          accounts: [{ clanMemberId: p.clanMemberId, rsn: p.name, playerId: p.id }],
        }));
  // Re-run safety: a person's newly-pooled alt joins the team they already sit on.
  const personTeam = slotMode === 'per-person' ? await existingTeamByPerson(eventId) : new Map<string, number>();
  for (const g of groups) {
    const key = g.teamName.trim().toLowerCase();
    let teamId = personTeam.get(g.personKey) ?? teamByName.get(key);
    if (teamId == null) {
      teamId = await insertTeam(eventId, g.teamName, teamColorForIndex(colorIdx++));
      teamByName.set(key, teamId);
      teamsCreated++;
    }
    personTeam.set(g.personKey, teamId);
    for (const a of g.accounts) {
      if (a.playerId != null) await db.update(eventParticipants).set({ teamId, pickedAt }).where(eq(eventParticipants.id, a.playerId));
    }
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
