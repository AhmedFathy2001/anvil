// Stream highlights — the database and network half (the rules are lib/highlights/rules, the Twitch
// calls lib/highlights/twitchApi, the bot's token lib/highlights/botToken).
//
// TRIGGERS are fire-and-forget (`queue…`): the request that recorded a drop, finished a tile or
// started an event never waits on Twitch. Each one works out the channels (planTargets), checks the
// channel is live, files one row per (event, beat, channel) — the unique index is the dedupe — and,
// on Twitch, asks for a clip within the rate limits and follows it up ~15-60 s later. VOD links are
// resolved afterwards by the per-minute cron (resolveDueVods), because an archive's final shape only
// exists once the stream ends.
//
// READS respect exactly what the feed respects: the event must be the viewer's to see (the pages and
// routes check canSeeEvent), and behind hidden standings only the viewer's own team's beats show.

import { and, desc, eq, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanMemberships,
  clanTwitchChannels,
  clanYoutubeChannels,
  clans,
  completions,
  eventParticipants,
  events,
  streamHighlights,
  submissions,
  teams,
  tiles,
  userTwitchLinks,
  users,
} from '@/db/schema';
import { streamedEvent } from '@/lib/creatorSpaces';
import { parseStamp } from '@/lib/dbTime';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { eventFeedFloor, momentSentence, panelFeedWorthy } from '@/lib/moments';
import { isPreview } from '@/lib/platformSettings';
import { log } from '@/lib/logger';
import { ttlMemo } from '@/lib/ttlMemo';
import { standingsHidden } from '@/lib/standingsVisibility';
import { recentBroadcasts, youtubeConfig } from '@/lib/gates/youtube';
import { withHostYoutube } from '@/lib/gates/youtubeDb';
import { botAccess, botFetch } from '@/lib/highlights/botToken';
import { CLIP_TIMING, getArchives, getLiveStream, makeClip, type ClipTiming } from '@/lib/highlights/twitchApi';
import {
  ClipLimiter,
  VOD_MAX_ATTEMPTS,
  cleanTitle,
  freshEnough,
  momentClippable,
  pickTwitchVod,
  pickYoutubeVod,
  planTargets,
  showable,
  visibleToScope,
  vodRetryDelayMs,
  youtubeLiveNow,
  type BeatActor,
  type HighlightBeat,
  type HighlightTarget,
  type HostChannels,
  type ShownHighlight,
  type TwitchArchive,
  type YoutubeBroadcast,
} from '@/lib/highlights/rules';

// ── Test seams ───────────────────────────────────────────────────────────────────────────────────

let sleepImpl = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let timing: ClipTiming = CLIP_TIMING;
export let clipLimiter = new ClipLimiter();
const running = new Set<Promise<unknown>>();

export function setHighlightsTestHooks(opts: { sleep?: (ms: number) => Promise<void>; timing?: ClipTiming; limiter?: ClipLimiter }): void {
  if (opts.sleep) sleepImpl = opts.sleep;
  if (opts.timing) timing = opts.timing;
  if (opts.limiter) clipLimiter = opts.limiter;
}

/** Wait for every queued trigger and clip follow-up to finish (tests). */
export async function settleHighlights(): Promise<void> {
  while (running.size) await Promise.allSettled([...running]);
}

function track<T>(p: Promise<T>): Promise<T> {
  running.add(p);
  void p.finally(() => running.delete(p)).catch(() => {});
  return p;
}

/**
 * Whether this deployment makes clips at all. The owner's preview (beta) shares real streamers'
 * channels with production through its imported data, so it never clips unless HIGHLIGHTS_CLIPS=on;
 * HIGHLIGHTS_CLIPS=off turns clipping off anywhere. VOD links are reads and work either way.
 */
export function clipsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.HIGHLIGHTS_CLIPS?.trim().toLowerCase();
  if (v === 'off') return false;
  if (v === 'on') return true;
  return !isPreview();
}

// ── Who and where ────────────────────────────────────────────────────────────────────────────────

interface EventContext {
  eventId: number;
  clanId: number;
  name: string;
  streamed: boolean;
  host: HostChannels;
  hidden: boolean;
}

