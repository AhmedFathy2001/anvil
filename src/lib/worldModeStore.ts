import { pickWebhookUrl } from '@/lib/discord';
import { absoluteAssetUrl } from '@/lib/seo';
import { proxyWikiUrl } from '@/lib/assetUrls';
import { leaguesIconUrl } from '@/lib/leagues';
import { log } from '@/lib/logger';
import { DEFAULT_MODE_KINDS_OFF, MODE_EVENT_KIND_IDS } from '@/lib/modeLines';
import { getSetting, getSettingMap, setSetting } from '@/lib/settings';
import { parseClanKinds, type ClanKinds } from '@/lib/notifyKinds';
import { FEED_KEYS, FEEDS_OFF_KEY, effectiveKey, feedById, parseFeedsOff } from '@/lib/discordFeeds';
import { levelHalf } from '@/lib/levelRules';
import {
  DEATH_TAUNTS_SETTING_KEY,
  FUN_DEATHS_SETTING_KEY,
  NOTIFY_KIND_DEFAULTS_SETTING_KEY,
  getClanDropDefaults,
  getClanKindDefaults,
  getDeathTaunts,
  getFunDeathMessages,
  getNotificationWebhooks,
} from '@/lib/pluginConfig';
import {
  modeDropsFromMain,
  mergeModeThresholds,
  modeLevelRules,
  storedModeDropFloor,
  storedModeDropValue,
  storedModeDropBoth,
  storedModeLevels,
  type ModeFilters,
  type PluginModeThresholds,
} from '@/lib/modeFilters';
import { socialEmissionClans } from '@/lib/emissionRouting';
import { getClanMilestoneRules, getMemberLevelPrefs } from '@/lib/levelRulesStore';
import { worldModeOf } from '@/lib/worldModeRequest';
import {
  WORLD_MODES,
  WORLD_MODES_OFF_KEY,
  WORLD_MODES_SEEN_KEY,
  WORLD_MODES_SPLIT_KEY,
  MODE_CHANNELS,
  MODE_GAME_CHANNELS,
  modeChannelKey,
  modeDeathTauntsKey,
  modeFunDeathsKey,
  modeKindDefaultsKey,
  routeModePost,
  modeIconKey,
  modeDropFloorKey,
  modeDropValueKey,
  modeDropBothKey,
  modeKindsOffKey,
  modeLevelsKey,
  modeWebhookKey,
  parseSeenModes,
  parseStringList,
  withSeenMode,
  type ModeRouting,
  type WorldMode,
} from '@/lib/worldModes';

/**
 * The kinds a mode drops. A clan that never touched the list gets the defaults (easy tasks off,
 * lib/modeLines); once it saves a list, that list is the whole answer.
 */
export function modeKindsOff(raw: string | null | undefined): string[] {
  return raw === undefined ? [...DEFAULT_MODE_KINDS_OFF] : parseStringList(raw);
}

/** The master switch reads as on unless the clan turned it off. */
export function splitIsOn(raw: string | null | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return !(v === 'off' || v === 'false' || v === '0');
}

/**
 * One clan's routing for one mode (lib/worldModes routeModePost), minus the normal hook the caller
 * already has. Leagues' own channel comes from `leaguesHook` — getNotificationWebhooks already
 * resolved it, honouring the old "Leagues off" switch, which meant "don't divert".
 */
export async function getModeRouting(
  clanId: number,
  modeKey: string,
  leaguesHook: string | null,
): Promise<Omit<ModeRouting, 'normalHook'>> {
  const hookKey = modeWebhookKey(modeKey);
  const kindsKey = modeKindsOffKey(modeKey);
  const channelKeys = MODE_CHANNELS.map((ch) => [ch, modeChannelKey(modeKey, ch)] as const);
  const map = await getSettingMap(clanId, [WORLD_MODES_SPLIT_KEY, WORLD_MODES_OFF_KEY, kindsKey, hookKey, ...channelKeys.map(([, k]) => k)]);
  const modeHook =
    modeKey === 'leagues' ? leaguesHook : pickWebhookUrl(map.get(hookKey) ?? null, `plugin:mode:${modeKey}`);
  // The mode's own channel per kind (only the ones set); a clan that set none keeps the one channel.
  const kindHooks: Record<string, string> = {};
  for (const [ch, key] of channelKeys) {
    const url = pickWebhookUrl(map.get(key) ?? null, `plugin:mode:${modeKey}:${ch}`);
    if (url) kindHooks[ch] = url;
  }
  return {
    split: splitIsOn(map.get(WORLD_MODES_SPLIT_KEY)),
    modeOff: parseStringList(map.get(WORLD_MODES_OFF_KEY)).includes(modeKey),
    kindsOff: new Set(modeKindsOff(map.has(kindsKey) ? map.get(kindsKey) : undefined)),
    modeHook,
    kindHooks,
  };
}

/**
 * A mode's own defaults for the newer kinds, screenshots, chat patterns and message templates
 * (lib/notifyKinds), or null when the clan never gave it any — the main game's then apply.
 */
