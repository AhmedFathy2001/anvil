import { NextResponse } from 'next/server';

import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { parseWebhookUrls } from '@/lib/discord';
import { listBotChannels } from '@/lib/discord-broadcast';
import { getBotCredentials } from '@/lib/discord-roles';
import { findOrCreateAnvilWebhook } from '@/lib/discord-webhooks';
import { isDiscordWebhookUrl, normalizeDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { noteWebhookSave, refuseBlockedWebhooks } from '@/lib/sharedWebhooks';
import { DISCORD_FEEDS, FEED_KEYS, FEEDS_OFF_KEY, GAME_CATCH_ALL, SITE_CATCH_ALL, feedById, parseFeedsOff } from '@/lib/discordFeeds';
import { getSetting, getSettingMap, setSetting } from '@/lib/settings';
import { CREATOR_NOT_AVAILABLE, creatorHidesSettingKey, isCreatorSpace } from '@/lib/creatorSpaces';
import {
  WORLD_MODES_OFF_KEY,
  WORLD_MODES_SPLIT_KEY,
  isModeKey,
  modeDropFloorKey,
  modeDropValueKey,
  modeEventKinds,
  modeDropBothKey,
  modeFeedId,
  modeKindsOffKey,
  modeLevelsKey,
  modeKeyFromWebhookKey,
  modeWebhookKey,
  parseStringList,
  MODE_CHANNELS,
  MODE_EVENTS_CHANNEL,
  modeChannelFromKey,
  modeChannelKey,
  modeDeathTauntsKey,
  modeFunDeathsKey,
  modeKindDefaultsKey,
} from '@/lib/worldModes';
import { clanModeRows, copyMainGameIntoMode, modeKindsOff, splitIsOn } from '@/lib/worldModeStore';
import { normalizeClanKinds, parseClanKinds } from '@/lib/notifyKinds';
import { DEATH_TAUNTS_SETTING_KEY, FUN_DEATHS_SETTING_KEY, NOTIFY_KIND_DEFAULTS_SETTING_KEY } from '@/lib/pluginConfig';
import { MODE_EVENT_KINDS } from '@/lib/modeLines';
import {
  MAX_MODE_DROP_FLOOR,
  MIN_MODE_DROP_FLOOR,
  MIN_MODE_DROP_VALUE,
  parseModeDropFloor,
  parseModeDropValue,
  parseModeLevels,
  storedModeDropFloor,
  storedModeDropValue,
  storedModeDropBoth,
  storedModeLevels,
} from '@/lib/modeFilters';

/**
 * "What goes where" on Admin → Discord (lib/discordFeeds): every feed with the channel it posts to
 * today — its own, or the fallback it lands in — and whether it is switched off.
 *
 * Webhook URLs are secrets, so they never come back. Instead each set webhook is asked which
 * channel it posts into (a webhook's own URL answers that without a bot token), and the page shows
 * the channel's name.
 */

const channelCache = new Map<string, { at: number; channelId: string | null }>();
const CHANNEL_TTL_MS = 10 * 60_000;

async function webhookChannelId(url: string): Promise<string | null> {
  const hit = channelCache.get(url);
  if (hit && Date.now() - hit.at < CHANNEL_TTL_MS) return hit.channelId;
  let channelId: string | null = null;
  try {
    if (isDiscordWebhookUrl(url)) {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) channelId = ((await res.json()) as { channel_id?: string }).channel_id ?? null;
    }
  } catch {
    channelId = null;
  }
  channelCache.set(url, { at: Date.now(), channelId });
  return channelId;
}

const CATCH_ALLS = [SITE_CATCH_ALL, GAME_CATCH_ALL];

/** The in-game kinds a game mode can switch off one by one: the game tab's feeds. */
// Then the mode's own events (lib/modeLines): relics, areas, pacts, tasks…
const MODE_KINDS = [
  ...DISCORD_FEEDS.filter((f) => f.tab === 'game').map((f) => ({ id: f.id, label: f.label, event: false })),
  ...MODE_EVENT_KINDS.map((k) => ({ id: k.id, label: k.label, event: true })),
];
const MODE_KIND_IDS = new Set(MODE_KINDS.map((k) => k.id));