async function ownerPlayerOf(userId: number | null): Promise<number | null> {
  if (userId == null) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { playerId: true } });
  return u?.playerId ?? null;
}

async function eventContext(eventId: number): Promise<EventContext | null> {
  // clan-scope: global -- the event is named by id and its own clan is read back from it.
  const ev = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, clanId: true, name: true, openToViewers: true, rules: true, endDate: true, forceEndedAt: true },
  });
  if (!ev) return null;
  const clan = await db.query.clans.findFirst({
    where: eq(clans.id, ev.clanId),
    columns: { kind: true, streaming: true, highlightsAutoClip: true },
  });
  const streamed = streamedEvent(clan, ev);
  if (!streamed) return { eventId, clanId: ev.clanId, name: ev.name, streamed, host: { autoClip: false, twitch: null, youtube: null }, hidden: false };
  // clan-scope: the event's own host.
  const tw = await db.query.clanTwitchChannels.findFirst({
    where: eq(clanTwitchChannels.clanId, ev.clanId),
    columns: { twitchUserId: true, twitchLogin: true, linkedByUserId: true, brokenAt: true },
  });
  // clan-scope: the event's own host.
  const yt = youtubeConfig()
    ? await db.query.clanYoutubeChannels.findFirst({
        where: eq(clanYoutubeChannels.clanId, ev.clanId),
        columns: { youtubeChannelId: true, title: true, linkedByUserId: true, brokenAt: true },
      })
    : null;
  return {
    eventId,
    clanId: ev.clanId,
    name: ev.name,
    streamed,
    hidden: standingsHidden(ev),
    host: {
      autoClip: clan?.highlightsAutoClip ?? true,
      twitch: tw
        ? { broadcasterId: tw.twitchUserId, login: tw.twitchLogin, ownerPlayerId: await ownerPlayerOf(tw.linkedByUserId), broken: tw.brokenAt != null }
        : null,
      youtube: yt
        ? { channelId: yt.youtubeChannelId, title: yt.title, ownerPlayerId: await ownerPlayerOf(yt.linkedByUserId), broken: yt.brokenAt != null }
        : null,
    },
  };
}

async function actorFor(playerId: number | null | undefined): Promise<BeatActor | null> {
  if (playerId == null) return null;
  const u = await db.query.users.findFirst({ where: eq(users.playerId, playerId), columns: { id: true } });
  if (!u) return { playerId, userId: null, twitch: null };
  const link = await db.query.userTwitchLinks.findFirst({ where: eq(userTwitchLinks.userId, u.id) });
  return {
    playerId,
    userId: u.id,
    twitch: link ? { id: link.twitchUserId, login: link.twitchLogin, clipOptIn: link.clipMyMoments } : null,
  };
}

// ── Live? ────────────────────────────────────────────────────────────────────────────────────────

/** Short per-process answers (live? broadcasts?), shared by concurrent callers. Failures aren't kept. */
const answers = new Map<string, { at: number; ttl: number; p: Promise<unknown> }>();
function held<T>(key: string, ttl: number, compute: () => Promise<T>): Promise<T> {
  const hit = answers.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.p as Promise<T>;
  const p = compute().then(
    (v) => {
      if (v == null) answers.delete(key); // "couldn't say" is asked again next time
      return v;
    },
    (err) => {
      answers.delete(key);
      throw err;
    },
  );
  answers.set(key, { at: Date.now(), ttl, p });
  if (answers.size > 2000) for (const [k, v] of answers) if (Date.now() - v.at >= v.ttl) answers.delete(k);
  return p;
}

export function clearHighlightCachesForTests(): void {
  answers.clear();
}

/** Is this Twitch channel live? Held 30 s per channel; null when Twitch could not say. */
function twitchLive(broadcasterId: string): Promise<boolean | null> {
  return held(
    `live:${broadcasterId}`,
    30_000,
    async () => {
      let access = await botAccess();
      if (!access) return null;
      let r = await getLiveStream(access.cfg, access.token, broadcasterId, botFetch());
      if (!r.ok && r.reason === 'unauthorized') {
        access = await botAccess(true);
        if (!access) return null;
        r = await getLiveStream(access.cfg, access.token, broadcasterId, botFetch());
      }
      return r.ok ? r.value != null : null;
    },
  );
}