export async function getModeKindDefaults(clanId: number, modeKey: string): Promise<ClanKinds | null> {
  const raw = await getSetting(clanId, modeKindDefaultsKey(modeKey));
  return raw ? parseClanKinds(raw) : null;
}

/** The newer kinds' defaults a post from this world follows in one clan: the mode's own, else the main game's. */
export async function clanKindsForWorld(clanId: number, modeKey: string | null | undefined): Promise<ClanKinds> {
  if (modeKey) {
    const own = await getModeKindDefaults(clanId, modeKey).catch(() => null);
    if (own) return own;
  }
  return getClanKindDefaults(clanId);
}

const lineList = (raw: string | null | undefined): string[] =>
  (raw ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/**
 * The death lines a death on this world gets in one clan: the mode's own one-liners and reaction
 * lines where it has them, else the main game's (lib/pluginConfig). Each list falls back on its own.
 */
export async function deathLinesForWorld(clanId: number, modeKey: string | null | undefined): Promise<{ funLines: string[]; taunts: string[] }> {
  const [mainFun, mainTaunts] = await Promise.all([getFunDeathMessages(clanId), getDeathTaunts(clanId)]);
  if (!modeKey) return { funLines: mainFun, taunts: mainTaunts };
  const map = await getSettingMap(clanId, [modeFunDeathsKey(modeKey), modeDeathTauntsKey(modeKey)]);
  const fun = lineList(map.get(modeFunDeathsKey(modeKey)));
  const taunts = lineList(map.get(modeDeathTauntsKey(modeKey)));
  return { funLines: fun.length ? fun : mainFun, taunts: taunts.length ? taunts : mainTaunts };
}

/**
 * The plugin's per-channel "a channel exists" flags on a game-mode world: a channel counts when the
 * main game OR this mode has somewhere for it in the addressed clan, so a mode with its own deaths
 * channel gets deaths even when the main game has none. Same shape as the main game's (no plugin
 * change); the notify route still decides each destination. Main-game flags on any failure.
 */
export async function modeAwareNotifyFlags<T extends Record<string, boolean>>(request: Request, clanId: number, flags: T): Promise<T> {
  const mode = worldModeOf(request);
  if (!mode) return flags;
  try {
    const webhooks = await getNotificationWebhooks(clanId);
    const routing = await getModeRouting(clanId, mode.key, pickWebhookUrl(webhooks.leagues, 'plugin:leagues'));
    const out = { ...flags } as Record<string, boolean>;
    for (const ch of MODE_GAME_CHANNELS) {
      if (!(ch in out) || out[ch]) continue;
      out[ch] = !!routeModePost(ch, { ...routing, normalHook: null });
    }
    return out as T;
  } catch (err) {
    log.info('world-modes.flags-failed', { mode: mode.key, err: String(err) });
    return flags;
  }
}

/** A mode's own post thresholds in one clan (lib/modeFilters). Unset drop halves follow the main game. */
export async function getModeFilters(clanId: number, modeKey: string): Promise<ModeFilters> {
  const floorKey = modeDropFloorKey(modeKey);
  const valueKey = modeDropValueKey(modeKey);
  const levelsKey = modeLevelsKey(modeKey);
  const bothKey = modeDropBothKey(modeKey);
  const map = await getSettingMap(clanId, [floorKey, valueKey, levelsKey, bothKey]);
  return {
    dropFloor: storedModeDropFloor(map.get(floorKey)),
    dropMinValue: storedModeDropValue(map.get(valueKey)),
    dropBoth: storedModeDropBoth(map.get(bothKey)),
    levels: storedModeLevels(map.get(levelsKey)),
  };
}

/**
 * The `modeThresholds` block of /api/plugin/config: on a game-mode world (X-World-* headers), the
 * most permissive thresholds among the clans this character's posts go to (lib/emissionRouting —
 * the same set /api/plugin/notify fans out to, which then re-checks each clan's own). Level rules
 * are taken after the member's own level-post choice. Null on the main game, when no clan set
 * anything for the mode, or when nothing can be resolved — the plugin then behaves as before.
 * Never throws: a failed read costs the looser gate, not the config.
 */
export async function pluginModeThresholds(
  request: Request,
  who: { userId: number | null; addressedClanId: number; accountId: () => Promise<number | null | undefined> },
): Promise<PluginModeThresholds | null> {
  const mode = worldModeOf(request);
  if (!mode) return null;
  try {
    // Resolved only on a mode world, so the main game's config costs nothing extra.
    const accountId = await who.accountId();
    const clanIds = accountId != null ? (await socialEmissionClans(accountId)).map((c) => c.clanId) : [who.addressedClanId];
    if (clanIds.length === 0) return null;
    // An event token with no login behind it has no level-post choice: the clan's rules stand.
    const choice = who.userId != null ? (await getMemberLevelPrefs(who.userId)).clanChoice : 'clan';
    const perClan = await Promise.all(
      clanIds.map(async (id) => {
        const f = await getModeFilters(id, mode.key);
        return { ...f, levels: modeLevelRules(f.levels, choice) };
      }),
    );
    return mergeModeThresholds(mode, perClan);
  } catch (err) {
    log.info('world-modes.thresholds-failed', { mode: mode.key, err: String(err) });
    return null;
  }
}

/** The thumbnail for a mode's posts: the clan's own pick, else the mode's art, else none. */
export async function modeIconUrl(clanId: number, mode: WorldMode): Promise<string | null> {
  if (mode.key === 'leagues') return leaguesIconUrl(clanId);
  let override: string | null = null;
  try {
    override = (await getSetting(clanId, modeIconKey(mode.key)))?.trim() || null;
  } catch {
    override = null;
  }
  const src = override ?? mode.icon;
  return src ? absoluteAssetUrl(proxyWikiUrl(src)) : null;
}

/**
 * Remember a mode the catalogue doesn't know, so the clan's Discord page lists it from the first
 * post on. Best effort: a failure here must never cost the post.
 */
export async function rememberSeenMode(clanId: number, mode: WorldMode): Promise<void> {
  if (mode.known) return;
  try {
    const next = withSeenMode(parseSeenModes(await getSetting(clanId, WORLD_MODES_SEEN_KEY)), mode);
    if (next) await setSetting(clanId, WORLD_MODES_SEEN_KEY, JSON.stringify(next));
  } catch (err) {
    log.info('world-modes.seen-write-failed', { clanId, mode: mode.key, err: String(err) });
  }
}

export interface ClanModeRow {
  key: string;
  label: string;
  known: boolean;
}

/** Every mode the Discord page shows: the catalogue, then the ones this clan's members found. */
export async function clanModeRows(clanId: number): Promise<ClanModeRow[]> {
  const seen = parseSeenModes(await getSetting(clanId, WORLD_MODES_SEEN_KEY));
  return [
    ...WORLD_MODES.map((m) => ({ key: m.key, label: m.label, known: true })),
    ...seen.filter((s) => !WORLD_MODES.some((m) => m.key === s.key)).map((s) => ({ ...s, known: false })),
  ];
}

/**
 * "Copy from main game" on a mode's settings: the in-game tab's filters become the mode's own —
 * which kinds post, drop thresholds, level milestones, death lines, and the milestone kinds with
 * their screenshots, chat patterns and message templates. The mode's own events (relics, areas…)
 * keep their switches: the main game has none to copy.
 *
 * Channels only with `channels`: each kind then gets the channel the same main-game post lands in
 * today (its own, the catch-all, or the one it inherits). The mode's own channel is left alone.
 * A main-game setting that is blank clears the mode's copy, which reads as "the main game's".
 */
export async function copyMainGameIntoMode(clanId: number, modeKey: string, opts: { channels: boolean }): Promise<void> {
  const channelFeeds = MODE_GAME_CHANNELS.map((ch) => feedById(ch)).filter((f): f is NonNullable<typeof f> => !!f);
  const kindsKey = modeKindsOffKey(modeKey);
  const map = await getSettingMap(clanId, [
    FEEDS_OFF_KEY,
    kindsKey,
    FUN_DEATHS_SETTING_KEY,
    DEATH_TAUNTS_SETTING_KEY,
    NOTIFY_KIND_DEFAULTS_SETTING_KEY,
    ...FEED_KEYS,
  ]);
  const [drops, rules] = await Promise.all([getClanDropDefaults(clanId), getClanMilestoneRules(clanId)]);

  // Which kinds post: the main game's switches for its own kinds, the mode's for its events.
  const mainOff = parseFeedsOff(map.get(FEEDS_OFF_KEY));
  const eventsOff = modeKindsOff(map.has(kindsKey) ? map.get(kindsKey) : undefined).filter((k) => MODE_EVENT_KIND_IDS.has(k));
  const kindsOff = [...MODE_GAME_CHANNELS.filter((ch) => mainOff.has(ch)), ...eventsOff];

  const d = modeDropsFromMain(drops);
  const writes: [string, string | null][] = [
    [kindsKey, JSON.stringify(kindsOff)],
    [modeDropFloorKey(modeKey), d.dropFloor == null ? null : String(d.dropFloor)],
    [modeDropValueKey(modeKey), d.dropMinValue == null ? null : String(d.dropMinValue)],
    [modeDropBothKey(modeKey), d.dropBoth ? 'and' : null],
    // The level half: XP milestones come off the main game's hiscores, so a mode has none.
    [modeLevelsKey(modeKey), JSON.stringify(levelHalf(rules))],
    [modeFunDeathsKey(modeKey), map.get(FUN_DEATHS_SETTING_KEY)?.trim() || null],
    [modeDeathTauntsKey(modeKey), map.get(DEATH_TAUNTS_SETTING_KEY)?.trim() || null],
    [modeKindDefaultsKey(modeKey), map.get(NOTIFY_KIND_DEFAULTS_SETTING_KEY)?.trim() || null],
  ];
  if (opts.channels) {
    const isSet = (key: string) => !!map.get(key)?.trim();
    for (const feed of channelFeeds) {
      const key = effectiveKey(feed, isSet);
      writes.push([modeChannelKey(modeKey, feed.id), key ? map.get(key)!.trim() : null]);
    }
  }
  for (const [key, value] of writes) await setSetting(clanId, key, value);
}
