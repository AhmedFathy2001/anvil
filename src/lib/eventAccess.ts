// Who may see an event, and who may enter it.
//
// Every event was its clan's alone, which was the only thing one-clan-per-deployment could express.
// Clan-versus-clan is the point of putting clans on one platform, and it needs both questions
// answered separately — a public board with approval entry is the ordinary cross-clan case, where
// anyone may look and the host decides who plays.
//
// THE STRUCTURAL PROBLEM this has to solve: `event_signups.clan_member_id` is NOT NULL and names a
// seat in the EVENT'S clan, so somebody from another clan has nowhere to sit. Entry therefore
// creates a guest seat in the host clan, through the same admission path everything else uses. A
// visitor to your event becomes a guest of your clan, which is exactly what they are.

import { and, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanStaff, clans, eventCohosts, eventInvites, events, users } from '@/db/schema';
import { isBannedFromClan } from '@/lib/clanBans';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { entryOf, visibilityOf } from '@/lib/eventVisibility';

export { isEntry, isVisibility, type EventEntry, type EventVisibility } from '@/lib/eventVisibility';

/**
 * May this person look at this event?
 *
 * The host clan's own people always can — visibility is about outsiders. Staff of the host clan are
 * covered by that too, since they hold a seat or a grant there.
 */
export async function canSeeEvent(opts: {
  eventId: number;
  /** Null for a signed-out visitor. */
  playerId: number | null;
}): Promise<boolean> {
  // clan-scope: global -- reads the very event being access-checked, by its own id; its clanId is the subject of the check below.
  const event = await db.query.events.findFirst({ where: eq(events.id, opts.eventId) });
  if (!event) return false;

  const visibility = visibilityOf(event.visibility);
  if (visibility === 'public') return true;

  // 'clan' MEANS "THIS CLAN'S EVENT", NOT "LOGGED-IN MEMBERS ONLY". Whether a stranger may read
  // this clan is the clan's own setting, and it is `public` unless somebody turned it off — which
  // is what every clan has always done, since the habit is to paste the board link into Discord.
  //
  // Reading 'clan' as "holds a seat" is the bug this replaces: it 404'd every board for anyone
  // signed out, including the clan's own members before they log in, and including the front page's
  // own "See a live event" button.
  if (visibility === 'clan' && (await clanIsPublic(event.clanId))) return true;

  if (opts.playerId == null) return false;

  // In the host clan? Then it is theirs to see, whatever the setting says. A SEAT or a GRANT —
  // staff are frequently people with authority and no roster row, and an admin who cannot open
  // their own clan's event would be a strange way to enforce privacy.
  if (await hasSeatIn(event.clanId, opts.playerId)) return true;
  if (await hasGrantIn(event.clanId, opts.playerId)) return true;

  // A member of a clan that ACCEPTED a co-host seat on this event may see it (and enter it) — they're
  // running a team here, whatever the visibility says.
  if (await inAcceptedCohostClan(opts.eventId, opts.playerId)) return true;

  if (visibility === 'clan') return false;

  // invited — by name, or by belonging to an invited clan.
  return invitedToEvent(opts.eventId, opts.playerId);
}

/** Does this clan let strangers read it? `public` unless an admin has said otherwise. */
async function clanIsPublic(clanId: number): Promise<boolean> {
  const row = await db.query.clans.findFirst({
    where: eq(clans.id, clanId),
    columns: { visibility: true },
  });
  // Unknown values read as PRIVATE, the closed answer — the same rule the event vocabulary uses.
  return clanVisibilityOf(row?.visibility) === 'public';
}

/** A live seat in this clan, of any kind. */
async function hasSeatIn(clanId: number, playerId: number): Promise<boolean> {
  const row = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(eq(clanMemberships.clanId, clanId), eq(accounts.playerId, playerId), isNull(clanMemberships.leftAt)),
    )
    .limit(1);
  return row.length > 0;
}

