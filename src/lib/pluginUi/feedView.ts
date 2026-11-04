import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, completions, eventParticipants, events, teams, tiles, users } from '@/db/schema';
import { boardHidden, boardSize, completionAt, completionFinisher } from '@/lib/panelRows';
import { pluginRsnHintOnly, resolvePluginClan, verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { chatAccess, chatHistory, deleteChat, muteChat, pauseChat, sendChat, type ChatAccess } from '@/lib/eventChat';
import { formatGp } from '@/lib/itemPrices';
import { NO_REACTIONS, isClanMember, reactionSummaries } from '@/lib/momentReactions';
import { eventFeedFloor, isClanWorthy, panelFeedWorthy } from '@/lib/moments';
import { boardTileItemIds, clanScopeFor, momentsForClan, momentsForEvent, type MomentRow } from '@/lib/momentsStore';
import { homeBoardForUser } from '@/lib/pluginHomeBoard';
import { rateLimit } from '@/lib/rate-limit';
import { standingsHidden } from '@/lib/standingsVisibility';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';

import { visibleClan } from './load';
import { completionRow, feedTabUi, kindGroup, momentRow, type KindGroup, type Scope } from './feedUi';
import type { Action, FeedRow, View } from './nodes';
import { gap, message, text } from './nodes';

// The Feed tab's data (view 'feed') and the event chat's actions. The look is lib/pluginUi/feedUi.

type Args = Record<string, string>;

const OK: View = { ui: gap(0) };
const err = (s: string): View => ({ ui: text(s, 'error', { wrap: true }) });

/** The scopes this viewer can switch between: their clan, and the board they're playing on. */
async function scopesFor(request: Request, userId: number | null): Promise<Scope[]> {
  const resolved = await resolvePluginClan(request);
  // The same visibility check every other clan view makes (load.visibleClan), not just the token's say-so.
  const clan = resolved ? await visibleClan(request, resolved.slug) : null;
  const out: Scope[] = [];
  if (clan) out.push({ kind: 'clan', id: clan.id, slug: clan.slug, name: clan.name });
  const seat = clan ? await verifyPluginToken(request, { hintOnly: pluginRsnHintOnly(request) }).catch(() => null) : null;
  let eventId = seat?.eventId ?? null;
  if (eventId == null && clan && userId != null) eventId = (await homeBoardForUser(clan.id, userId).catch(() => null))?.eventId ?? null;
  if (eventId != null) {
    // clan-scope: this clan -- by id; the board came from the viewer's own seat or home board
    const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { id: true, name: true } });
    if (ev) out.push({ kind: 'event', id: ev.id, name: ev.name });
  }
  if (userId != null) await addEverythingElse(request, out, userId);
  return out;
}

/**
 * Every other clan the viewer is a member of, and every live board one of their characters is on,
 * after the clan and board the plugin is pointed at: someone in two clans, or on two boards at once,
 * can read (and chat in) any of them from the one dropdown. Each clan, and each board's clan, goes
 * through the same visibility gate as the plugin's own clan (load.visibleClan): a suspended or hidden
 * clan, or a board in one, never shows up here.
 */