async function view(clanId: number) {
  const modeRows = await clanModeRows(clanId);
  const modeHookKeys = modeRows.map((m) => modeWebhookKey(m.key));
  const modeKindKeys = modeRows.flatMap((m) => [
    modeKindsOffKey(m.key),
    modeDropFloorKey(m.key),
    modeDropValueKey(m.key),
    modeDropBothKey(m.key),
    modeLevelsKey(m.key),
    modeKindDefaultsKey(m.key),
    modeFunDeathsKey(m.key),
    modeDeathTauntsKey(m.key),
  ]);
  // Each mode's own channel per kind of post: webhook settings like the main game's.
  const modeChannelKeys = modeRows.flatMap((m) => MODE_CHANNELS.map((ch) => modeChannelKey(m.key, ch)));
  const allKeys = [...FEED_KEYS, ...modeHookKeys, ...modeChannelKeys];
  const [map, channels] = await Promise.all([
    getSettingMap(clanId, [
      ...allKeys,
      ...modeKindKeys,
      FEEDS_OFF_KEY,
      'discord_cohost_posts_enabled',
      WORLD_MODES_SPLIT_KEY,
      WORLD_MODES_OFF_KEY,
      NOTIFY_KIND_DEFAULTS_SETTING_KEY,
      FUN_DEATHS_SETTING_KEY,
      DEATH_TAUNTS_SETTING_KEY,
    ]),
    listBotChannels(clanId).catch(() => ({ enabled: false, channels: [] })),
  ]);
  const keys: Record<string, { set: boolean; channelId: string | null }> = {};
  await Promise.all(
    allKeys.map(async (key) => {
      const first = parseWebhookUrls(map.get(key))[0];
      keys[key] = { set: !!first, channelId: first ? await webhookChannelId(first) : null };
    }),
  );
  const off = [...parseFeedsOff(map.get(FEEDS_OFF_KEY))];
  const cohost = map.get('discord_cohost_posts_enabled')?.trim();
  if (cohost === 'false' || cohost === '0') off.push('cohost');
  const modesOff = new Set(parseStringList(map.get(WORLD_MODES_OFF_KEY)));
  // Leagues switched off on the old row meant "keep them in the normal channels": its own channel
  // is ignored until the row is switched on again, so the page shows it that way.
  const legacyLeaguesOff = off.includes('leagues');
  return {
    modes: {
      split: splitIsOn(map.get(WORLD_MODES_SPLIT_KEY)),
      kinds: MODE_KINDS,
      rows: modeRows.map((m) => ({
        ...m,
        id: modeFeedId(m.key),
        hookKey: modeWebhookKey(m.key),
        // The mode's own event kinds only (lib/worldModes): no relics on a Hardcore world.
        events: modeEventKinds(m.key),
        off: modesOff.has(m.key),
        ownChannelIgnored: m.key === 'leagues' && legacyLeaguesOff,
        kindsOff: modeKindsOff(map.has(modeKindsOffKey(m.key)) ? map.get(modeKindsOffKey(m.key)) : undefined).filter((k) =>
          MODE_KIND_IDS.has(k),
        ),
        // Its own thresholds (lib/modeFilters); null drop halves follow the main game, null levels = none.
        dropFloor: storedModeDropFloor(map.get(modeDropFloorKey(m.key))),
        dropMinValue: storedModeDropValue(map.get(modeDropValueKey(m.key))),
        dropBoth: storedModeDropBoth(map.get(modeDropBothKey(m.key))),
        levels: storedModeLevels(map.get(modeLevelsKey(m.key))),
        // Its own channel per kind (setting keys; `keys` says which are set and where they post).
        channelKeys: Object.fromEntries(MODE_CHANNELS.map((ch) => [ch, modeChannelKey(m.key, ch)])),
        // Its own milestone kinds, screenshots, patterns and templates; null = the main game's.
        kindDefaults: map.get(modeKindDefaultsKey(m.key)) ? parseClanKinds(map.get(modeKindDefaultsKey(m.key))) : null,
        // Its own death lines (one per line); '' = the main game's.
        funDeaths: map.get(modeFunDeathsKey(m.key)) ?? '',
        deathTaunts: map.get(modeDeathTauntsKey(m.key)) ?? '',
      })),
      // What a mode follows until it has its own (and what "Copy from main game" copies).
      main: {
        kindDefaults: parseClanKinds(map.get(NOTIFY_KIND_DEFAULTS_SETTING_KEY)),
        funDeaths: map.get(FUN_DEATHS_SETTING_KEY) ?? '',
        deathTaunts: map.get(DEATH_TAUNTS_SETTING_KEY) ?? '',
      },
      channels: [
        ...DISCORD_FEEDS.filter((f) => f.tab === 'game').map((f) => ({ id: f.id, label: f.label, help: f.help, filters: f.filters ?? null })),
        { id: MODE_EVENTS_CHANNEL, label: 'Mode events', help: "Relics, areas, pacts, masteries and tasks: the mode's own unlocks.", filters: null },
      ],
    },
    feeds: DISCORD_FEEDS,
    catchAlls: { site: SITE_CATCH_ALL, game: GAME_CATCH_ALL },
    keys,
    off,
    channels,
  };
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  return NextResponse.json(await view(clan.id));
}

