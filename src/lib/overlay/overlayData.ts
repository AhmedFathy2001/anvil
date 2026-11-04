import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clans, completions, eventOverlays, events, settings, tiles } from '@/db/schema';
import { overlayShowsMark, streamPlanId } from '@/lib/creatorPlans';
import { OVERLAY_HIDE_MARK_SETTING } from '@/lib/creatorPlansDb';
import { streamsEvents } from '@/lib/creatorSpaces';
import { eventActivityIsValid } from '@/lib/completionGate';
import { boardTiles, parseEventRules, visibleTiles } from '@/lib/eventRules';
import { eventStage } from '@/lib/eventStage';
import { LAB_CLAN_SLUG } from '@/lib/labRules';
import { eventFeedFloor, panelFeedWorthy } from '@/lib/moments';
import { boardTileItemIds, momentsForEvent } from '@/lib/momentsStore';
import { boardSize } from '@/lib/panelRows';
import { momentTitle } from '@/lib/pluginUi/feedUi';
import { boardCompletions } from '@/lib/pluginUi/feedView';
import { getTeamStandings } from '@/lib/statStandings';
import { standingsHidden, standingsRevealAt } from '@/lib/standingsVisibility';
import { deriveTileIcon, itemIconUrl } from '@/lib/tileIcons';
import { ttlMemo } from '@/lib/ttlMemo';

import {
  boardPayload,
  feedPayload,
  isOverlayKey,
  newOverlayKey,
  safeColor,
  standingsPayload,
  type FeedItemIn,
  type OverlayCurtain,
  type OverlayOptions,
  type OverlayPayload,
} from './overlayView';

// The stream overlay's reads (rules: lib/overlay/overlayView). Two halves:
//
//   the PUBLIC half — key → event → one view's payload. No session, no viewer: everything here is
//     built as the signed-out public would see it, whatever the key's holder can do elsewhere.
//   the HOST half — read, make, reset and remove an event's key. The routes that call these check
//     the caller is an admin of the event's clan first (api/events/[eventId]/overlay).

type EventRow = typeof events.$inferSelect;

/** Short enough to feel live, long enough that a scene full of overlays costs one build per view. */
const SNAPSHOT_TTL_MS = 4_000;

/**
 * The event an overlay key opens, or null.
 *
 * Null when the key is malformed or unknown, and also when the event's clan is not serving (a
 * suspended or archived space) or is the tile lab: a key outlives none of those.
 */
export async function overlayEventForKey(key: string): Promise<EventRow | null> {
  if (!isOverlayKey(key)) return null;
  // clan-scope: global -- the key IS the scope: an unguessable per-event capability the host minted;
  // the event's clan is checked on the next line.
  const [row] = await db
    .select({ event: events, clanStatus: clans.status, clanSlug: clans.slug, clanKind: clans.kind })
    .from(eventOverlays)
    .innerJoin(events, eq(events.id, eventOverlays.eventId))
    .innerJoin(clans, eq(clans.id, events.clanId))
    .where(eq(eventOverlays.key, key))
    .limit(1);
  // Nor a friends host's (lib/friendEventRules): a private board has no stream to show it on.
  if (!row || row.clanStatus !== 'active' || row.clanSlug === LAB_CLAN_SLUG || row.clanKind === 'friends') return null;
  return row.event;
}

function curtainOf(event: EventRow, now = Date.now()): OverlayCurtain {
  return { hidden: standingsHidden(event, now), revealAt: standingsRevealAt(event) };
}

/** One view of an event, as the public sees it. Memoised per event+view+limit for a few seconds. */
export function overlaySnapshot(event: EventRow, opts: Pick<OverlayOptions, 'view' | 'limit'>): Promise<OverlayPayload> {
  return ttlMemo(`overlay:${event.id}:${opts.view}:${opts.limit}`, () => buildSnapshot(event, opts), SNAPSHOT_TTL_MS);
}

async function buildSnapshot(event: EventRow, opts: Pick<OverlayOptions, 'view' | 'limit'>): Promise<OverlayPayload> {
  const curtain = curtainOf(event);
  const header = {
    name: event.name,
    stage: eventStage(event),
    endsAt: event.forceEndedAt ?? event.endDate ?? null,
    startsAt: event.startDate ?? null,
  };
  if (opts.view === 'standings') {
    // Nothing is even read while the curtain is down: the cheapest way to never send it.
    const rows = curtain.hidden ? [] : await getTeamStandings(event.id, event.scoringMode);
    return { header, view: 'standings', body: standingsPayload(rows, curtain, opts.limit) };
  }
  if (opts.view === 'feed') {
    const items = curtain.hidden ? [] : await feedItems(event);
    return { header, view: 'feed', body: feedPayload(items, curtain, opts.limit) };
  }
  return { header, view: 'board', body: await board(event, curtain) };
}

