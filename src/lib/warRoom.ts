import { db } from '@/db';
import { draftShortlists, eventSignups, eventParticipants, teams, events } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { buildDraftBalance, tierOf, type Tier } from '@/lib/draftBalance';
import { parseProfile, type SignupProfile } from '@/lib/signup';
import type { PlayerProfile } from '@/lib/playerProfile';

/**
 * The captain's view of the draft pool: everyone they could take, everything known about them, and
 * their own shortlist over the top.
 *
 * One assembly rather than three fetches, because the war room and the pick clock ask the same
 * question ("who's left and who do I want") and any disagreement between those two screens is a
 * bug a captain finds at the worst possible moment.
 *
 * Captain-safe by construction: it carries ratings and sign-up answers, which staff surfaces
 * already show, and nothing fee-related, which is admin-only (see api/team/[teamId]/applicants).
 */

export interface WarRoomPerson {
  /** Stable per-person id (lib/playerProfile) — alts of one person are a single row. */
  personKey: string;
  /** Every `players` row this person holds in the event; picking takes the lead one. */
  playerIds: number[];
  leadPlayerId: number;
  rsn: string;
  /** Null while undrafted; set once someone has taken them. */
  teamId: number | null;
  teamName: string | null;
  teamColor: string | null;
  /** Which pick took them, when that's known. */
  pickNumber: number | null;

  rating: number;
  tier: Tier | null;
  band: PlayerProfile['band'];
  domains: string[];
  markers: { key: string; label: string; domain: string; kc: number }[];
  evidenceEvents: number;
  /** 0..1 attendance from prior events; null when they have no history. */
  reliability: number | null;
  subbedOutBefore: boolean;
  activityKc: number | null;
  activityXp: number | null;

  /** Frozen sign-up answers. Null when they were added to the pool without signing up. */
  answers: SignupProfile | null;

  /** This captain's own list: 0-based rank, or null when not on it. */
  shortlistAt: number | null;
  shortlistNote: string | null;
}

export interface WarRoom {
  eventId: number;
  eventName: string;
  /** Everyone in the pool AND everyone already taken — the taken rows render struck through. */
  people: WarRoomPerson[];
  /** The viewer's own team. */
  team: { id: number; name: string; color: string } | null;
  /** Their roster so far, as person rows (same shape, already filtered to their team). */
  roster: WarRoomPerson[];
  draftStatus: string;
  /** Set only when the pool has never been rated (no snapshots yet) so the UI can say why. */
  unrated: boolean;
}

/** Every domain the roster has at least one marker in — the coverage view. */
export function coverageOf(people: WarRoomPerson[]): Set<string> {
  const out = new Set<string>();
  for (const p of people) for (const d of p.domains) out.add(d);
  return out;
}

export async function buildWarRoom(params: {
  clanId: number;
  eventId: number;
  teamId: number;
  /** The captain, for their own shortlist. */
  userId: number;
}): Promise<WarRoom | null> {
  const { clanId, eventId, teamId, userId } = params;

  const [eventTeams, eventPlayers, balance] = await Promise.all([
    db.select().from(teams).where(eq(teams.eventId, eventId)),
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId)),
    buildDraftBalance(clanId, eventId),
  ]);

  const event = await db.query.events.findFirst({
    where: (e, { eq: eqp }) => eqp(e.id, eventId),
    columns: { id: true, name: true, draftStatus: true },
  });
  if (!event) return null;

  const teamById = new Map(eventTeams.map((t) => [t.id, t]));
  const myTeam = teamById.get(teamId) ?? null;

  // Sign-up answers, keyed by the clan_member they signed up as. A pool row added by an admin has
  // no sign-up, which is a real and common case (guests, late adds) — those simply have no answers.
  const signups = await db
    .select({
      clanMemberId: eventSignups.clanMemberId,
      userId: eventSignups.userId,
      profileData: eventSignups.profileData,
    })
    .from(eventSignups)
    .where(eq(eventSignups.eventId, eventId));
  const answersByMember = new Map<number, SignupProfile>();
  for (const s of signups) answersByMember.set(s.clanMemberId, parseProfile(s.profileData));

  // The captain's own list. Keyed on personKey so an alt row can't split it.
  const shortlist = await db
    .select()
    .from(draftShortlists)
    .where(and(eq(draftShortlists.eventId, eventId), eq(draftShortlists.userId, userId)))
    .orderBy(draftShortlists.position);
  const shortlistByPerson = new Map(shortlist.map((s, i) => [s.personKey, { at: i, note: s.note }]));

  const playerById = new Map(eventPlayers.map((p) => [p.id, p]));

  const people: WarRoomPerson[] = balance.profiles
    .filter((p) => p.playerIds.length > 0)
    .map((profile) => {
      // The lead row is the one that gets picked; for a multi-account person any of their rows
      // resolves to the same profile, so the first is as good as any and is stable across renders.
      const leadPlayerId = profile.playerIds[0];
      const lead = playerById.get(leadPlayerId);
      const team = profile.teamId != null ? teamById.get(profile.teamId) ?? null : null;
      const mine = shortlistByPerson.get(profile.personKey);
      const memberId = lead?.clanMemberId ?? null;
      return {
        personKey: profile.personKey,
        playerIds: profile.playerIds,
        leadPlayerId,
        rsn: profile.rsn,
        teamId: profile.teamId,
        teamName: team?.name ?? null,
        teamColor: team?.color ?? null,
        pickNumber: lead?.pickNumber ?? null,
        rating: profile.rating,
        tier: tierOf(balance, leadPlayerId),
        band: profile.band,
        domains: profile.domains,
        markers: profile.capabilityMarkers,
        evidenceEvents: profile.evidenceEvents,
        reliability: profile.reliability,
        subbedOutBefore: profile.subbedOutBefore,
        activityKc: profile.activityKc,
        activityXp: profile.activityXp,
        answers: memberId != null ? answersByMember.get(memberId) ?? null : null,
        shortlistAt: mine?.at ?? null,
        shortlistNote: mine?.note ?? null,
      };
    });

  // Best-rated first — the order a captain reads a pool in. The client re-sorts for its own views
  // (shortlist first on the clock), but the default has to be an opinion, not insertion order.
  people.sort((a, b) => b.rating - a.rating || a.rsn.localeCompare(b.rsn));

  return {
    eventId,
    eventName: event.name,
    people,
    team: myTeam ? { id: myTeam.id, name: myTeam.name, color: myTeam.color } : null,
    roster: people.filter((p) => p.teamId === teamId),
    draftStatus: event.draftStatus,
    // Ratings are pool-relative: with no snapshots at all every rating lands identical, and the
    // tiers become noise. Say so rather than showing a confident-looking S next to a C.
    unrated: people.length > 0 && people.every((p) => p.rating === people[0].rating),
  };
}