/**
 * The host's recent YouTube broadcasts, held two minutes per space: one unit of quota covers every
 * beat in that window, and the VOD sweep reads the same cache.
 */
function youtubeBroadcasts(clanId: number): Promise<YoutubeBroadcast[] | null> {
  return held(`yt:${clanId}`, 2 * 60_000, async () => {
    const r = await withHostYoutube(clanId, (token) => recentBroadcasts(token));
    return r && r.ok ? r.value : null;
  });
}

// ── Recording a beat ─────────────────────────────────────────────────────────────────────────────

export interface Beat {
  eventId: number;
  beat: HighlightBeat;
  refKey: string;
  title: string;
  occurredAt: Date;
  teamId?: number | null;
  tileId?: number | null;
  momentId?: number | null;
  /** Whose beat it is (a player beat). Null for the event's own beats. */
  actorPlayerId?: number | null;
}

/** Record one beat on every channel it belongs on. Returns the new rows' ids. Never throws. */
export async function recordBeat(beat: Beat, now = Date.now()): Promise<number[]> {
  try {
    if (!freshEnough(beat.occurredAt.getTime(), now)) return [];
    const ctx = await eventContext(beat.eventId);
    if (!ctx?.streamed) return [];
    const targets = planTargets({ streamed: true, beat: beat.beat, host: ctx.host, actor: await actorFor(beat.actorPlayerId) });
    const ids: number[] = [];
    for (const t of targets) {
      const id = await recordOn(ctx, beat, t, now);
      if (id != null) ids.push(id);
    }
    return ids;
  } catch (err) {
    log.warn('highlights.record-failed', { eventId: beat.eventId, beat: beat.beat }, err);
    return [];
  }
}

async function recordOn(ctx: EventContext, beat: Beat, t: HighlightTarget, now: number): Promise<number | null> {
  let yt: YoutubeBroadcast[] | null = null;
  if (t.platform === 'twitch') {
    if ((await twitchLive(t.channelId)) !== true) return null;
  } else {
    yt = await youtubeBroadcasts(ctx.clanId);
    if (!yt || !youtubeLiveNow(yt)) return null;
  }
  const ytVod = yt ? pickYoutubeVod(yt, beat.occurredAt.getTime(), now) : null;
  const [row] = await db
    .insert(streamHighlights)
    .values({
      eventId: ctx.eventId,
      clanId: ctx.clanId,
      beat: beat.beat,
      refKey: beat.refKey,
      platform: t.platform,
      channelOwner: t.owner,
      channelId: t.channelId,
      channelName: cleanTitle(t.channelName).slice(0, 100),
      userId: t.userId,
      teamId: beat.teamId ?? null,
      tileId: beat.tileId ?? null,
      momentId: beat.momentId ?? null,
      title: cleanTitle(beat.title) || 'Highlight',
      occurredAt: beat.occurredAt,
      clipStatus: t.platform === 'youtube' ? 'none' : 'pending',
      vodUrl: ytVod?.url ?? null,
      vodStatus: ytVod ? 'ready' : 'pending',
      vodNextAt: ytVod ? null : new Date(now + 60_000),
    })
    .onConflictDoNothing()
    .returning({ id: streamHighlights.id });
  if (!row) return null; // already caught on this channel
  if (t.platform === 'twitch') await startClip(row.id, t.channelId, now);
  return row.id;
}

async function setClip(id: number, values: Partial<typeof streamHighlights.$inferInsert>): Promise<void> {
  await db.update(streamHighlights).set({ ...values, updatedAt: new Date() }).where(eq(streamHighlights.id, id));
}

