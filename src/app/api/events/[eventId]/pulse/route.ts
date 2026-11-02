import { db } from '@/db';
import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { events, tiles, completions, submissions, moments, eventParticipants, clanRoster } from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { jsonWithEtag } from '@/lib/httpEtag';
import { cachedPulseToken } from '@/lib/pulseCache';
import { standingsScopeForRequest } from '@/lib/standingsAccess';

/**
 * Cheap "did anything change?" pulse for an event board. Returns a tiny fingerprint of the board's
 * mutable state, wrapped in {@link jsonWithEtag} — so an unchanged board answers **304 with no body**.
 * The page's useLiveRefresh polls this on tab-focus (throttled) and only pulls the real update
 * (router.refresh + client refetch) when the token moves. A few cheap indexed aggregates, no auth
 * (it exposes only counts/timestamps already visible on the public board).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  const scopedEvent = await eventForRequest(request, eId);
  if (!scopedEvent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(eId)) {
    return jsonWithEtag(request, { v: 'none' });
  }

  // HIDDEN STANDINGS. The ordinary token is made of board-wide completion and submission counts —
  // a tick every time ANY team claims something, readable by anyone. Behind the curtain a non-staff
  // viewer gets a token over their own team(s) only, marked so it can never equal the open one:
  // when the curtain lifts (the reveal time passes, or the host switches it off) the token changes
  // by itself and every open tab refreshes into the full standings, with no cache to invalidate.
  const standingsScope = await standingsScopeForRequest(request, scopedEvent);
  if (standingsScope.hidden) {
    const own = [...standingsScope.ownTeamIds].sort((a, b) => a - b);
    const part = new URL(request.url).searchParams.get('part') === 'stats' ? 'stats' : 'board';
    const v = await cachedPulseToken(`event-curtain:${eId}:${part}:${own.join(',')}`, () =>
      part === 'stats' ? computeStatsToken(eId, own) : computeCurtainToken(eId, own),
    );
    return jsonWithEtag(request, { v: `curtain|${standingsScope.revealAt ?? ''}|${v}` });
  }

  // `?part=stats`: KC/XP progress only. A plugin push or a hiscores fetch moves a stat tile without
  // touching anything the board token watches, so progress bars sat stale until something else
  // happened. Kept a separate token so the page refetches just the progress numbers for it, not
  // the whole board.
  if (new URL(request.url).searchParams.get('part') === 'stats') {
    const stats = await cachedPulseToken(`event-stats:${eId}`, () => computeStatsToken(eId));
    return jsonWithEtag(request, { v: stats });
  }

  // Collapse concurrent viewers' polls of the same board to one DB computation per ~5s.
  const token = await cachedPulseToken(`event:${eId}`, () => computeEventToken(eId));
  return jsonWithEtag(request, { v: token });
}

/** The newest stat reading any player on the board has: a live plugin push or a hiscores fetch. */
async function computeStatsToken(eId: number, onlyTeams?: number[]): Promise<string> {
  if (onlyTeams && onlyTeams.length === 0) return 'none';
  // clan-scope: global -- a helper called only from handlers that have already run the event guard above.
  const [row] = await db
    .select({
      live: sql<string | null>`max(${clanRoster.liveStatsAt})`,
      fetched: sql<string | null>`max(${eventParticipants.lastStatsFetch})`,
    })
    .from(eventParticipants)
    .leftJoin(clanRoster, eq(eventParticipants.clanMemberId, clanRoster.id))
    .where(
      and(
        eq(eventParticipants.eventId, eId),
        onlyTeams ? inArray(eventParticipants.teamId, onlyTeams) : undefined,
      ),
    );
  return `${row?.live ?? ''}|${row?.fetched ?? ''}`;
}

/**
 * The board token behind the standings curtain: the board's own shape (reveals, expiries, edits,
 * the end) plus the viewer's own teams' claims and proof — nothing that moves when a rival scores.
 */
