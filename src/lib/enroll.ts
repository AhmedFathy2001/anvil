import crypto from 'crypto';
import { accountCap } from '@/lib/accountCap';
import { captureStartingStatsSoon } from '@/lib/startingStats';
import { loginOf } from '@/lib/roster';
import { db } from '@/db';
import { clanRoster, eventParticipants, events, teams, eventSignups, accounts, signupFees } from '@/db/schema';
import { standardFeeForAccount } from '@/lib/entryFee';
import { and, eq, inArray, isNull, isNotNull, or } from 'drizzle-orm';
import { generatePlayerToken } from '@/lib/auth';
import { accountsOfSeats, accountsOnBoard, onAccountConflict, type Participant } from '@/lib/participants';
import { withHostEventRoom } from '@/lib/friendEvents';

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
      .onConflictDoNothing(onAccountConflict)
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
  // Placed on a team of a running event → take their starting stats now (no-op before the start).
  if (assignTeamId != null) captureStartingStatsSoon(eventId, results.map((r) => r.id));
  return results;
}

// Keep sign-ups and the pool consistent: adding someone as a player records an approved sign-up.
// Linked members attach to their users row; an unlinked in-game member gets a GUEST sign-up
// (userId null). An existing sign-up (any status) is left untouched so an admin's manual status
// decisions aren't silently overridden.
//
// Every new sign-up here puts somebody on the board, so the whole batch is one write under the
// event's room (lib/creatorPlansDb withEventRoom): on a player-capped event, more players at once
// than the plan allows across the host's overlapping events rolls the batch back with a
// PlanLimitError. Call it BEFORE seating anybody (upsertPlayers), so a refusal leaves nothing half-done.
export async function backfillApprovedSignups(eventId: number, clanMemberIds: number[]): Promise<void> {
  if (clanMemberIds.length === 0) return;
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
  const members = await db.select().from(clanRoster).where(inArray(clanRoster.id, clanMemberIds));
  // Resolved outside the transaction: logins are read-only lookups.
  const logins = new Map<number, number | null>();
  for (const m of members) logins.set(m.id, m.claimedAt ? await loginOf(m.playerId) : null);
  // Added counts as signed up, fee included: a board that charges one owes it the same as a form
  // sign-up (signUpOnBehalf), so the fee ledger, the prize pool and the coffer's withheld prize see it.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { id: true, clanId: true, signupFee: true, guestSignupFee: true } });
  const fees = new Map<number, number | null>();
  if (event && (event.signupFee || event.guestSignupFee)) for (const m of members) fees.set(m.id, await standardFeeForAccount(event, m.accountId));
  // A friends host's Supporter tier or a creator plan — one host, one gate (lib/friendEvents).
  await withHostEventRoom({ eventId, audience: 'host' }, async (tx) => {
    for (const m of members) {
      // Dedup: claimed → by (event, login); unclaimed → by (event, seat).
      //
      // eventSignups.userId names a LOGIN and a seat names a PERSON, so the person has to be resolved
      // to their login rather than passed straight in — the two are different id sequences.
      const login = logins.get(m.id) ?? null;
      const [existing] = await tx
        .select({ id: eventSignups.id })
        .from(eventSignups)
        .where(
          login != null
            ? and(eq(eventSignups.eventId, eventId), eq(eventSignups.userId, login))
            : and(eq(eventSignups.eventId, eventId), eq(eventSignups.clanMemberId, m.id)),
        )
        .limit(1);
      if (existing) continue;
      const [made] = await tx
        .insert(eventSignups)
        // `login`, not the person id. The comment above says exactly this and the dedup check three
        // lines up already uses it — the insert did not, so it wrote a PERSON id into a column that is
        // a foreign key to users.id. It does not fail: some unrelated login usually holds that number,
        // and the sign-up then belongs to them.
        .values({ eventId, userId: login, clanMemberId: m.id, status: 'approved', profileData: '{}' })
        // A unique (event, seat) race: the row that won is the one we wanted. Not a .catch — a failed
        // statement would abort the whole transaction.
        .onConflictDoNothing()
        .returning({ id: eventSignups.id });
      const fee = fees.get(m.id);
      if (made && fee) await tx.insert(signupFees).values({ signupId: made.id, amount: fee, status: 'pending' });
    }
  });
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
  // The HOST clan's seats only. This once read every clan's plugin users, so one clan's auto-enroll
  // put the whole platform on its board. Co-host clans bring their people through their own team.
  const [event] = await db.select({ clanId: events.clanId }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return [];
  const rows = await db
    .select({
      id: clanRoster.id,
      rsn: clanRoster.rsn,
      enrolledPlayerId: eventParticipants.id,
      enrolledTeamId: eventParticipants.teamId,
    })
    .from(clanRoster)
    .leftJoin(eventParticipants, and(eq(eventParticipants.clanMemberId, clanRoster.id), eq(eventParticipants.eventId, eventId)))
    .where(and(eq(clanRoster.clanId, event.clanId), eligibleWhere()))
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
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
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
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
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
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
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

/**
 * The board's "max accounts per person" (events.max_accounts_per_person, set when it was created),
 * which Add them all used to skip: every plugin character went in, so a person's alts piled onto
 * their team on a one-per-person board. Keeps what is already enrolled, then adds each person's main
 * first and further characters only while they are under the cap. Unlinked seats are their own person.
 */
export async function withinAccountCap(eventId: number, eligible: EligibleMember[]): Promise<EligibleMember[]> {
  // clan-scope: this clan -- one event by id; the caller already resolved it within the clan.
  const [ev] = await db.select({ max: events.maxAccountsPerPerson }).from(events).where(eq(events.id, eventId)).limit(1);
  const max = accountCap(ev?.max);
  const meta = await loadMemberMeta(eligible.map((m) => m.id));
  // Everyone a person already has on the board counts, plugin or not.
  const owners = [...new Set([...meta.values()].map((m) => m.userId).filter((u): u is number => u != null))];
  const taken = new Map<number, number>();
  if (owners.length) {
    // clan-scope: global -- keyed by SEATS of this event's eligible members; a seat belongs to one clan.
    const rows = await db
      .select({ owner: clanRoster.playerId })
      .from(eventParticipants)
      .innerJoin(clanRoster, eq(eventParticipants.clanMemberId, clanRoster.id))
      .where(and(eq(eventParticipants.eventId, eventId), inArray(clanRoster.playerId, owners)));
    for (const r of rows) if (r.owner != null) taken.set(r.owner, (taken.get(r.owner) ?? 0) + 1);
  }
  const mainsFirst = [...eligible].sort((a, b) => Number(!!meta.get(b.id)?.isPrimary) - Number(!!meta.get(a.id)?.isPrimary));
  return mainsFirst.filter((m) => {
    if (m.enrolledPlayerId != null) return true;
    const owner = meta.get(m.id)?.userId;
    if (owner == null) return true;
    const n = taken.get(owner) ?? 0;
    if (n >= max) return false;
    taken.set(owner, n + 1);
    return true;
  });
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
  const eligible = await withinAccountCap(eventId, await listEligiblePluginMembers(eventId));
  const newlyEnrolled = eligible.filter((m) => m.enrolledPlayerId == null).length;
  let teamsCreated = 0;

  // Sign-ups first: on a player-capped event this is the write the plan can refuse (a PlanLimitError,
  // lib/creatorPlansDb withEventRoom), and nobody should be seated or teamed by a run that is refused.
  await backfillApprovedSignups(eventId, eligible.map((m) => m.id));

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
    captureStartingStatsSoon(eventId, pool.map((p) => p.id));
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
  captureStartingStatsSoon(eventId, pool.map((p) => p.id));
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

/**
 * The cron's half of "Keep adding new plugin members" (events.auto_enroll): every board with it on that
 * hasn't started re-runs Add them all with the saved placement, so a member who installs the plugin or
 * links their character joins on the next tick. Members only (eligibleWhere), never guests; each one
 * gets the same approved sign-up and fee row as a hand-added player. Stops at the start: once a board
 * is running, late joiners are the host's call.
 */
export async function autoEnrollTick(now = new Date()): Promise<number> {
  // clan-scope: global -- the cron walks every board that switched it on; each run is keyed by its own event id.
  const rows = await db
    .select({ id: events.id, autoEnroll: events.autoEnroll, startDate: events.startDate, draftStatus: events.draftStatus, slot: events.accountSlotMode })
    .from(events)
    .where(isNotNull(events.autoEnroll));
  let added = 0;
  for (const e of rows) {
    const placement = e.autoEnroll as EnrollPlacement;
    if (!['draft_pool', 'one_team', 'individual'].includes(placement)) continue;
    const starts = e.startDate ? Date.parse(e.startDate.includes('T') ? e.startDate : `${e.startDate.replace(' ', 'T')}Z`) : NaN;
    if (Number.isFinite(starts) && starts <= now.getTime()) continue;
    if (e.draftStatus === 'active' || e.draftStatus === 'paused') continue;
    if (placement !== 'draft_pool' && e.draftStatus !== 'none') continue;
    const eligible = await withinAccountCap(e.id, await listEligiblePluginMembers(e.id));
    if (!eligible.some((m) => m.enrolledPlayerId == null)) continue;
    try {
      added += (await autoEnrollActivePluginMembers(e.id, placement, e.slot === 'per-account' ? 'per-account' : 'per-person')).added;
    } catch {
      // A full creator plan or a race with an admin's edit: try again next tick.
    }
  }
  return added;
}