/**
 * One change at a time:
 *   { modesSplit: boolean }                 the Game modes master switch
 *   { mode, off: boolean }                  switch one game mode's posts on or off
 *   { mode, kindsOff: string[] }            the kinds of post a game mode drops
 *   { mode, dropFloor?, dropMinValue? }     a game mode's own drop rarity (1 in N) and/or value (gp);
 *                                           null = the main game's. Either may be given, or both.
 *   { mode, kindDefaults: ClanKinds | null } a game mode's own milestone kinds, screenshots, patterns
 *                                           and templates (null = the main game's)
 *   { mode, funDeaths?, deathTaunts? }      a game mode's own death lines ('' = the main game's)
 *   { mode, copyFromMain: true, channels? } copy the main game's in-game settings into the mode;
 *                                           its channels too only with channels: true
 *   { mode, levels: LevelRules | null }     a game mode's own level rules (null = no level-ups from it)
 *   { feed, off: boolean }                  switch a feed on or off
 *   { key, channelId }                      point a feed's (or a catch-all's) setting at a channel
 *   { key, webhookUrl }                     … or at a pasted webhook
 *   { key, clear: true }                    blank it, so it falls back again
 * `key` must be one of the page's settings.
 */
export async function PUT(request: Request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.modesSplit === 'boolean') {
    await setSetting(clan.id, WORLD_MODES_SPLIT_KEY, body.modesSplit ? 'on' : 'off');
    return NextResponse.json(await view(clan.id));
  }

  if (body.mode !== undefined) {
    const modeKey = body.mode;
    if (!isModeKey(modeKey) || !(await clanModeRows(clan.id)).some((m) => m.key === modeKey)) {
      return NextResponse.json({ error: 'Unknown game mode.' }, { status: 400 });
    }
    if (typeof body.off === 'boolean') {
      const off = new Set(parseStringList(await getSetting(clan.id, WORLD_MODES_OFF_KEY)));
      if (body.off) off.add(modeKey);
      else off.delete(modeKey);
      await setSetting(clan.id, WORLD_MODES_OFF_KEY, JSON.stringify([...off]));
      // Switching Leagues on here also clears the old row's "off", which kept its channel unused.
      if (!body.off && modeKey === 'leagues') {
        const feedsOff = parseFeedsOff(await getSetting(clan.id, FEEDS_OFF_KEY));
        if (feedsOff.delete('leagues')) await setSetting(clan.id, FEEDS_OFF_KEY, JSON.stringify([...feedsOff]));
      }
      return NextResponse.json(await view(clan.id));
    }
    if (Array.isArray(body.kindsOff)) {
      const kinds = [...new Set(body.kindsOff.filter((k): k is string => typeof k === 'string' && MODE_KIND_IDS.has(k)))];
      await setSetting(clan.id, modeKindsOffKey(modeKey), JSON.stringify(kinds));
      return NextResponse.json(await view(clan.id));
    }
    if ('dropFloor' in body || 'dropMinValue' in body) {
      // Both checked before either is written, so a bad value never leaves half a change saved.
      const floor = 'dropFloor' in body ? parseModeDropFloor(body.dropFloor) : null;
      const value = 'dropMinValue' in body ? parseModeDropValue(body.dropMinValue) : null;
      if (floor === undefined) {
        return NextResponse.json(
          { error: `Rarity: enter a whole number from ${MIN_MODE_DROP_FLOOR} to ${MAX_MODE_DROP_FLOOR.toLocaleString('en-US')}, or leave it blank.` },
          { status: 400 },
        );
      }
      if (value === undefined) {
        return NextResponse.json(
          { error: `Value: enter a whole number of gp, at least ${MIN_MODE_DROP_VALUE.toLocaleString('en-US')}, or leave it blank.` },
          { status: 400 },
        );
      }
      if ('dropFloor' in body) await setSetting(clan.id, modeDropFloorKey(modeKey), floor == null ? null : String(floor));
      if ('dropMinValue' in body) await setSetting(clan.id, modeDropValueKey(modeKey), value == null ? null : String(value));
      if ('dropBoth' in body) await setSetting(clan.id, modeDropBothKey(modeKey), body.dropBoth === true ? 'and' : null);
      return NextResponse.json(await view(clan.id));
    }
    if (body.copyFromMain === true) {
      // Channels are copied only when asked: a mode's own channels are usually the point of it.
      await copyMainGameIntoMode(clan.id, modeKey, { channels: body.channels === true });
      return NextResponse.json(await view(clan.id));
    }
    if ('kindDefaults' in body) {
      // Same normalizing as the main game's (/api/admin/notify-kinds): private kinds and bad patterns dropped.
      if (body.kindDefaults !== null && (typeof body.kindDefaults !== 'object' || Array.isArray(body.kindDefaults))) {
        return NextResponse.json({ error: 'Those settings are not valid.' }, { status: 400 });
      }
      const next = body.kindDefaults === null ? null : normalizeClanKinds(body.kindDefaults);
      await setSetting(clan.id, modeKindDefaultsKey(modeKey), next ? JSON.stringify(next) : null);
      return NextResponse.json(await view(clan.id));
    }
    if ('funDeaths' in body || 'deathTaunts' in body) {
      const lines = (v: unknown) =>
        typeof v === 'string'
          ? v
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 200)
              .map((s) => s.slice(0, 300))
              .join('\n') || null
          : null;
      if ('funDeaths' in body) await setSetting(clan.id, modeFunDeathsKey(modeKey), lines(body.funDeaths));
      if ('deathTaunts' in body) await setSetting(clan.id, modeDeathTauntsKey(modeKey), lines(body.deathTaunts));
      return NextResponse.json(await view(clan.id));
    }
    if ('levels' in body) {
      if (body.levels !== null && (typeof body.levels !== 'object' || Array.isArray(body.levels))) {
        return NextResponse.json({ error: 'Those level rules are not valid.' }, { status: 400 });
      }
      const levels = parseModeLevels(body.levels);
      await setSetting(clan.id, modeLevelsKey(modeKey), levels ? JSON.stringify(levels) : null);
      return NextResponse.json(await view(clan.id));
    }
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }

  if (typeof body.feed === 'string' && typeof body.off === 'boolean') {
    const feed = feedById(body.feed);
    if (!feed || feed.off === 'perPost') return NextResponse.json({ error: 'Unknown feed.' }, { status: 400 });
    if (feed.off === 'cohost') {
      await setSetting(clan.id, 'discord_cohost_posts_enabled', body.off ? 'false' : 'true');
    } else {
      const off = parseFeedsOff(await getSetting(clan.id, FEEDS_OFF_KEY));
      if (body.off) off.add(feed.id);
      else off.delete(feed.id);
      await setSetting(clan.id, FEEDS_OFF_KEY, JSON.stringify([...off]));
    }
    return NextResponse.json(await view(clan.id));
  }

  const key = typeof body.key === 'string' ? body.key : '';
  // A mode's own channel (`webhook_mode_<key>`) or its channel for one kind (lib/worldModes modeChannelKey).
  const modeKey = modeKeyFromWebhookKey(key) ?? modeChannelFromKey(key)?.mode ?? null;
  const allowed =
    CATCH_ALLS.includes(key) ||
    DISCORD_FEEDS.some((f) => f.key === key) ||
    (modeKey !== null && (await clanModeRows(clan.id)).some((m) => m.key === modeKey));
  if (!allowed) return NextResponse.json({ error: 'Unknown channel setting.' }, { status: 400 });

  if (body.clear === true) {
    await setSetting(clan.id, key, null);
    return NextResponse.json(await view(clan.id));
  }
  // A creator space has no weeklies, coffer, roster or co-hosts to post about (lib/creatorSpaces).
  if (isCreatorSpace(clan) && creatorHidesSettingKey(key)) {
    return NextResponse.json({ error: CREATOR_NOT_AVAILABLE }, { status: 400 });
  }

  if (typeof body.channelId === 'string' && body.channelId) {
    // Only a channel in THIS clan's server — the shared bot sits in many.
    const { enabled, channels } = await listBotChannels(clan.id).catch(() => ({ enabled: false, channels: [] }));
    if (!enabled) return NextResponse.json({ error: 'Connect your Discord bot first, or paste a webhook URL.' }, { status: 400 });
    if (!channels.some((c) => c.id === body.channelId)) return NextResponse.json({ error: 'That channel is not in your server.' }, { status: 400 });
    const creds = await getBotCredentials(clan.id);
    if (!creds) return NextResponse.json({ error: 'Connect your Discord bot first.' }, { status: 400 });
    try {
      const hook = await findOrCreateAnvilWebhook(creds.botToken, body.channelId);
      await setSetting(clan.id, key, hook.url);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
    return NextResponse.json(await view(clan.id));
  }

  // Stored normalized (lib/discordWebhookUrl); a URL that doesn't normalize cleanly is refused.
  const url = normalizeDiscordWebhookUrl(typeof body.webhookUrl === 'string' ? body.webhookUrl : '') ?? '';
  if (!url) {
    return NextResponse.json({ error: 'That is not a Discord webhook URL (https://discord.com/api/webhooks/…).' }, { status: 400 });
  }
  const blocked = await refuseBlockedWebhooks([url]);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
  await setSetting(clan.id, key, url);
  noteWebhookSave([url]);
  return NextResponse.json(await view(clan.id));
}