async function computeCurtainToken(eId: number, ownTeams: number[]): Promise<string> {
  // clan-scope: global -- a helper called only from handlers that have already run the event guard above.
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
    columns: { tilesRevealed: true, forceEndedAt: true, endDate: true },
  });
  if (!event) return 'none';
  const [ta] = await db
    .select({
      count: sql<number>`count(*)`,
      revealed: sql<string | null>`max(${tiles.revealedAt})`,
      // Expiries are on the board itself (a rotation closing, a lockout claimed) — not a new leak.
      closed: sql<string | null>`max(${tiles.closedAt})`,
      edited: sql<string | null>`max(${tiles.updatedAt})`,
    })
    .from(tiles)
    .where(eq(tiles.eventId, eId));
  let own = 'none';
  if (ownTeams.length > 0) {
    const tileIds = (await db.select({ id: tiles.id }).from(tiles).where(eq(tiles.eventId, eId))).map((t) => t.id);
    if (tileIds.length > 0) {
      const [c] = await db
        .select({ count: sql<number>`count(*)`, max: sql<string | null>`max(${completions.completedAt})` })
        .from(completions)
        .where(and(inArray(completions.tileId, tileIds), inArray(completions.teamId, ownTeams)));
      const [s] = await db
        .select({ count: sql<number>`count(*)`, max: sql<string | null>`max(${submissions.createdAt})` })
        .from(submissions)
        .where(and(inArray(submissions.tileId, tileIds), inArray(submissions.teamId, ownTeams)));
      const [f] = await db
        .select({ count: sql<number>`count(*)` })
        .from(moments)
        .where(and(eq(moments.eventId, eId), inArray(moments.teamId, ownTeams)));
      own = [c?.count ?? 0, c?.max ?? '', s?.count ?? 0, s?.max ?? '', f?.count ?? 0].join('|');
    }
  }
  return [
    event.tilesRevealed ? 1 : 0,
    event.forceEndedAt ?? '',
    event.endDate ?? '',
    Number(ta?.count ?? 0),
    ta?.revealed ?? '',
    ta?.closed ?? '',
    ta?.edited ?? '',
    own,
  ].join('|');
}

async function computeEventToken(eId: number): Promise<string> {
  // clan-scope: global -- a helper called only from handlers that have already run the event guard above.
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
    columns: { tilesRevealed: true, forceEndedAt: true, endDate: true },
  });
  if (!event) {
    return 'none';
  }

  // Tile-level board state (reveal/expiry flips + count) in one pass.
  const tileAgg = await db
    .select({
      count: sql<number>`count(*)`,
      revealed: sql<string | null>`max(${tiles.revealedAt})`,
      closed: sql<string | null>`max(${tiles.closedAt})`,
      // A tile's text or goal edited in place: same count, same reveal — only this moves.
      edited: sql<string | null>`max(${tiles.updatedAt})`,
    })
    .from(tiles)
    .where(eq(tiles.eventId, eId));
  const ta = tileAgg[0] ?? { count: 0, revealed: null, closed: null, edited: null };

  // Completions + submissions are keyed by tileId, so scope them to this event's tiles.
  const tileIds = (await db.select({ id: tiles.id }).from(tiles).where(eq(tiles.eventId, eId))).map((t) => t.id);

  let comp = { count: 0, max: null as string | null };
  let sub = { count: 0, max: null as string | null };
  if (tileIds.length > 0) {
    const [c] = await db
      .select({ count: sql<number>`count(*)`, max: sql<string | null>`max(${completions.completedAt})` })
      .from(completions)
      .where(inArray(completions.tileId, tileIds));
    const [s] = await db
      .select({ count: sql<number>`count(*)`, max: sql<string | null>`max(${submissions.createdAt})` })
      .from(submissions)
      .where(inArray(submissions.tileId, tileIds));
    comp = { count: Number(c?.count ?? 0), max: c?.max ?? null };
    sub = { count: Number(s?.count ?? 0), max: s?.max ?? null };
  }

  // The highlight feed moves without any completion or submission behind it — a pet, a death, a
  // drop for a tile nobody has — so an open tab would never learn about one otherwise.
  const [feed] = await db
    .select({ count: sql<number>`count(*)` })
    .from(moments)
    .where(eq(moments.eventId, eId));

  // Any change to these moves the token → the ETag → a 200 (else 304). Event lifecycle flips
  // (reveal, force-end) are included so the board updates when they happen too.
  const token = [
    event.tilesRevealed ? 1 : 0,
    event.forceEndedAt ?? '',
    event.endDate ?? '',
    Number(ta.count ?? 0),
    ta.revealed ?? '',
    ta.closed ?? '',
    ta.edited ?? '',
    comp.count,
    comp.max ?? '',
    sub.count,
    sub.max ?? '',
    Number(feed?.count ?? 0),
  ].join('|');

  return token;
}
