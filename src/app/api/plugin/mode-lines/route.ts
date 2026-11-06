import { NextResponse } from 'next/server';
import { foreignOr } from '@/lib/pluginForeign';

import { requirePluginClan, resolvePluginMember } from '@/lib/auth';
import { forwardPluginNotification, pickWebhookUrl } from '@/lib/discord';
import { socialEmissionClans, clanTagsGuestEmissions, markGuestPost } from '@/lib/emissionRouting';
import { emitPersonalItem } from '@/lib/chatFeed';
import { labQuarantine } from '@/lib/lab';
import { log } from '@/lib/logger';
import { classifyLine, cleanLine, modeEventEmbed, type ModeEventKind } from '@/lib/modeLines';
import { customPatterns, recordSample } from '@/lib/modeLineStore';
import { getNotificationWebhooks } from '@/lib/pluginConfig';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { markMode, routeModePost } from '@/lib/worldModes';
import { worldModeOf } from '@/lib/worldModeRequest';
import { getModeFilters, getModeRouting, modeIconUrl, rememberSeenMode } from '@/lib/worldModeStore';
import { levelPostMatches } from '@/lib/levelRules';
import { getMemberLevelPrefs } from '@/lib/levelRulesStore';
import { modeLevelRules, pluginPostsModeLevels } from '@/lib/modeFilters';
import { pluginVersionHeader } from '@/lib/pluginSeen';
import { recordModeLineMoments } from '@/lib/momentsStore';
import { emitMomentRows } from '@/lib/panelRows';
import { apexOrigin } from '@/lib/seo';
import { supporterForUsers, withSupporterAuthor } from '@/lib/supporter';
import { boostedClanIdsForAccount, withBoosterAuthor } from '@/lib/clanBoosts';

// POST /api/plugin/mode-lines — the highlighted game messages a player saw on a GAME-MODE world
// (Leagues, Deadman, …), for the site to turn into posts: "Relic unlocked: …", "Area unlocked: …".
// Capability 'mode-lines'. The plugin sends the lines plus, when 'mode-line-screenshots' is also
// advertised, one frame for the whole batch; lib/modeLines decides what each line is, so a new
// league's unlocks are recognised by a site edit on launch day.
//
// JSON or multipart payload_json: { lines: string[], world?: { types, activity } }.
// `world` is the world the lines were seen
// on, frozen in by the plugin when it batched them (a hop between the line and the send would
// otherwise label them with the next world); without it, the request's own world headers.

