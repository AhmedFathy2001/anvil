import { NextResponse } from 'next/server';

import { requirePluginClan, resolvePluginMember } from '@/lib/auth';
import { forwardPluginNotification, pickWebhookUrl } from '@/lib/discord';
import { socialEmissionClans, clanTagsGuestEmissions, markGuestPost } from '@/lib/emissionRouting';
import { labQuarantine } from '@/lib/lab';
import { log } from '@/lib/logger';
import { classifyLine, cleanLine, modeEventEmbed, type ModeEventKind } from '@/lib/modeLines';
import { customPatterns, recordSample } from '@/lib/modeLineStore';
import { getNotificationWebhooks } from '@/lib/pluginConfig';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { markMode, routeModePost } from '@/lib/worldModes';
import { worldModeOf } from '@/lib/worldModeRequest';
import { getModeRouting, modeIconUrl, rememberSeenMode } from '@/lib/worldModeStore';

// POST /api/plugin/mode-lines — the highlighted game messages a player saw on a GAME-MODE world
// (Leagues, Deadman, …), for the site to turn into posts: "Relic unlocked: …", "Area unlocked: …".
// Capability 'mode-lines'. The plugin sends lines and nothing else; lib/modeLines decides what each
// one is, so a new league's unlocks are recognised by a site edit on launch day.
//
// Body: { lines: string[], world?: { types, activity } }. `world` is the world the lines were seen
// on, frozen in by the plugin when it batched them (a hop between the line and the send would
// otherwise label them with the next world); without it, the request's own world headers.

/** Lines read from one request. The plugin batches a few seconds of chat; more is a client gone wrong. */
const MAX_LINES = 20;
/** Posts made from one request, so one batch can't flood a channel. */
const MAX_POSTS = 5;

// The same line arrives twice when the game prints it on two channels, and again when the outbox
// retries a batch. Remembered for a minute, per person.
const recentPosts = new Map<string, number>();
const RECENT_MS = 60_000;

function seenRecently(key: string, now: number): boolean {
  const at = recentPosts.get(key);
  if (at !== undefined && now - at < RECENT_MS) return true;
  if (recentPosts.size > 5000) {
    for (const [k, t] of recentPosts) if (now - t >= RECENT_MS) recentPosts.delete(k);
  }
  recentPosts.set(key, now);
  return false;
}

export async function POST(request: Request) {
  await requirePluginClan(request);
  const member = await resolvePluginMember(request);
  if (!member) {
    // No seat anywhere: nothing to post to, and nobody to credit the queue's lines to either.
    return NextResponse.json({ ok: true, ignored: 'no-seat' }, { status: 202 });
  }

  const limit = await rateLimit(request, `plugin-mode-lines:${member.userId}`, { limit: 12, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  let body: { lines?: unknown; world?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }
  if (!Array.isArray(body.lines)) return NextResponse.json({ error: 'lines' }, { status: 400 });

  const quarantined = await labQuarantine(request, member.accountId, 'mode-lines', body);
  if (quarantined) return quarantined;

  const mode = worldModeOf(request, { world: body.world });
  if (!mode) return NextResponse.json({ ok: true, ignored: 'main-game' }, { status: 202 });

  const lines = [...new Set(body.lines.slice(0, MAX_LINES).map(cleanLine).filter((l): l is string => l !== null))];
  const patterns = await customPatterns();
  const now = Date.now();
  const events: { kind: ModeEventKind; title: string }[] = [];
  for (const line of lines) {
    const verdict = classifyLine(line, mode, patterns);
    if (verdict.kind === 'ignore') continue;
    if (verdict.kind === 'unknown') {
      await recordSample(mode, line, false);
      continue;
    }
    if (verdict.kind === 'generic') {
      // Posted as it stands, and queued so staff can give it a proper pattern.
      await recordSample(mode, line, true);
      events.push({ kind: 'modeMilestone', title: verdict.title });
    } else {
      events.push({ kind: verdict.kind, title: verdict.title });
    }
  }

  const fresh = events.filter((e) => !seenRecently(`${member.userId}:${e.title}`, now)).slice(0, MAX_POSTS);
  if (fresh.length === 0) return NextResponse.json({ ok: true, posted: 0 });

  // Routed by person, like /api/plugin/notify: the clans this account has a seat in, each by its own
  // Game modes settings. With no mode channel the post lands where an achievement would.
  const icon = await modeIconUrl(member.clanId, mode);
  let posted = 0;
  for (const ec of await socialEmissionClans(member.accountId)) {
    await rememberSeenMode(ec.clanId, mode);
    const webhooks = await getNotificationWebhooks(ec.clanId);
    const routing = await getModeRouting(ec.clanId, mode.key, pickWebhookUrl(webhooks.leagues, 'plugin:leagues'));
    const normalHook = pickWebhookUrl(webhooks.combatAchievements, 'plugin:combatAchievements');
    const asGuest = ec.kind === 'guest' && (await clanTagsGuestEmissions(ec.clanId));
    for (const e of fresh) {
      const url = routeModePost(e.kind, { ...routing, normalHook });
      if (!url) continue;
      const embed = markMode(modeEventEmbed(e.title, member.rsn), mode.label, icon);
      const post = asGuest ? markGuestPost(embed, undefined) : { embed, content: undefined };
      const ok = await forwardPluginNotification(url, { embed: post.embed ?? null, content: post.content ?? undefined, clanId: ec.clanId });
      if (ok) posted++;
      else log.warn('plugin-mode-lines.post-failed', { clanId: ec.clanId, mode: mode.key, kind: e.kind });
    }
  }
  return NextResponse.json({ ok: true, posted });
}
