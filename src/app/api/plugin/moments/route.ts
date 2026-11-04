import { NextResponse } from 'next/server';
import { resolvePluginClan } from '@/lib/auth';
import { noClanForPlugin } from '@/lib/pluginNoClan';
import { pluginParticipantScope, resolvePluginMember } from '@/lib/auth';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { activeScopesFor, recordSeatMoments } from '@/lib/momentsStore';
import { achievementDedupKey, caTierRank, diaryTier, type Observation } from '@/lib/moments';
import { stripChatTags } from '@/lib/chatTags';
import { labQuarantine } from '@/lib/lab';
import { worldModeIgnored } from '@/lib/worldModeRequest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { accounts } from '@/db/schema';
import { emitMomentRows } from '@/lib/panelRows';
import { claimFeedItem, emitPersonalItem } from '@/lib/chatFeed';
import { feedItemFromMoment } from '@/lib/chatFeedRules';
import { resolvePluginCharacter } from '@/lib/pluginAccount';
import { settleDeathSource } from '@/lib/deathSource';

// Highlight ingest: the pets, uniques, big hauls, deaths and combat tasks that happen while a competition week or
// a bingo is running (lib/moments decides which of those it is — see that file for why the rules
// live here rather than in the plugin). A member's ACHIEVEMENTS — new log slots, diaries, quests, the
// clan's level milestones and combat-task tier — are kept for their clan whether or not anything runs.
//
// The client reports what it SAW and nothing more: it does not know which competition is running,
// what counts as a unique, or which pets belong to which skill. It sends everything it thinks might
// matter, cheaply, and most of it is discarded here.
//
// NEVER SCORING. A drop cannot be confirmed by any hiscores read, so nothing stored through this
// route awards a point, completes a tile, or moves a standing. It is the colour around the numbers.

/** A push covers one session's backlog, not a history. */
const MAX_OBSERVATIONS = 25;
const MAX_NAME = 80;
const MAX_QUANTITY = 100_000_000;
/** Loot values are GE prices; a haul beyond this is a broken client, not a lucky day. */
const MAX_VALUE_GP = 1_000_000_000_000;
const MAX_KC = 1_000_000;
/** A moment more than a day old is a replayed queue we no longer have the scopes to place. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const KINDS = ['pet', 'drop', 'death', 'ca', 'level', 'clog', 'diary', 'quest'] as const;

// Every name on this route came off a chat line, so it can still carry the game's own styling from
// a client that predates the plugin's strip (lib/chatTags). A CA task name is the one that matters:
// the feed looks the task up in our own dataset by name to find its tier and boss, and "@ach_comp@"
// on the front of it means no match, no boss, and a task that can never read as on-topic.
function str(v: unknown, max = MAX_NAME): string | null {
  if (typeof v !== 'string') return null;
  const clean = stripChatTags(v).trim();
  return clean ? clean.slice(0, max) : null;
}

/**
 * A combat-task tier, or null.
 *
 * There is no such thing as a task without one. The completion line names it, and the plugin drops
 * the line outright when the word isn't a tier it recognises — so anything arriving here with a
 * `ca` kind and an unrankable tier is a malformed request, not a task we happen to know less about.
 * Rejecting it here is what keeps that out of the rules, where every branch reading a null tier
 * would be describing a case the game cannot produce.
 */
function caTier(v: unknown): string | null {
  const name = str(v, 16);
  return name && caTierRank(name) >= 0 ? name : null;
}

function int(v: unknown, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return null;
  return Math.floor(v);
}

/**
 * Clamp a client timestamp into something the feed can order by.
 *
 * The client's clock is its own. A moment claiming to be from next week would pin itself to the top
 * of every feed forever, and one claiming to be from last year would sink out of a competition it
 * genuinely happened during — so anything outside the window becomes "now", which is when we
 * actually learned about it.
 */
/** How old a report may be and still go to other players' chat. */
const FEED_MAX_AGE_MS = 10 * 60_000;

function occurredAt(v: unknown, now: number): string {
  const parsed = typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(parsed) || parsed > now || now - parsed > MAX_AGE_MS) {
    return new Date(now).toISOString();
  }
  return new Date(parsed).toISOString();
}

/** A character this token owns outright, with no seat: heard for the chat feed only. */
async function seatlessCharacter(request: Request): Promise<{ userId: number; accountId: number; rsn: string } | null> {
  const who = await resolvePluginCharacter(request);
  if (!who) return null;
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, who.accountId), columns: { rsn: true } });
  return account ? { ...who, rsn: account.rsn } : null;
}

async function feedFrom(character: { userId: number; accountId: number; rsn: string }, raws: unknown[]): Promise<void> {
  const now = Date.now();
  for (const raw of raws) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const key = str(r.key, 64);
    const item = feedItemFromMoment(r, character.rsn);
    if (!key || !item) continue;
    // Other people's chat is live: a replayed or long-queued report is not news, so it is not relayed.
    const at = typeof r.at === 'string' ? Date.parse(r.at) : NaN;
    if (!Number.isFinite(at) || at > now + 60_000 || now - at > FEED_MAX_AGE_MS) continue;
    if (!(await claimFeedItem(character.accountId, `${item.kind}:${key}`))) continue;
    // What one character may put in other people's chat, whatever it claims to have done. Real play is
    // a handful an hour; this only stops a modified client flooding everyone it can reach.
    const cap = await rateLimitByKey('chatfeed', String(character.accountId), { limit: 12, windowMs: 10 * 60_000 });
    if (!cap.ok) return;
    await emitPersonalItem(character, item);
  }
}