async function addEverythingElse(request: Request, out: Scope[], userId: number): Promise<void> {
  const has = (k: 'clan' | 'event', id: number) => out.some((s) => s.kind === k && s.id === id);
  // clan-scope: global -- the subject is the viewer's own person; their seats span clans by design.
  const mine = await db
    .select({ accountId: accounts.id })
    .from(users)
    .innerJoin(accounts, eq(accounts.playerId, users.playerId))
    .where(eq(users.id, userId));
  const accountIds = mine.map((m) => m.accountId);
  if (!accountIds.length) return;
  // clan-scope: global -- the clans this viewer's own characters are members of.
  const clanRowsMine = await db
    .selectDistinct({ id: clans.id, slug: clans.slug, name: clans.name })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(and(inArray(clanMemberships.accountId, accountIds), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
  const seen = new Map<string, boolean>();
  const visible = async (slug: string) => {
    if (!seen.has(slug)) seen.set(slug, !!(await visibleClan(request, slug).catch(() => null)));
    return seen.get(slug)!;
  };
  for (const c of clanRowsMine) {
    if (!has('clan', c.id) && (await visible(c.slug))) out.push({ kind: 'clan', id: c.id, slug: c.slug, name: c.name });
  }
  // clan-scope: global -- the boards this viewer's own characters are seated on, in any clan.
  const boards = await db
    .selectDistinct({ id: events.id, name: events.name, startDate: events.startDate, endDate: events.endDate, forceEndedAt: events.forceEndedAt, clanSlug: clans.slug })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .innerJoin(clans, eq(clans.id, events.clanId))
    .where(inArray(eventParticipants.accountId, accountIds));
  const now = Date.now();
  const at = (s: string | null) => (s ? Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`) : NaN);
  for (const b of boards) {
    const live = !b.forceEndedAt && !(at(b.startDate) > now) && !(at(b.endDate) <= now);
    if (live && !has('event', b.id) && (await visible(b.clanSlug))) out.push({ kind: 'event', id: b.id, name: b.name });
  }
}

function pick(scopes: Scope[], key: string | undefined): Scope | null {
  if (key) {
    const [kind, ref] = key.split(':');
    const hit = scopes.find((s) => (kind === 'clan' && s.kind === 'clan' && s.slug === ref) || (kind === 'event' && s.kind === 'event' && String(s.id) === ref));
    if (hit) return hit;
  }
  // A board you're on is the livelier place to land; else the clan.
  return scopes.find((s) => s.kind === 'event') ?? scopes[0] ?? null;
}

// 'tasks' is the old name of 'achievements', for a panel still holding a chip from before.
const groupOf = (f: string): KindGroup | null =>
  f === 'drops' || f === 'pets' || f === 'achievements' || f === 'deaths' ? f : f === 'tasks' ? 'achievements' : null;

async function clanRows(clan: Extract<Scope, { kind: 'clan' }>, filter: string, viewer: number | null): Promise<{ rows: FeedRow[]; floor: number }> {
  const scope = await clanScopeFor(clan.id);
  const g = groupOf(filter);
  const raw = (await momentsForClan(clan.id, 120))
    .filter((m) => panelFeedWorthy(m, scope.minLootGp) && isClanWorthy(m, scope))
    .filter((m) => !g || kindGroup(m.kind) === g);
  // Drops filed on a board with hidden standings stay out of the clan's feed (the board's own feed
  // shows each team its own). Checked fresh per board.
  const boards = [...new Set(raw.map((m) => m.eventId).filter((e): e is number => e != null))];
  const hidden = new Set<number>();
  for (const e of boards) if (await boardHidden(e)) hidden.add(e);
  const list = raw.filter((m) => m.eventId == null || !hidden.has(m.eventId)).slice(0, 80);
  const [summaries, member] = await Promise.all([
    reactionSummaries(list.map((m) => m.id), viewer),
    viewer != null ? isClanMember(viewer, clan.id) : Promise.resolve(false),
  ]);
  const rows = list.map((m) => {
    const s = summaries.get(m.id) ?? NO_REACTIONS;
    const react: Action | undefined = member ? { a: 'post', act: 'react-row', args: { slug: clan.slug, id: String(m.id), kind: 'gz' } } : undefined;
    return momentRow(asLike(m), { gz: { n: s.gz, mine: s.mineGz }, react });
  });
  return { rows, floor: scope.minLootGp };
}

function asLike(m: MomentRow) {
  return {
    id: m.id,
    rsn: m.rsn,
    kind: m.kind,
    itemId: m.itemId,
    itemName: m.itemName,
    quantity: m.quantity,
    valueGp: m.valueGp,
    source: m.source,
    teamId: m.teamId,
    occurredAt: m.occurredAt,
    tier: m.tier,
    sourceKind: m.sourceKind,
  };
}

async function eventRows(eventId: number, filter: string, teamId: number | null): Promise<{ rows: FeedRow[]; floor: number }> {
  const floor = eventFeedFloor(await boardSize(eventId));
  // clan-scope: this clan -- by id; the viewer reached this board through their own seat or home board
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  const hidden = ev ? standingsHidden(ev) : false;
  const g = groupOf(filter);
  const own = (t: number | null) => teamId != null && t === teamId;
  const tileItems = await boardTileItemIds(eventId);
  // Behind the curtain each team sees only its own.
  const visible = (t: number | null) => (filter === 'team' || hidden ? own(t) : true);
  const momentRows =
    filter === 'tiles'
      ? []
      : (await momentsForEvent(eventId, 600))
          // Under the floor still shows when it's an item one of the board's tiles wants.
          .filter((m) => panelFeedWorthy(m, floor) || (m.itemId != null && tileItems.has(m.itemId)))
          .filter((m) => !g || kindGroup(m.kind) === g)
          .filter((m) => visible(m.teamId))
          .slice(0, 80)
          .map((m) => ({ at: Date.parse(m.occurredAt), row: momentRow(asLike(m), { mine: own(m.teamId) }) }));
  // Finished tiles: in All, Tiles and My team (a drop filter is about drops).
  const tileRows =
    g != null
      ? []
      : (await boardCompletions(eventId))
          .filter((c) => visible(c.teamId))
          .map((c) => {
            const at = completionAt(c.at);
            return {
              at: Date.parse(at),
              row: completionRow({ tileId: c.tileId, teamId: c.teamId, label: c.label, who: c.who, team: { name: c.teamName, color: c.teamColor }, at, mine: own(c.teamId) }),
            };
          });
  const rows = [...momentRows, ...tileRows].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 80).map((r) => r.row);
  return { rows, floor };
}

/** A board's finished tiles, newest first (combo parts aren't board cells). */
export async function boardCompletions(eventId: number) {
  // clan-scope: this clan -- by the board id the caller already resolved for this viewer
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { tilesRevealed: true, rules: true } });
  // A tile members can't see yet (unrevealed board, scheduled reveal, unannounced mission) isn't named.
  if (!ev?.tilesRevealed) return [];
  const rules = parseEventRules(ev.rules);
  const rows = await db
    .select({
      revealedAt: tiles.revealedAt,
      mission: tiles.mission,
      tileId: completions.tileId,
      teamId: completions.teamId,
      at: completions.completedAt,
      label: tiles.label,
      teamName: teams.name,
      teamColor: teams.color,
      who: completionFinisher,
    })
    .from(completions)
    .innerJoin(tiles, eq(tiles.id, completions.tileId))
    .innerJoin(teams, eq(teams.id, completions.teamId))
    .where(and(eq(tiles.eventId, eventId), isNull(tiles.parentTileId)))
    .orderBy(desc(completions.completedAt))
    .limit(120);
  return rows.filter((t) => isTileRevealed(rules, t)).slice(0, 80);
}

export async function feedView(request: Request, a: Args): Promise<View> {
  const viewer = await verifyPluginTokenUser(request);
  const scopes = await scopesFor(request, viewer?.userId ?? null);
  const current = pick(scopes, a.s);
  if (!current) return message('Sign in with the plugin and join a clan to see its feed.');

  const access: ChatAccess | null = current.kind === 'event' && viewer ? await chatAccess(current.id, viewer.userId) : null;
  const chatAvailable = !!access && access.member && access.open;
  const pane = a.p === 'chat' && chatAvailable ? 'chat' : 'feed';
  const filter = a.f || 'all';
  const teamId = access?.teamId ?? null;

  if (pane === 'chat' && access && viewer) {
    const f = filter === 'team' ? 'team' : filter === 'mods' && access.staff ? 'mods' : 'all';
    const rows = await chatHistory(access, viewer.userId, f);
    return {
      ui: feedTabUi({
        scopes,
        current,
        pane,
        chatAvailable,
        filter: f,
        teamId,
        rows,
        send: { act: 'chat-send', args: { e: String(current.id), to: f === 'team' ? 'team' : 'all' }, hint: f === 'team' ? 'Message your team' : 'Message the event' },
        locked: access.paused && !access.staff ? 'The host has paused chat.' : null,
        staff: access.staff,
        paused: access.paused,
      }),
    };
  }

  const { rows, floor } = current.kind === 'clan' ? await clanRows(current, filter, viewer?.userId ?? null) : await eventRows(current.id, filter, teamId);
  return {
    ui: feedTabUi({
      scopes,
      current,
      pane,
      chatAvailable,
      filter,
      teamId,
      rows,
      floorNote: `Drops ≥ ${formatGp(floor)} · pets · achievements`,
    }),
  };
}

// ── Actions (no redraw: the plugin reads an error line, or nothing) ─────────────────────────────

async function accessFor(request: Request, a: Args): Promise<{ access: ChatAccess; userId: number } | View> {
  const viewer = await verifyPluginTokenUser(request);
  const e = Number(a.e);
  if (!viewer || !Number.isInteger(e) || e <= 0) return err('Sign in with the plugin first.');
  const access = await chatAccess(e, viewer.userId);
  if (!access || !access.member) return err('Only this event’s players can use its chat.');
  return { access, userId: viewer.userId };
}

export async function chatAct(request: Request, act: string, a: Args, fields: Args): Promise<View | null> {
  if (!['chat-send', 'chat-del', 'chat-mute', 'chat-pause'].includes(act)) return null;
  const got = await accessFor(request, a);
  if ('ui' in got) return got;
  const { access, userId } = got;
  const rl = await rateLimit(request, `event-chat:${userId}`, { limit: 40, windowMs: 60_000 });
  if (!rl.ok) return err('Slow down a little.');
  const id = Number(a.id);
  const r =
    act === 'chat-send'
      ? await sendChat(access, userId, fields.msg ?? '', a.to === 'team')
      : act === 'chat-del'
        ? await deleteChat(access, userId, id)
        : act === 'chat-mute'
          ? await muteChat(access, userId, id)
          : await pauseChat(access, a.on === '1');
  if (!r.ok) return err(r.error);
  // Pausing redraws the tab so the switch flips; everything else changes nothing on the sender's screen.
  if (act === 'chat-pause') return feedView(request, { s: a.s ?? `event:${access.eventId}`, p: 'chat' });
  return OK;
}