async function startClip(id: number, broadcasterId: string, now: number): Promise<void> {
  const access = await botAccess();
  // No clips:edit (the bot needs re-authorizing) or clipping is off here: skip quietly, keep the VOD.
  if (!access || !access.canClip || !clipsEnabled()) return setClip(id, { clipStatus: 'off' });
  if (!clipLimiter.allow(broadcasterId, now)) return setClip(id, { clipStatus: 'limited' });
  void track(followClip(id, broadcasterId));
}

/** Ask for the clip and follow it until it is ready (or not). Runs after the trigger has returned. */
async function followClip(id: number, broadcasterId: string): Promise<void> {
  try {
    const access = await botAccess();
    if (!access) return setClip(id, { clipStatus: 'failed' });
    const run = () =>
      makeClip({
        cfg: access.cfg,
        token: async () => (await botAccess())?.token ?? null,
        broadcasterId,
        f: botFetch(),
        sleep: sleepImpl,
        timing,
      });
    let out = await run();
    if (!out.ok && out.reason === 'unauthorized' && (await botAccess(true))) out = await run();
    if (out.ok) {
      await setClip(id, { clipStatus: 'ready', clipId: out.clip.id, clipUrl: out.clip.url, thumbnailUrl: out.clip.thumbnailUrl, durationS: out.clip.durationS });
    } else {
      log.info('highlights.clip-failed', { id, reason: out.reason });
      await setClip(id, { clipStatus: 'failed' });
    }
  } catch (err) {
    log.warn('highlights.clip-crashed', { id }, err);
    await setClip(id, { clipStatus: 'failed' }).catch(() => {});
  }
}

/** Fire-and-forget form for the hooks. */
export function queueBeat(beat: Beat): void {
  void track(recordBeat(beat));
}

// ── The hooks' helpers ───────────────────────────────────────────────────────────────────────────

/** A board's player count, for its Feed floor. Held five minutes (the same number panelRows uses). */
function boardPlayers(eventId: number): Promise<number> {
  return ttlMemo(
    `highlights-board-size:${eventId}`,
    async () => {
      const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(eventParticipants).where(eq(eventParticipants.eventId, eventId));
      return r?.n ?? 0;
    },
    5 * 60_000,
  );
}

export interface MomentForHighlight {
  id: number;
  rsn: string;
  kind: string;
  itemId: number | null;
  itemName: string | null;
  quantity: number;
  valueGp: number | null;
  source: string | null;
  sourceKind: string | null;
  tier: string | null;
  teamId: number | null;
  eventId: number | null;
  occurredAt: string;
}

/** Moments a seat just stored (POST /api/plugin/moments): clip the big ones on a streamed board. */
export function queueMomentHighlights(clanMemberId: number, list: MomentForHighlight[]): void {
  const onBoard = list.filter((m) => m.eventId != null && (m.kind === 'pet' || m.kind === 'unique' || m.kind === 'loot'));
  if (!onBoard.length) return;
  void track(
    (async () => {
      try {
        // clan-scope: global -- keyed by the SEAT this request just pushed for.
        const [seat] = await db
          .select({ playerId: accounts.playerId })
          .from(clanMemberships)
          .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
          .where(eq(clanMemberships.id, clanMemberId))
          .limit(1);
        for (const m of onBoard) {
          const floor = eventFeedFloor(await boardPlayers(m.eventId!));
          if (!momentClippable(m.kind, panelFeedWorthy(m, floor))) continue;
          const at = parseStamp(m.occurredAt);
          if (at == null) continue;
          await recordBeat({
            eventId: m.eventId!,
            beat: 'moment',
            refKey: `moment:${m.id}`,
            title: `${m.rsn} ${momentSentence(m)}`,
            occurredAt: new Date(at),
            teamId: m.teamId,
            momentId: m.id,
            actorPlayerId: seat?.playerId ?? null,
          });
        }
      } catch (err) {
        log.warn('highlights.moments-failed', {}, err);
      }
    })(),
  );
}

