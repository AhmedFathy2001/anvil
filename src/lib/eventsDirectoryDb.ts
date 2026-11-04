// The public events directory — the read (rules: lib/eventsDirectory).
//
// Two queries for the whole platform: the advertised events with their hosts, then the player counts
// for exactly those. The result is shared by every visitor for a minute, so a busy /events costs the
// database two small reads a minute however many people open it.

import { and, count, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanTwitchChannels, clans, eventSignups, events, settings } from '@/db/schema';
import { PUBLIC_SHOWCASE_KEY } from '@/lib/clanListing';
import { ON_BOARD_STATUSES } from '@/lib/creatorPlans';
import { defaultAdvertised, toDirectoryEvent, type DirectoryEvent, type DirectoryRow } from '@/lib/eventsDirectory';

/** A sane ceiling: the directory is a shop window, not an archive. */
const MAX_LISTED = 500;

/**
 * Every listable event, as cards, unsorted and unfiltered — the caller (lib/eventsDirectory
 * directoryPage) does both in memory over this bounded set.
 */
export async function loadDirectoryEvents(now: number = Date.now()): Promise<DirectoryEvent[]> {
  // A day of slack on the end: stored dates come in two formats (lib/dbTime) that do not compare as
  // strings near midnight. The exact cut is made on parsed times in toDirectoryEvent.
  const looseCut = new Date(now - 86_400_000).toISOString();

  // clan-scope: global -- the platform-wide directory of events their hosts chose to advertise. Every
  // consent is in the WHERE: the host's per-event switch, a visibility a signed-out stranger can
  // already read (lib/eventAccess canSeeEvent), and a host clan that is active, public and not hidden
  // by the platform. Nothing here is readable that the event page itself would not show a stranger.
  const rows = await db
    .select({
      eventId: events.id,
      name: events.name,
      iconUrl: events.iconUrl,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      signupOpensAt: events.signupOpensAt,
      signupDeadline: events.signupDeadline,
      format: events.format,
      scoringMode: events.scoringMode,
      rules: events.rules,
      teamPlacement: events.teamPlacement,
      entry: events.entry,
      entryGates: events.entryGates,
      visibility: events.visibility,
      openToViewers: events.openToViewers,
      hostSlug: clans.slug,
      hostName: clans.name,
      hostLogoUrl: clans.logoUrl,
      hostKind: clans.kind,
      hostPlan: clans.plan,
      hostGuestPolicy: clans.guestPolicy,
      hostStreaming: clans.streaming,
      twitchLogin: clanTwitchChannels.twitchLogin,
    })
    .from(events)
    .innerJoin(clans, eq(clans.id, events.clanId))
    .leftJoin(clanTwitchChannels, eq(clanTwitchChannels.clanId, clans.id))
    .where(
      and(
        eq(events.advertised, true),
        // Exactly these two. 'invited' is the one that is not for strangers, and an unrecognised
        // string is nobody's decision — closed, as everywhere else (lib/eventVisibility).
        inArray(events.visibility, ['public', 'clan']),
        eq(clans.status, 'active'),
        eq(clans.platformHidden, false),
        eq(clans.visibility, 'public'),
        isNull(events.forceEndedAt),
        // Dated — or a streamed event (a creator space's, or a Streaming clan's viewer event), whose
        // undated board is open to join rather than a draft. The exact rule: listsUndated.
        or(
          sql`${events.startDate} is not null`,
          eq(clans.kind, 'creator'),
          and(eq(clans.streaming, true), eq(events.openToViewers, true)),
        ),
        or(isNull(events.endDate), sql`${events.endDate} > ${looseCut}`),
      ),
    )
    .orderBy(sql`${events.startDate} asc nulls first`)
    .limit(MAX_LISTED);

  if (rows.length === 0) return [];

  // clan-scope: global -- sign-up counts for exactly the event ids read above, each already vetted.
  const counts = await db
    .select({ eventId: eventSignups.eventId, n: count() })
    .from(eventSignups)
    .where(and(inArray(eventSignups.eventId, rows.map((r) => r.eventId)), inArray(eventSignups.status, [...ON_BOARD_STATUSES])))
    .groupBy(eventSignups.eventId);
  const players = new Map(counts.map((c) => [c.eventId, Number(c.n)]));

  const out: DirectoryEvent[] = [];
  for (const r of rows) {
    const row: DirectoryRow = { ...r, players: players.get(r.eventId) ?? 0 };
    const card = toDirectoryEvent(row, now);
    if (card) out.push(card);
  }
  return out;
}

// ── A minute of sharing ──────────────────────────────────────────────────────────────────────────
//
// In-process rather than Next's data cache: the page renders per request (filters are query params),
// and this keeps the cache usable from tests and scripts, which have no Next runtime around them.
// One in-flight load is shared, so a burst of first visitors makes one read, not one each.

const TTL_MS = 60_000;
let cached: { at: number; value: Promise<DirectoryEvent[]> } | null = null;

export function cachedDirectoryEvents(): Promise<DirectoryEvent[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = loadDirectoryEvents(now);
  cached = { at: now, value };
  // A failed read must not be served for a minute.
  value.catch(() => {
    if (cached?.value === value) cached = null;
  });
  return value;
}

/** Drop the shared copy — after a host flips the switch, so they see their change at once. */
export function forgetDirectory(): void {
  cached = null;
}

/** The "Advertise on Anvil" switch's starting position for a new event in this clan. */
export async function defaultAdvertisedForClan(clan: { id: number; kind: string | null | undefined }): Promise<boolean> {
  if (clan.kind !== 'creator') return false;
  // clan-scope: this clan -- the host's own showcase setting.
  const row = await db.query.settings.findFirst({
    where: and(eq(settings.clanId, clan.id), eq(settings.key, PUBLIC_SHOWCASE_KEY)),
    columns: { value: true },
  });
  return defaultAdvertised(clan.kind, row?.value ?? null);
}
