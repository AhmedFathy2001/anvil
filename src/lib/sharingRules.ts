// Account-sharing checks, the pure half: what the network sightings add up to, and what staff are told.
//
// lib/integrityNetwork records the sightings (a per-event code for the network, and a country) on
// boards that opted in; lib/footprintCheck runs these rules over them. No database here, so every
// rule is tested directly (tests/sharing-rules.test.ts).
//
// WHAT IS AND IS NOT A FLAG
//   - One person's own characters on one network: nothing. Somebody with a main and an alt plays both
//     from home, and that is all a shared network says about them.
//   - Characters of DIFFERENT people on one network (or ones whose owner isn't known): shown, with
//     what is actually known about who owns them.
//   - A character put on a team after the event started: shown. Strongly when it then connects from a
//     country its owner's other characters never connect from.
//   - One character from two countries within hours: lib/footprint twoCountries, unchanged.
//   - A character played through another login's plugin: lib/footprintCheck raiseOtherLoginSignals,
//     on every board, off the hash-matched sightings in lib/accountSightings.
//
// "SAME PERSON" IS NEVER READ OFF THE NETWORK. It is the site's own ownership record: both accounts
// claimed by the same person (accounts.playerId), that person having a login. A link the plugin made
// by itself on first play and nobody has confirmed is weaker than that — it says whose RuneLite the
// character was first seen on, which is nearly the same fact as the network — so such a pair is kept
// as a weak line instead of being waved through.
//
// Every result is a reason for staff to look. Nothing here blocks, removes or scores anything.

/** Who an account belongs to, as far as the site's own records go. */
export interface AccountOwner {
  /** accounts.playerId: the PERSON (players.id), never a login. */
  personId: number | null;
  /** Claimed by a person who has a login (accounts.claimedAt set); false for a roster placeholder. */
  claimed: boolean;
  /** The link was proved or confirmed: not a provisional or first-plugin-use link. */
  confirmed: boolean;
}

/**
 * The owner verified the account with a real check. The same reading lib/ownershipClaims uses: a
 * provisional link, or one the plugin made on first play, is usable but not yet anybody's word.
 */
export function ownershipConfirmed(a: {
  verifiedAt: string | null;
  provisional: number | null;
  verificationMethod: string | null;
}): boolean {
  return a.verifiedAt != null && a.provisional !== 1 && a.verificationMethod !== 'plugin_first_use';
}

/**
 *   same             both claimed by one person, both links confirmed
 *   same_unconfirmed both claimed by one person, at least one link not confirmed yet
 *   different        claimed by two different people
 *   unknown          at least one is claimed by nobody
 */
export type OwnerRelation = 'same' | 'same_unconfirmed' | 'different' | 'unknown';

export function ownerRelation(a: AccountOwner | null | undefined, b: AccountOwner | null | undefined): OwnerRelation {
  if (!a || !b || !a.claimed || !b.claimed || a.personId == null || b.personId == null) return 'unknown';
  if (a.personId !== b.personId) return 'different';
  return a.confirmed && b.confirmed ? 'same' : 'same_unconfirmed';
}

const sameOwner = (r: OwnerRelation) => r === 'same' || r === 'same_unconfirmed';

/** One enrolment on the board, with what the checks need to know about it. */
export interface SharingPlayer {
  id: number;
  name: string;
  teamId: number | null;
  /** null when the enrolment has no account behind it. */
  owner: AccountOwner | null;
  /** When they were put on their team (event_participants.pickedAt). */
  pickedMs: number | null;
  /** When their starting line was taken (event_participants.snapshotAt). */
  baselineMs: number | null;
}

/** A network sighting: the per-event code and Cloudflare's country. Never an address. */
export interface NetSighting {
  participantId: number;
  netHash: string;
  country: string | null;
}

/** Placed this long after the start still counts as there from the start (a draft running over). */
export const LATE_ADD_GRACE_MS = 60 * 60_000;
/** A starting line this much older than the placement means they were playing already: a team move. */
const MOVE_SLACK_MS = 5 * 60_000;

/**
 * Hours after the start this player was ADDED to the event, or null when they weren't added late.
 *
 * Added = put on a team after the start. A player moved between teams mid-event is not an addition:
 * their starting line is older than the move, where a new arrival's is taken after they are placed
 * (lib/startingStats). No team, or no placement time, says nothing.
 */