/** A team just finished a board tile (live, not a sweep's catch-up): clip it for whoever finished it. */
export function queueTileHighlight(tileId: number, teamId: number): void {
  void track(
    (async () => {
      try {
        // clan-scope: global -- by the ids of a completion this request just stored.
        const [c] = await db
          .select({
            eventId: tiles.eventId,
            label: tiles.label,
            parent: tiles.parentTileId,
            revealedAt: tiles.revealedAt,
            mission: tiles.mission,
            tilesRevealed: events.tilesRevealed,
            rules: events.rules,
            at: completions.completedAt,
            credit: completions.creditPlayerId,
          })
          .from(completions)
          .innerJoin(tiles, eq(tiles.id, completions.tileId))
          .innerJoin(events, eq(events.id, tiles.eventId))
          .where(and(eq(completions.tileId, tileId), eq(completions.teamId, teamId)))
          .limit(1);
        if (!c || c.parent != null || c.eventId == null) return;
        // Never name a tile the board doesn't show yet.
        if (!c.tilesRevealed || !isTileRevealed(parseEventRules(c.rules), c)) return;
        // Whoever finished it: the recorded finisher, else the last submission on it for that team.
        let participantId = c.credit;
        if (participantId == null) {
          const [s] = await db
            .select({ p: sql<number | null>`coalesce(${submissions.creditPlayerId}, ${submissions.playerId})` })
            .from(submissions)
            .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)))
            .orderBy(desc(submissions.id))
            .limit(1);
          participantId = s?.p ?? null;
        }
        let who: string | null = null;
        let playerId: number | null = null;
        if (participantId != null) {
          const [p] = await db
            .select({ name: eventParticipants.name, playerId: accounts.playerId })
            .from(eventParticipants)
            .leftJoin(accounts, eq(accounts.id, eventParticipants.accountId))
            .where(eq(eventParticipants.id, participantId))
            .limit(1);
          who = p?.name ?? null;
          playerId = p?.playerId ?? null;
        }
        const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId), columns: { name: true } });
        await recordBeat({
          eventId: c.eventId,
          beat: 'tile',
          refKey: `tile:${tileId}:${teamId}`,
          title: `${who ?? team?.name ?? 'A team'} completed ${c.label}`,
          occurredAt: new Date(parseStamp(c.at) ?? Date.now()),
          teamId,
          tileId,
          actorPlayerId: playerId,
        });
      } catch (err) {
        log.warn('highlights.tile-failed', { tileId, teamId }, err);
      }
    })(),
  );
}

/** The first team to clear the whole board (later clears are deduped away by the 'board' key). */
export function queueBoardHighlight(eventId: number, teamId: number, teamName: string): void {
  queueBeat({ eventId, beat: 'board', refKey: 'board', title: `${teamName} cleared the whole board`, occurredAt: new Date(), teamId });
}

export function queueStartHighlight(eventId: number, eventName: string): void {
  queueBeat({ eventId, beat: 'start', refKey: 'start', title: `${eventName} has started`, occurredAt: new Date() });
}

export function queueWinnerHighlight(eventId: number, teamId: number | null, teamName: string, eventName: string): void {
  if (!teamName) return;
  queueBeat({ eventId, beat: 'won', refKey: 'won', title: `${teamName} won ${eventName}`, occurredAt: new Date(), teamId });
}

/**
 * A head-to-head won. A challenge belongs to no event, so it is caught only while the winner is
 * playing a running STREAMED event (whose page then shows it), and only when both sides made the
 * result public — a private challenge's result is nobody else's business.
 */