/** Lines read from one request. The plugin batches a few seconds of chat; more is a client gone wrong. */
const MAX_LINES = 20;
/** Posts made from one request, so one batch can't flood a channel. */
const MAX_POSTS = 5;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
    // Somebody else's character is refused outright, so the plugin can say why (lib/pluginForeign).
    return foreignOr(request, NextResponse.json({ ok: true, ignored: 'no-seat' }, { status: 202 }));
  }

  const limit = await rateLimit(request, `plugin-mode-lines:${member.userId}`, { limit: 12, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  let body: { lines?: unknown; world?: unknown };
  let image: { bytes: ArrayBuffer; filename: string } | null = null;
  try {
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await request.formData();
      const raw = form.get('payload_json');
      if (typeof raw !== 'string') throw new Error('payload_json');
      body = JSON.parse(raw) as typeof body;
      const file = form.get('file');
      if (file instanceof File) {
        if (file.size > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: 'Image too large' }, { status: 413 });
        }
        image = { bytes: await file.arrayBuffer(), filename: file.name || 'anvil-mode.png' };
      }
    } else {
      body = (await request.json()) as typeof body;
    }
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }
  if (!Array.isArray(body.lines)) return NextResponse.json({ error: 'lines' }, { status: 400 });

  // A tile-lab session logs this push (lib/lab). A replayed scenario stops there; real play goes on as usual.
  const quarantined = await labQuarantine(request, member.accountId, 'mode-lines', {
    ...body,
    image: image?.filename ?? null,
  });
  if (quarantined) return quarantined;

  const mode = worldModeOf(request, { world: body.world });
  if (!mode) return NextResponse.json({ ok: true, ignored: 'main-game' }, { status: 202 });

  const lines = [...new Set(body.lines.slice(0, MAX_LINES).map(cleanLine).filter((l): l is string => l !== null))];
  const patterns = await customPatterns();
  const now = Date.now();
  const events: { kind: ModeEventKind; title: string }[] = [];
  // The game's own level-ups and quests (a separate save's, so the plugin sends them only as lines).
  // Posted as levels and quests, each clan's level rules deciding which level-ups (lib/modeLines).
  const levelUps: { skill: string; level: number }[] = [];
  // A plugin that posts mode level-ups itself (lib/modeFilters) would announce each one twice.
  const lineLevels = !pluginPostsModeLevels(pluginVersionHeader(request));
  const quests: string[] = [];
  for (const line of lines) {
    const verdict = classifyLine(line, mode, patterns);
    if (verdict.kind === 'ignore') continue;
    if (verdict.kind === 'level') {
      if (lineLevels && !seenRecently(`${member.userId}:lv:${verdict.skill}:${verdict.level}`, now)) levelUps.push(verdict);
      continue;
    }
    if (verdict.kind === 'quest') {
      if (!seenRecently(`${member.userId}:q:${verdict.name}`, now)) quests.push(verdict.name);
      continue;
    }
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
  if (fresh.length === 0 && levelUps.length === 0 && quests.length === 0) return NextResponse.json({ ok: true, posted: 0 });
  const levelPrefs = levelUps.length ? await getMemberLevelPrefs(member.userId) : null;

  // The compact Modes timeline keeps only meaningful unlocks and the level-ups this clan chose.
  // Easy/medium task churn remains Discord-only when explicitly enabled and never clutters Feed.
  const feedRules = levelPrefs
    ? modeLevelRules((await getModeFilters(member.clanId, mode.key)).levels, levelPrefs.clanChoice)
    : null;
  const feedLevels = feedRules
    ? levelUps.filter((lv) => levelPostMatches({ type: 'skill', level: lv.level }, feedRules))
    : [];
  const stored = await recordModeLineMoments(member, mode, [
    ...fresh.filter((e) => e.kind !== 'modeTaskMinor').map((e) => ({ kind: 'mode' as const, title: e.title, sourceKind: e.kind })),
    ...feedLevels.map((lv) => ({ kind: 'level' as const, title: `Reached level ${lv.level} ${lv.skill}`, itemName: lv.skill, quantity: lv.level, sourceKind: 'skill' })),
    ...quests.map((q) => ({ kind: 'quest' as const, title: `Quest complete: ${q}`, itemName: q })),
  ]);
  if (stored.length) await emitMomentRows(member.clanId, 'member', stored);

  // Other players' in-game chat (lib/chatFeed), the minor tasks aside — a league has hundreds.
  for (const e of fresh) {
    if (e.kind === 'modeTaskMinor') continue;
    void emitPersonalItem(
      { accountId: member.accountId, userId: member.userId },
      { kind: 'mode', who: member.rsn, text: `(${mode.label}) ${e.title}` },
    );
  }

  // Routed by person, like /api/plugin/notify: the clans this account has a seat in, each by its own
  // Game modes settings. With no mode channel the post lands where an achievement would.
  const icon = await modeIconUrl(member.clanId, mode);
  // Flair follows the person, not whichever login happened to mint the plugin token. A booster gem
  // replaces the Supporter star only in the clan this character boosts; all other clans keep the star.
  const supporter = (await supporterForUsers([member.userId]).catch(() => new Map())).get(member.userId) ?? null;
  const boosted = await boostedClanIdsForAccount(member.accountId).catch(() => new Set<number>());
  const decorate = (embed: Record<string, unknown>, clanId: number) => {
    const flaired = boosted.has(clanId)
      ? withBoosterAuthor(embed, apexOrigin())
      : withSupporterAuthor(embed, supporter?.tier.id ?? null, apexOrigin(), supporter?.style ?? null);
    return image ? { ...flaired, image: { url: `attachment://${image.filename}` } } : flaired;
  };
  let posted = 0;
  for (const ec of await socialEmissionClans(member.accountId)) {
    await rememberSeenMode(ec.clanId, mode);
    const webhooks = await getNotificationWebhooks(ec.clanId);
    const routing = await getModeRouting(ec.clanId, mode.key, pickWebhookUrl(webhooks.leagues, 'plugin:leagues'));
    const normalHook = pickWebhookUrl(webhooks.combatAchievements, 'plugin:combatAchievements');
    const asGuest = ec.kind === 'guest' && (await clanTagsGuestEmissions(ec.clanId));
    const send = async (url: string | null, title: string, kind: string) => {
      if (!url) return;
      const embed = decorate(markMode(modeEventEmbed(title, member.rsn), mode.label, icon)!, ec.clanId);
      const post = asGuest ? markGuestPost(embed, undefined) : { embed, content: undefined };
      const ok = await forwardPluginNotification(url, {
        embed: post.embed ?? null,
        content: post.content ?? undefined,
        attachment: image,
        clanId: ec.clanId,
      });
      if (ok) posted++;
      else log.warn('plugin-mode-lines.post-failed', { clanId: ec.clanId, mode: mode.key, kind });
    };
    if (levelUps.length && levelPrefs) {
      // The mode's own level rules (Admin → Discord → Game modes) after the member's own choice —
      // the same rule /api/plugin/notify applies. No rules = no level-ups from the mode.
      const rules = modeLevelRules((await getModeFilters(ec.clanId, mode.key)).levels, levelPrefs.clanChoice);
      const url = routeModePost('levels', { ...routing, normalHook: pickWebhookUrl(webhooks.levels, 'plugin:levels') });
      for (const lv of levelUps.slice(0, MAX_POSTS)) {
        if (levelPostMatches({ type: 'skill', level: lv.level }, rules)) await send(url, `Reached level ${lv.level} ${lv.skill}`, 'level');
      }
    }
    if (quests.length) {
      const url = routeModePost('quests', { ...routing, normalHook: pickWebhookUrl(webhooks.quests, 'plugin:quests') });
      for (const q of quests.slice(0, MAX_POSTS)) await send(url, `Quest complete: ${q}`, 'quest');
    }
    for (const e of fresh) {
      const url = routeModePost(e.kind, { ...routing, normalHook });
      if (!url) continue;
      const embed = decorate(markMode(modeEventEmbed(e.title, member.rsn), mode.label, icon)!, ec.clanId);
      const post = asGuest ? markGuestPost(embed, undefined) : { embed, content: undefined };
      const ok = await forwardPluginNotification(url, {
        embed: post.embed ?? null,
        content: post.content ?? undefined,
        attachment: image,
        clanId: ec.clanId,
      });
      if (ok) posted++;
      else log.warn('plugin-mode-lines.post-failed', { clanId: ec.clanId, mode: mode.key, kind: e.kind });
    }
  }
  return NextResponse.json({ ok: true, posted });
}