export function lateAddHours(startMs: number, p: Pick<SharingPlayer, 'teamId' | 'pickedMs' | 'baselineMs'>): number | null {
  if (p.teamId == null || p.pickedMs == null) return null;
  if (p.pickedMs - startMs <= LATE_ADD_GRACE_MS) return null;
  if (p.baselineMs != null && p.baselineMs < p.pickedMs - MOVE_SLACK_MS) return null;
  return Math.max(1, Math.round((p.pickedMs - startMs) / 3_600_000));
}

/**
 * Who was added mid-contest, and how many hours in. Empty when most of the field arrived after the
 * start (teams drafted late, or a board that enrols people as they play): there a late arrival is
 * the ordinary case, and flagging every one of them would bury the lines that mean something.
 */
export function lateAdds(startMs: number, players: SharingPlayer[]): Map<number, number> {
  const out = new Map<number, number>();
  const onTeams = players.filter((p) => p.teamId != null);
  for (const p of onTeams) {
    const hours = lateAddHours(startMs, p);
    if (hours != null) out.set(p.id, hours);
  }
  if (out.size * 2 > onTeams.length) out.clear();
  return out;
}

export interface SharingSignal {
  participantId: number;
  kind: string;
  detail: Record<string, unknown>;
}

/**
 * The signals a board's sightings raise.
 *
 *   shared_network:<other>  two enrolments on one network that are not one person's confirmed own
 *                           accounts. Who owns them is read again when staff open the list
 *                           (sharedNetworkRelation), so the stored row carries no ownership.
 *   late_account            added mid-contest. `sameNetworkAs` names one of its owner's other
 *                           characters it shares a network with: the mild case.
 *   late_account_far        added mid-contest AND connecting from a country its owner's other
 *                           characters in the event never connect from (`against: 'owner'`) or,
 *                           when its owner has no other character here, nobody else on its team
 *                           does (`against: 'team'`). Only the flagged account's own countries are
 *                           kept, never anybody else's.
 *
 * Its own kind for the far case, so staff marking the plain line fine doesn't hide a far one later.
 */
export function sharingSignals(input: { startMs: number; players: SharingPlayer[]; sightings: NetSighting[] }): {
  shared: SharingSignal[];
  late: SharingSignal[];
} {
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const netsOf = new Map<number, Set<string>>();
  const countriesOf = new Map<number, Set<string>>();
  const onNet = new Map<string, Set<number>>();
  for (const s of input.sightings) {
    if (!byId.has(s.participantId)) continue;
    netsOf.set(s.participantId, (netsOf.get(s.participantId) ?? new Set()).add(s.netHash));
    onNet.set(s.netHash, (onNet.get(s.netHash) ?? new Set()).add(s.participantId));
    if (s.country) countriesOf.set(s.participantId, (countriesOf.get(s.participantId) ?? new Set()).add(s.country));
  }

  const shared: SharingSignal[] = [];
  const paired = new Set<string>();
  for (const ids of onNet.values()) {
    if (ids.size < 2) continue;
    for (const a of ids) {
      for (const b of ids) {
        if (a === b || paired.has(`${a}:${b}`)) continue;
        const pa = byId.get(a)!;
        const pb = byId.get(b)!;
        // One person's own accounts, on record as theirs: expected, not a flag.
        if (ownerRelation(pa.owner, pb.owner) === 'same') continue;
        paired.add(`${a}:${b}`);
        shared.push({
          participantId: a,
          kind: `shared_network:${b}`,
          detail: { other: pb.name, sameTeam: pb.teamId != null && pb.teamId === pa.teamId },
        });
      }
    }
  }

  const late: SharingSignal[] = [];
  for (const [id, lateHours] of lateAdds(input.startMs, input.players)) {
    const p = byId.get(id)!;
    const others = input.players.filter((q) => q.id !== id);
    const siblings = others.filter((q) => sameOwner(ownerRelation(p.owner, q.owner)));
    const mine = netsOf.get(id) ?? new Set<string>();
    const sameNetworkAs = siblings.find((q) => [...(netsOf.get(q.id) ?? [])].some((h) => mine.has(h)))?.name;
    late.push({ participantId: id, kind: 'late_account', detail: { lateHours, ...(sameNetworkAs ? { sameNetworkAs } : {}) } });

    const seen = (group: SharingPlayer[]) => new Set(group.flatMap((q) => [...(countriesOf.get(q.id) ?? [])]));
    const ownersPlay = seen(siblings);
    const teamsPlay = seen(others.filter((q) => q.teamId === p.teamId));
    // The owner's own play is the better yardstick; the team's only when there is none of it.
    const against = ownersPlay.size > 0 ? 'owner' : teamsPlay.size > 0 ? 'team' : null;
    if (!against) continue;
    const usual = against === 'owner' ? ownersPlay : teamsPlay;
    const countries = [...(countriesOf.get(id) ?? [])].filter((c) => !usual.has(c)).sort();
    if (countries.length > 0) late.push({ participantId: id, kind: 'late_account_far', detail: { lateHours, countries, against } });
  }
  return { shared, late };
}