/** Does this person hold a seat in a clan that has accepted a co-host seat on this event? */
async function inAcceptedCohostClan(eventId: number, playerId: number): Promise<boolean> {
  const row = await db
    .select({ id: eventCohosts.id })
    .from(eventCohosts)
    .innerJoin(clanMemberships, eq(clanMemberships.clanId, eventCohosts.clanId))
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(
        eq(eventCohosts.eventId, eventId),
        eq(eventCohosts.status, 'accepted'),
        eq(accounts.playerId, playerId),
        isNull(clanMemberships.leftAt),
      ),
    )
    .limit(1);
  return row.length > 0;
}

/** A staff grant in this clan, which is authority without necessarily a roster seat. */
async function hasGrantIn(clanId: number, playerId: number): Promise<boolean> {
  const row = await db
    .select({ id: clanStaff.id })
    .from(clanStaff)
    .innerJoin(users, eq(users.id, clanStaff.userId))
    .where(and(eq(clanStaff.clanId, clanId), eq(users.playerId, playerId)))
    .limit(1);
  return row.length > 0;
}

/** Invited personally, or as part of a clan they are in. */
export async function invitedToEvent(eventId: number, playerId: number): Promise<boolean> {
  const byName = await db.query.eventInvites.findFirst({
    where: and(eq(eventInvites.eventId, eventId), eq(eventInvites.playerId, playerId)),
  });
  if (byName) return true;

  // Any clan they hold a seat in, that has been invited.
  const rows = await db
    .select({ id: eventInvites.id })
    .from(eventInvites)
    .innerJoin(clanMemberships, eq(clanMemberships.clanId, eventInvites.clanId))
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(eq(eventInvites.eventId, eventId), eq(accounts.playerId, playerId), isNull(clanMemberships.leftAt)),
    )
    .limit(1);
  return rows.length > 0;
}

export type EntryVerdict =
  /** They are already in the host clan; the ordinary sign-up path applies. */
  | { outcome: 'insider' }
  /** An outsider who may enter, and whether the host has to say yes. */
  | { outcome: 'outsider'; needsApproval: boolean }
  | { outcome: 'refused'; reason: 'not-visible' | 'banned' | 'signed-out' };

/**
 * May this person ENTER this event, and what has to happen first?
 *
 * Separate from `canSeeEvent` because seeing and entering diverge on purpose: a public event is
 * readable by anyone and enterable by whoever the host allows.
 */
export async function canEnterEvent(opts: {
  eventId: number;
  playerId: number | null;
}): Promise<EntryVerdict> {
  if (opts.playerId == null) return { outcome: 'refused', reason: 'signed-out' };

  // clan-scope: global -- reads the very event being access-checked, by its own id; its clanId is the subject of the check below.
  const event = await db.query.events.findFirst({ where: eq(events.id, opts.eventId) });
  if (!event) return { outcome: 'refused', reason: 'not-visible' };

  // A clan ban stops entry even when the event is public — the host clan has said no to this person,
  // and an event is that clan's.
  if (await isBannedFromClan(event.clanId, opts.playerId)) {
    return { outcome: 'refused', reason: 'banned' };
  }

  if (await hasSeatIn(event.clanId, opts.playerId)) return { outcome: 'insider' };

  if (!(await canSeeEvent({ eventId: opts.eventId, playerId: opts.playerId }))) {
    return { outcome: 'refused', reason: 'not-visible' };
  }

  const entry = entryOf(event.entry);
  // An INVITED outsider has already been decided about — that is what the invitation was. Asking
  // them to apply as well would be asking twice.
  const invited = await invitedToEvent(opts.eventId, opts.playerId);
  return { outcome: 'outsider', needsApproval: entry === 'approval' && !invited };
}

/** Every event a person may see across the platform — for a cross-clan "what can I enter" list. */
export async function visibleEventIds(playerId: number | null): Promise<number[]> {
  // clan-scope: global -- "what may this person see anywhere" is the question, and it spans clans by
  // definition. Visibility is applied per row below rather than skipped.
  const all = await db
    .select({ id: events.id, clanId: events.clanId, visibility: events.visibility })
    .from(events)
    .where(or(eq(events.visibility, 'public'), eq(events.visibility, 'invited')));

  const out: number[] = [];
  for (const e of all) {
    if (e.visibility === 'public') {
      out.push(e.id);
      continue;
    }
    if (playerId != null && (await invitedToEvent(e.id, playerId))) out.push(e.id);
  }
  return out;
}