export async function POST(request: Request) {
  // Kills, drops, XP and logs from a game-mode world (Leagues, Deadman, hardcore, …) are another
  // save's progress, never this one's (lib/worldModeRequest).
  const otherSave = worldModeIgnored(request);
  if (otherSave) return otherSave;
  const member = await resolvePluginMember(request);
  // A character with no seat anywhere still has a chat-feed audience (a clan it guests in), so it is
  // heard for the feed; nothing is stored for it.
  const character = member
    ? { userId: member.userId, accountId: member.accountId, rsn: member.rsn }
    : await seatlessCharacter(request);
  if (!character) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' },
      { status: 401 },
    );
  }

  // Well above real play — a busy raid night is a handful of these an hour — and low enough that a
  // looping client can't fill the table. Retryable: the plugin keeps its queue and tries later.
  const limit = await rateLimitByKey('moments', member ? String(member.clanMemberId) : `account:${character.accountId}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many moments' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  let body: { moments?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  // A character in a tile-lab session: the push is logged to the session, whose Feed reads it from
  // there (lib/labFeed). A replayed scenario stops here; real play goes on as usual (lib/lab).
  const quarantined = await labQuarantine(request, character.accountId, 'moments', body);
  if (quarantined) return quarantined;
  if (!Array.isArray(body?.moments)) {
    return NextResponse.json({ error: 'moments[] required' }, { status: 400 });
  }
  if (body.moments.length > MAX_OBSERVATIONS) {
    return NextResponse.json({ error: `At most ${MAX_OBSERVATIONS} moments per push` }, { status: 400 });
  }
  // A killer the plugin only inferred from the fight is kept when it's a boss, else dropped (lib/deathSource).
  for (const raw of body.moments) if (raw && typeof raw === 'object') settleDeathSource(raw as Record<string, unknown>);

  // Other players' in-game chat reads every report first (lib/chatFeed) — the board, the clan and the
  // competition rules below decide only what is STORED. Off the request's path: nobody waits on it.
  void feedFrom(character, body.moments as unknown[]);
  if (!member) return NextResponse.json({ ok: true, stored: 0, matched: 0, scoped: false });

  const now = Date.now();
  const observations: Observation[] = [];
  for (const raw of body.moments as Record<string, unknown>[]) {
    const kind = str(raw?.kind, 12);
    if (!kind || !(KINDS as readonly string[]).includes(kind)) continue;
    // Without a key we can't tell a retry from a second drop, and the same pet would pile up a row
    // per chat line. A client that doesn't send one is too old to trust with a feed.
    const clientKey = str(raw?.key, 64);
    if (!clientKey) continue;
    // A combat task is a name AND a tier; without both there is nothing to judge it by and nothing
    // worth a feed line. The plugin always sends both, so this only ever catches a hand-rolled call.
    if (kind === 'ca' && (!str(raw?.taskName, 80) || !caTier(raw?.tier))) continue;
    // A log slot or quest is its name; a diary its area and tier. Nothing to show without them.
    if ((kind === 'clog' || kind === 'quest') && !str(raw?.itemName)) continue;
    if (kind === 'diary' && (!str(raw?.itemName) || !diaryTier(str(raw?.tier, 16)))) continue;
    // One achievement, one key, whatever the client called it (lib/moments achievementDedupKey).
    const dedupKey =
      achievementDedupKey(kind, { itemName: str(raw?.itemName), taskName: str(raw?.taskName, 80), tier: str(raw?.tier, 16) }) ?? clientKey;
    observations.push({
      kind: kind as Observation['kind'],
      itemId: int(raw?.itemId, 100_000_000),
      itemName: str(raw?.itemName),
      quantity: int(raw?.quantity, MAX_QUANTITY) ?? 1,
      valueGp: int(raw?.valueGp, MAX_VALUE_GP),
      source: str(raw?.source),
      sourceKind: str(raw?.sourceKind, 16),
      kc: int(raw?.kc, MAX_KC),
      // Combat tasks: the task as the completion line named it, and the tier that line claimed.
      // Both are only ever read for kind 'ca' — the tier is the fallback for a task our own dataset
      // doesn't carry yet, which is the one thing the client knows and we don't.
      // Same markup the notify hook strips — cleaned here too, so the highlight feed shows a clean
      // name AND lib/moments' caByName lookup (which resolves the boss/tier) matches.
      taskName: stripChatTags(str(raw?.taskName, 80)),
      tier: kind === 'diary' ? diaryTier(str(raw?.tier, 16)) : caTier(raw?.tier),
      occurredAt: occurredAt(raw?.at, now),
      dedupKey,
    });
  }
  if (observations.length === 0) {
    return NextResponse.json({ ok: true, stored: 0, matched: 0 });
  }

  // See lib/pluginNoClan: a moment with no clan to tell has nobody to tell.
  const clan = await resolvePluginClan(request);
  if (!clan) return noClanForPlugin();
  // Lab boards left out: one would win the pick and stamp a real moment with the lab board, in the real
  // clan's feed. The lab board's Feed reads its moments from the lab log instead (lib/lab).
  const scopes = await activeScopesFor(member.clanMemberId, clan.id, new Date(now), await pluginParticipantScope(member, { lab: false }));
  // Nothing running still keeps the clan's achievements (momentsStore recordSeatMoments); `scoped:
  // false` tells a client's log that was the case.
  const { inserted, seatKind, idle, ...result } = await recordSeatMoments(member, observations, scopes);
  // The panel's live Feed lists (lib/panelRows). Not awaited past a failure: the reply is the plugin's.
  if (inserted.length) await emitMomentRows(clan.id, seatKind, inserted);
  return NextResponse.json({ ok: true, ...result, scoped: !idle });
}