/**
 * Who owns the two sides of a stored shared-network signal, read NOW rather than when it was raised:
 * a link confirmed since then clears the line, and one that has changed hands shows as it stands.
 * null for any other kind, or when the other enrolment is gone.
 */
export function sharedNetworkRelation(
  kind: string,
  participantId: number,
  owners: Map<number, AccountOwner | null>,
): OwnerRelation | null {
  const [name, other] = kind.split(':');
  if (name !== 'shared_network') return null;
  const otherId = Number(other);
  if (!owners.has(participantId) || !owners.has(otherId)) return null;
  return ownerRelation(owners.get(participantId), owners.get(otherId));
}

/** "5 hours" / "3 days" into the event. */
function howLate(hours: number): string {
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * The staff line for a sharing signal, or null for any other kind. Weight as the panel reads it: 3
 * strong, 2 worth a look, 1 shown only beside another signal for the same player.
 *
 * Says what is known and no more: a network matching is a fact, who was at the keyboard is not.
 */
export function sharingSignalText(
  kind: string,
  d: { other?: string; sameTeam?: boolean; lateHours?: number; sameNetworkAs?: string; countries?: string[]; against?: string },
  owners?: OwnerRelation | null,
): { tag: string; text: string; weight: number } | null {
  switch (kind.split(':')[0]) {
    case 'shared_network': {
      const where = `Same network as ${d.sameTeam ? `teammate ${d.other}` : `${d.other}, on another team`}.`;
      if (owners === 'same_unconfirmed') {
        return {
          weight: 1,
          tag: 'same network',
          text: `${where} Both characters are linked to the same Anvil login, but one of those links was made by the plugin on first play, or is still waiting for review, and nobody has confirmed it.`,
        };
      }
      if (owners === 'different') {
        return {
          weight: 2,
          tag: 'same network',
          text: `${where} The two characters belong to different Anvil logins: one household, or one person playing both.`,
        };
      }
      if (owners === 'unknown') {
        return {
          weight: 2,
          tag: 'same network',
          text: `${where} At least one of the two characters is not linked to an Anvil login right now, so whether they are one person's is not known.`,
        };
      }
      return { weight: 2, tag: 'same network', text: where };
    }
    case 'late_account': {
      const added = `Put on the team ${howLate(d.lateHours ?? 0)} after the event started.`;
      return {
        weight: 2,
        tag: 'added late',
        text: d.sameNetworkAs
          ? `${added} It connects from the same network as ${d.sameNetworkAs}, which belongs to the same Anvil login: what somebody adding their own second account looks like.`
          : added,
      };
    }
    case 'late_account_far': {
      const from = (d.countries ?? []).join(', ');
      const added = `Put on the team ${howLate(d.lateHours ?? 0)} after the event started, and its plugin connects from ${from}`;
      return d.against === 'owner'
        ? { weight: 3, tag: 'added late, far away', text: `${added}: a country the other characters of the same Anvil login have not connected from during this event.` }
        : { weight: 2, tag: 'added late, far away', text: `${added}: a country nobody else on its team has connected from during this event. Ordinary on a team spread over several countries.` };
    }
    default:
      return null;
  }
}