export function queueH2hHighlight(c: {
  id: number;
  label: string;
  result: string | null;
  challengerAccountId: number;
  opponentAccountId: number;
  challengerPublic: boolean;
  opponentPublic: boolean;
}): void {
  if (c.result !== 'challenger' && c.result !== 'opponent') return;
  if (!c.challengerPublic || !c.opponentPublic) return;
  const accountId = c.result === 'challenger' ? c.challengerAccountId : c.opponentAccountId;
  void track(
    (async () => {
      try {
        const now = new Date().toISOString();
        // clan-scope: global -- the winner's own boards, wherever they are; each is then checked as streamed.
        const rows = await db
          .select({ eventId: events.id, teamId: eventParticipants.teamId, rsn: accounts.rsn, playerId: accounts.playerId, start: events.startDate, end: events.endDate })
          .from(eventParticipants)
          .innerJoin(events, eq(events.id, eventParticipants.eventId))
          .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
          .where(and(eq(eventParticipants.accountId, accountId), isNull(events.forceEndedAt), isNotNull(eventParticipants.teamId)));
        const live = rows.filter((r) => {
          const s = parseStamp(r.start);
          const e = parseStamp(r.end);
          return s != null && s <= Date.parse(now) && (e == null || e > Date.parse(now));
        });
        for (const r of live) {
          await recordBeat({
            eventId: r.eventId,
            beat: 'h2h',
            refKey: `h2h:${c.id}`,
            title: `${r.rsn} won the head-to-head: ${c.label}`,
            occurredAt: new Date(),
            teamId: r.teamId,
            actorPlayerId: r.playerId,
          });
        }
      } catch (err) {
        log.warn('highlights.h2h-failed', { id: c.id }, err);
      }
    })(),
  );
}

// ── VOD links ────────────────────────────────────────────────────────────────────────────────────

/** How long a clip may sit 'pending' before the sweep calls it failed (the process died mid-way). */
const STUCK_CLIP_MS = 5 * 60_000;

/**
 * The per-minute cron: find the VOD second for highlights still without one, and close clips a
 * restarted process left pending. One archive read per Twitch channel and one (cached) broadcast read
 * per YouTube space per run. Returns how many links it found.
 */
export async function resolveDueVods(now = new Date(), limit = 50): Promise<number> {
  await db
    .update(streamHighlights)
    .set({ clipStatus: 'failed', updatedAt: now })
    .where(and(eq(streamHighlights.clipStatus, 'pending'), lte(streamHighlights.createdAt, new Date(now.getTime() - STUCK_CLIP_MS))));

  const due = await db
    .select()
    .from(streamHighlights)
    .where(and(eq(streamHighlights.vodStatus, 'pending'), or(isNull(streamHighlights.vodNextAt), lte(streamHighlights.vodNextAt, now))))
    .orderBy(streamHighlights.vodNextAt)
    .limit(limit);
  if (!due.length) return 0;

  const archives = new Map<string, TwitchArchive[] | null>();
  let found = 0;
  for (const h of due) {
    let pick: { url: string } | null = null;
    if (h.platform === 'twitch') {
      if (!archives.has(h.channelId)) archives.set(h.channelId, await twitchArchives(h.channelId));
      const list = archives.get(h.channelId);
      pick = list ? pickTwitchVod(list, h.occurredAt.getTime()) : null;
    } else if (h.platform === 'youtube') {
      const list = await youtubeBroadcasts(h.clanId);
      pick = list ? pickYoutubeVod(list, h.occurredAt.getTime(), now.getTime()) : null;
    }
    if (pick) {
      found++;
      await db.update(streamHighlights).set({ vodUrl: pick.url, vodStatus: 'ready', vodNextAt: null, updatedAt: now }).where(eq(streamHighlights.id, h.id));
      continue;
    }
    const attempts = h.vodAttempts + 1;
    await db
      .update(streamHighlights)
      .set(
        attempts >= VOD_MAX_ATTEMPTS
          ? { vodAttempts: attempts, vodStatus: 'none', vodNextAt: null, updatedAt: now }
          : { vodAttempts: attempts, vodNextAt: new Date(now.getTime() + vodRetryDelayMs(attempts)), updatedAt: now },
      )
      .where(eq(streamHighlights.id, h.id));
  }
  return found;
}

async function twitchArchives(broadcasterId: string): Promise<TwitchArchive[] | null> {
  let access = await botAccess();
  if (!access) return null;
  let r = await getArchives(access.cfg, access.token, broadcasterId, botFetch());
  if (!r.ok && r.reason === 'unauthorized') {
    access = await botAccess(true);
    if (!access) return null;
    r = await getArchives(access.cfg, access.token, broadcasterId, botFetch());
  }
  return r.ok ? r.value : null;
}

// ── Reading ──────────────────────────────────────────────────────────────────────────────────────

