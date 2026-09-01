import { NextResponse } from 'next/server';
import { requirePluginClan } from '@/lib/auth';
import { resolvePluginMember } from '@/lib/auth';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { activeScopesFor, recordMoments } from '@/lib/momentsStore';
import type { Observation } from '@/lib/moments';
import { stripGameMarkup } from '@/lib/gameText';

// Highlight ingest: the pets, uniques, big hauls, deaths and combat tasks that happen while a competition week or
// a bingo is running (lib/moments decides which of those it is — see that file for why the rules
// live here rather than in the plugin).
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

const KINDS = ['pet', 'drop', 'death', 'ca', 'level'] as const;

function str(v: unknown, max = MAX_NAME): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
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
function occurredAt(v: unknown, now: number): string {
  const parsed = typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(parsed) || parsed > now || now - parsed > MAX_AGE_MS) {
    return new Date(now).toISOString();
  }
  return new Date(parsed).toISOString();
}

export async function POST(request: Request) {
  const member = await resolvePluginMember(request);
  if (!member) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' },
      { status: 401 },
    );
  }

  // Well above real play — a busy raid night is a handful of these an hour — and low enough that a
  // looping client can't fill the table. Retryable: the plugin keeps its queue and tries later.
  const limit = await rateLimitByKey('moments', String(member.clanMemberId), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many moments' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  let body: { moments?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body?.moments)) {
    return NextResponse.json({ error: 'moments[] required' }, { status: 400 });
  }
  if (body.moments.length > MAX_OBSERVATIONS) {
    return NextResponse.json({ error: `At most ${MAX_OBSERVATIONS} moments per push` }, { status: 400 });
  }

  const now = Date.now();
  const observations: Observation[] = [];
  for (const raw of body.moments as Record<string, unknown>[]) {
    const kind = str(raw?.kind, 12);
    if (!kind || !(KINDS as readonly string[]).includes(kind)) continue;
    // Without a key we can't tell a retry from a second drop, and the same pet would pile up a row
    // per chat line. A client that doesn't send one is too old to trust with a feed.
    const dedupKey = str(raw?.key, 64);
    if (!dedupKey) continue;
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
      // Both are only ever read for kind 'ca' — the tier is a fallback for a task our own dataset
      // doesn't carry yet, which is the one thing the client knows and we don't.
      // Same '@component@' markup the notify hook strips — cleaned here too, so the highlight feed
      // shows a clean name AND lib/moments' caByName lookup (which resolves the boss/tier) matches.
      taskName: stripGameMarkup(str(raw?.taskName, 80)),
      tier: str(raw?.tier, 16),
      occurredAt: occurredAt(raw?.at, now),
      dedupKey,
    });
  }
  if (observations.length === 0) {
    return NextResponse.json({ ok: true, stored: 0, matched: 0 });
  }

  const clan = await requirePluginClan(request);
  const scopes = await activeScopesFor(member.clanMemberId, clan.id, new Date(now));
  // Nothing was running, so nothing is looking. Told apart from "kept none of them" in the reply so
  // a client's log can say which it was.
  if (scopes.weeklies.length === 0 && !scopes.event) {
    return NextResponse.json({ ok: true, stored: 0, matched: 0, scoped: false });
  }

  const result = await recordMoments(member, observations, scopes);
  return NextResponse.json({ ok: true, ...result, scoped: true });
}