/** Drops (over the board's floor, or an item a tile wants) and finished tiles — the board's feed. */
async function feedItems(event: EventRow): Promise<FeedItemIn[]> {
  const [floorPlayers, tileItems, moments, done] = await Promise.all([
    boardSize(event.id),
    boardTileItemIds(event.id),
    momentsForEvent(event.id, 60),
    // Already gated on tilesRevealed + per-tile reveal (lib/pluginUi/feedView).
    boardCompletions(event.id),
  ]);
  const floor = eventFeedFloor(floorPlayers);
  const standings = await getTeamStandings(event.id, event.scoringMode);
  const teamName = new Map(standings.map((s) => [s.teamId, { name: s.name, color: s.color }]));
  const out: FeedItemIn[] = [];
  for (const m of moments) {
    if (m.kind === 'death') continue;
    if (!panelFeedWorthy(m, floor) && !(m.itemId != null && tileItems.has(m.itemId))) continue;
    const team = m.teamId != null ? teamName.get(m.teamId) : undefined;
    out.push({
      id: `m${m.id}`,
      kind: 'moment',
      sub: m.kind,
      text: momentTitle(m),
      who: m.rsn,
      teamId: m.teamId,
      teamName: team?.name ?? null,
      teamColor: team?.color ?? null,
      icon: m.itemId != null ? itemIconUrl(m.itemId) : null,
      at: m.occurredAt,
    });
  }
  for (const c of done.slice(0, 30)) {
    out.push({
      id: `t${c.tileId}:${c.teamId}`,
      kind: 'tile',
      sub: 'tile',
      text: `Tile complete: ${c.label}`,
      who: c.who,
      teamId: c.teamId,
      teamName: c.teamName,
      teamColor: c.teamColor,
      icon: null,
      at: c.at,
    });
  }
  return out;
}

async function board(event: EventRow, curtain: OverlayCurtain) {
  const revealed = !!event.tilesRevealed;
  if (!revealed) return boardPayload({ revealed, tiles: [], claims: new Map(), teamColors: new Map(), curtain, square: null });
  const rules = parseEventRules(event.rules);
  // clan-scope: this clan -- the board of the event the overlay key opened.
  const all = await db.select().from(tiles).where(eq(tiles.eventId, event.id));
  // The same gate the event page and its link card use: board cells only, revealed ones only.
  const shown = visibleTiles(rules, boardTiles(all)).sort((a, b) => a.position - b.position);
  const claims = new Map<number, number[]>();
  const teamColors = new Map<number, string>();
  if (!curtain.hidden && shown.length) {
    const standings = await getTeamStandings(event.id, event.scoringMode);
    standings.forEach((s, i) => teamColors.set(s.teamId, safeColor(s.color, i)));
    // clan-scope: this clan -- completions on the tiles just read for this event.
    const rows = await db
      .select({ tileId: completions.tileId, teamId: completions.teamId, completedAt: completions.completedAt })
      .from(completions)
      .where(inArray(completions.tileId, shown.map((t) => t.id)))
      .orderBy(asc(completions.completedAt));
    for (const r of rows) {
      if (!eventActivityIsValid(event, r.completedAt)) continue;
      const list = claims.get(r.tileId) ?? [];
      if (!list.includes(r.teamId)) list.push(r.teamId);
      claims.set(r.tileId, list);
    }
  }
  const square = event.format === 'bingo' && event.scoringMode !== 'points' && event.boardSize > 0 ? event.boardSize : null;
  return boardPayload({
    revealed,
    tiles: shown.map((t) => ({ id: t.id, label: t.label, icon: deriveTileIcon(t) })),
    claims,
    teamColors,
    curtain,
    square,
  });
}

/**
 * Does this event's overlay carry the small Anvil mark? Streaming spaces only — a creator space, or a
 * clan with Streaming on (an ordinary clan's overlay is unchanged): shown unless the host switched it off AND their plan may (lib/creatorPlans —
 * Gold and up once enforced; anyone while it is not). Memoised per clan like the snapshot.
 */
export function overlayMark(clanId: number): Promise<boolean> {
  return ttlMemo(`overlay-mark:${clanId}`, () => readOverlayMark(clanId), SNAPSHOT_TTL_MS);
}

/** The un-memoised read (tests call it directly). */
export async function readOverlayMark(clanId: number): Promise<boolean> {
  // clan-scope: this clan -- the overlay's own host, from the event the key opened.
  const [host, hide] = await Promise.all([
    db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true, plan: true, streaming: true } }),
    db.query.settings.findFirst({ where: and(eq(settings.clanId, clanId), eq(settings.key, OVERLAY_HIDE_MARK_SETTING)) }),
  ]);
  if (!streamsEvents(host)) return false;
  return overlayShowsMark({ clanPlan: streamPlanId(host), hideRequested: hide?.value === 'on' });
}

// ── The host's half ─────────────────────────────────────────────────────────────────────────────

/** The event's current key, or null when it has no overlay link. Caller has checked the admin. */
export async function overlayKeyFor(eventId: number): Promise<string | null> {
  // clan-scope: this clan -- by the event id the calling route already scoped to the admin's clan.
  const row = await db.query.eventOverlays.findFirst({ where: eq(eventOverlays.eventId, eventId) });
  return row?.key ?? null;
}

/**
 * Make a key, or replace the one there is ("Reset link"). Every URL built from the old key stops
 * working at once — the overlay page then shows "This overlay link was reset".
 */
export async function rotateOverlayKey(eventId: number): Promise<string> {
  const key = newOverlayKey();
  // clan-scope: this clan -- by the event id the calling route already scoped to the admin's clan.
  await db
    .insert(eventOverlays)
    .values({ eventId, key })
    .onConflictDoUpdate({ target: eventOverlays.eventId, set: { key, createdAt: new Date() } });
  return key;
}

/** Turn the overlay off: no key, no URL works. */
export async function removeOverlayKey(eventId: number): Promise<void> {
  // clan-scope: this clan -- by the event id the calling route already scoped to the admin's clan.
  await db.delete(eventOverlays).where(eq(eventOverlays.eventId, eventId));
}