function shown(h: typeof streamHighlights.$inferSelect): ShownHighlight {
  return {
    id: h.id,
    beat: h.beat as HighlightBeat,
    platform: h.platform as ShownHighlight['platform'],
    channelName: h.channelName,
    title: h.title,
    occurredAt: h.occurredAt.toISOString(),
    clipUrl: h.clipStatus === 'ready' ? h.clipUrl : null,
    thumbnailUrl: h.clipStatus === 'ready' ? h.thumbnailUrl : null,
    durationS: h.durationS,
    vodUrl: h.vodStatus === 'ready' ? h.vodUrl : null,
    teamId: h.teamId,
    tileId: h.tileId,
    momentId: h.momentId,
  };
}

/**
 * An event's highlights, newest first, as THIS viewer may see them. The caller has already decided the
 * event is theirs to see (canSeeEvent / the page's own gate); `canSeeTeam` is the hidden-standings
 * filter (lib/standingsVisibility canSeeTeamProgress for the viewer's scope).
 */
export async function highlightsForEvent(
  eventId: number,
  canSeeTeam: (teamId: number | null) => boolean,
  opts: { limit?: number; tileId?: number } = {},
): Promise<ShownHighlight[]> {
  const rows = await db
    .select()
    .from(streamHighlights)
    .where(
      and(
        eq(streamHighlights.eventId, eventId),
        opts.tileId != null ? eq(streamHighlights.tileId, opts.tileId) : undefined,
        or(and(eq(streamHighlights.clipStatus, 'ready'), isNotNull(streamHighlights.clipUrl)), eq(streamHighlights.vodStatus, 'ready')),
        // Taken down by platform staff from a report (lib/platformReports): never shown again.
        isNull(streamHighlights.staffHiddenAt),
      ),
    )
    .orderBy(desc(streamHighlights.occurredAt))
    .limit(Math.min(opts.limit ?? 60, 200));
  return visibleToScope(rows.map(shown).filter(showable), canSeeTeam);
}

/**
 * A creator space's (or Streaming clan's) highlights across its events, for its public page. Only
 * events `canSee` lets through, and nothing team-specific from an event whose standings are hidden
 * right now (the page has no per-viewer team to show them against).
 */
