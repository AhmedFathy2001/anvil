// What a database row may look like by the time it reaches a browser.
//
// A server page that hands a whole row to a client component serialises every column into the page
// source, whether or not the screen draws it. For an event participant that meant the retired
// per-player login token, the Discord handle, the account and plugin-stat columns; for an event, the
// friends-invite secret. These are the shapes the screens actually read — pick, never spread, so a
// column added to the table later stays on the server until somebody decides a screen needs it.
//
// Pure (no database) so tests/client-rows.test.ts can hold the rule.

type ParticipantRow = {
  id: number;
  eventId: number;
  name: string;
  teamId: number | null;
  pickNumber: number | null;
  pickedAt: string | null;
  statsSnapshot?: string | null;
  snapshotAt?: string | null;
  cachedStats?: string | null;
  lastStatsFetch?: string | null;
  frozenAt?: string | null;
  clanMemberId?: number | null;
  discord?: string | null;
  timezone?: string | null;
  // Read-time joins (lib/draftProfiles attachOwners / attachProfiles), carried through when present.
  ownerUserId?: number | null;
  profile?: unknown;
};

type ReadTimeJoins<T> = Pick<T, Extract<keyof T, 'ownerUserId' | 'profile'>>;

/** A participant as the board, team and captain screens read it. No contact details, no token. */
export function boardPlayer<T extends ParticipantRow>(row: T) {
  const joins: { ownerUserId?: unknown; profile?: unknown } = {};
  if ('ownerUserId' in row) joins.ownerUserId = row.ownerUserId ?? null;
  if ('profile' in row) joins.profile = row.profile ?? null;
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    teamId: row.teamId,
    pickNumber: row.pickNumber,
    pickedAt: row.pickedAt,
    statsSnapshot: row.statsSnapshot ?? null,
    snapshotAt: row.snapshotAt ?? null,
    cachedStats: row.cachedStats ?? null,
    lastStatsFetch: row.lastStatsFetch ?? null,
    frozenAt: row.frozenAt ?? null,
    clanMemberId: row.clanMemberId ?? null,
    ...(joins as ReadTimeJoins<T>),
  };
}

/**
 * The same, for the event's own staff screens: the draft setup shows and edits the Discord handle
 * and timezone a player was entered with, so those two ride along. Still no token.
 */
export function staffPlayer<T extends ParticipantRow>(row: T) {
  return { ...boardPlayer(row), discord: row.discord ?? null, timezone: row.timezone ?? null };
}

/**
 * A participant for someone merely watching a draft: name, team and pick, plus the per-person
 * grouping key the caller supplies. No stat caches (they are standings), no seat id, no contact.
 */
export function spectatorPlayer(row: ParticipantRow & { ownerUserId: number | null }) {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    teamId: row.teamId,
    pickNumber: row.pickNumber,
    pickedAt: row.pickedAt,
    frozenAt: row.frozenAt ?? null,
    discord: null,
    timezone: null,
    profile: null,
    ownerUserId: row.ownerUserId,
  };
}

/**
 * An event row for a client component. The friends-invite secret lets anyone holding it join, and
 * no screen that receives the whole event reads it (the invite link is built on the server), so it
 * is blanked rather than removed — every consumer's type stays the row's.
 */
export function clientEvent<T extends { inviteToken?: string | null }>(event: T): T {
  return { ...event, inviteToken: null };
}

/**
 * A submission for someone who is not this event's staff.
 *
 * `proofFacts` is what the client reported about the moment of the credit (world, position, session
 * and the rest the integrity checks compare), `imageSha256` fingerprints the upload, and `coopGroup`
 * ties one kill's rows together. They are evidence for the event's own staff, who keep the whole
 * row; no player screen draws any of them. The flag and footprint verdict stay for everyone — the
 * board shows "counts · staff checking" on purpose.
 */
export function playerSubmission<T extends object>(row: T): Omit<T, 'proofFacts' | 'imageSha256' | 'coopGroup'> {
  const rest: Record<string, unknown> = { ...row };
  delete rest.proofFacts;
  delete rest.imageSha256;
  delete rest.coopGroup;
  return rest as Omit<T, 'proofFacts' | 'imageSha256' | 'coopGroup'>;
}