export async function highlightsForSpace(
  clanId: number,
  canSee: (eventId: number) => Promise<boolean>,
  limit = 12,
): Promise<(ShownHighlight & { eventId: number; eventName: string })[]> {
  const rows = await db
    .select({ h: streamHighlights, eventName: events.name, rules: events.rules, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
    .from(streamHighlights)
    .innerJoin(events, eq(events.id, streamHighlights.eventId))
    .where(
      and(
        eq(streamHighlights.clanId, clanId),
        eq(events.clanId, clanId),
        or(and(eq(streamHighlights.clipStatus, 'ready'), isNotNull(streamHighlights.clipUrl)), eq(streamHighlights.vodStatus, 'ready')),
        // Taken down by platform staff from a report (lib/platformReports): never shown again.
        isNull(streamHighlights.staffHiddenAt),
      ),
    )
    .orderBy(desc(streamHighlights.occurredAt))
    .limit(limit * 4);
  const verdict = new Map<number, boolean>();
  const out: (ShownHighlight & { eventId: number; eventName: string })[] = [];
  for (const r of rows) {
    const id = r.h.eventId;
    if (!verdict.has(id)) verdict.set(id, await canSee(id));
    if (!verdict.get(id)) continue;
    const hidden = standingsHidden({ rules: r.rules, endDate: r.endDate, forceEndedAt: r.forceEndedAt });
    const s = shown(r.h);
    if (!showable(s)) continue;
    if (hidden && visibleToScope([s], () => false).length === 0) continue;
    out.push({ ...s, eventId: id, eventName: r.eventName });
    if (out.length >= limit) break;
  }
  return out;
}

export interface StaffHighlight extends ShownHighlight {
  eventId: number;
  eventName: string;
  eventVisibility: string;
  clanId: number;
  clanName: string;
  clanSlug: string;
  channelOwner: string;
  clipStatus: string;
  /** The host said Anvil may feature its clips. */
  featurable: boolean;
  /** Platform staff took it down (lib/platformReports); public pages never show it. */
  staffHidden: boolean;
}

/** Platform staff: the latest highlights everywhere; `featurable` keeps only hosts who opted in. */
export async function highlightsForStaff(opts: { featurable?: boolean; limit?: number } = {}): Promise<StaffHighlight[]> {
  // clan-scope: global -- platform staff list across every clan.
  const rows = await db
    .select({ h: streamHighlights, eventName: events.name, visibility: events.visibility, clanName: clans.name, clanSlug: clans.slug, promo: clans.highlightsPromo })
    .from(streamHighlights)
    .innerJoin(events, eq(events.id, streamHighlights.eventId))
    .innerJoin(clans, eq(clans.id, streamHighlights.clanId))
    .where(
      and(
        opts.featurable ? and(eq(clans.highlightsPromo, true), eq(streamHighlights.clipStatus, 'ready'), eq(streamHighlights.channelOwner, 'host'), isNull(streamHighlights.staffHiddenAt)) : undefined,
      ),
    )
    .orderBy(desc(streamHighlights.occurredAt))
    .limit(Math.min(opts.limit ?? 100, 500));
  return rows.map((r) => ({
    ...shown(r.h),
    eventId: r.h.eventId,
    eventName: r.eventName,
    eventVisibility: r.visibility,
    clanId: r.h.clanId,
    clanName: r.clanName,
    clanSlug: r.clanSlug,
    channelOwner: r.h.channelOwner,
    clipStatus: r.h.clipStatus,
    // A player's own channel is theirs, not the host's to offer.
    featurable: r.promo && r.h.channelOwner === 'host' && !r.h.staffHiddenAt,
    staffHidden: !!r.h.staffHiddenAt,
  }));
}

/** The moment → links map the event feed shows beside each line. */
export function linksByMoment(list: ShownHighlight[]): Record<number, { clipUrl: string | null; vodUrl: string | null }> {
  const out: Record<number, { clipUrl: string | null; vodUrl: string | null }> = {};
  for (const h of list) {
    if (h.momentId == null) continue;
    const prev = out[h.momentId];
    out[h.momentId] = { clipUrl: prev?.clipUrl ?? h.clipUrl, vodUrl: prev?.vodUrl ?? h.vodUrl };
  }
  return out;
}

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────

export interface HostHighlightSettings {
  autoClip: boolean;
  promo: boolean;
}

export async function hostHighlightSettings(clanId: number): Promise<HostHighlightSettings> {
  // clan-scope: the caller's own resolved space.
  const c = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { highlightsAutoClip: true, highlightsPromo: true } });
  return { autoClip: c?.highlightsAutoClip ?? true, promo: c?.highlightsPromo ?? false };
}

export async function setHostHighlightSettings(clanId: number, patch: Partial<HostHighlightSettings>): Promise<HostHighlightSettings> {
  const set: Partial<typeof clans.$inferInsert> = {};
  if (typeof patch.autoClip === 'boolean') set.highlightsAutoClip = patch.autoClip;
  if (typeof patch.promo === 'boolean') set.highlightsPromo = patch.promo;
  // clan-scope: the caller's own resolved space.
  if (Object.keys(set).length) await db.update(clans).set(set).where(eq(clans.id, clanId));
  return hostHighlightSettings(clanId);
}

/** A player's own switch: null when they have no Twitch linked (the switch is not shown then). */
export async function playerClipSetting(userId: number): Promise<{ login: string; on: boolean } | null> {
  const link = await db.query.userTwitchLinks.findFirst({ where: eq(userTwitchLinks.userId, userId) });
  return link ? { login: link.twitchLogin, on: link.clipMyMoments } : null;
}

/** False when there is no Twitch link to hang it on. */
export async function setPlayerClipSetting(userId: number, on: boolean): Promise<boolean> {
  const done = await db
    .update(userTwitchLinks)
    .set({ clipMyMoments: on })
    .where(eq(userTwitchLinks.userId, userId))
    .returning({ userId: userTwitchLinks.userId });
  return done.length > 0;
}
