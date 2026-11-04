import { pickWebhookUrl } from '@/lib/discord';
import { absoluteAssetUrl } from '@/lib/seo';
import { proxyWikiUrl } from '@/lib/assetUrls';
import { leaguesIconUrl } from '@/lib/leagues';
import { log } from '@/lib/logger';
import { DEFAULT_MODE_KINDS_OFF } from '@/lib/modeLines';
import { getSetting, getSettingMap, setSetting } from '@/lib/settings';
import {
  mergeModeThresholds,
  modeLevelRules,
  storedModeDropFloor,
  storedModeDropValue,
  storedModeLevels,
  type ModeFilters,
  type PluginModeThresholds,
} from '@/lib/modeFilters';
import { socialEmissionClans } from '@/lib/emissionRouting';
import { getMemberLevelPrefs } from '@/lib/levelRulesStore';
import { worldModeOf } from '@/lib/worldModeRequest';
import {
  WORLD_MODES,
  WORLD_MODES_OFF_KEY,
  WORLD_MODES_SEEN_KEY,
  WORLD_MODES_SPLIT_KEY,
  modeIconKey,
  modeDropFloorKey,
  modeDropValueKey,
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
  const map = await getSettingMap(clanId, [WORLD_MODES_SPLIT_KEY, WORLD_MODES_OFF_KEY, kindsKey, hookKey]);
  const modeHook =
    modeKey === 'leagues' ? leaguesHook : pickWebhookUrl(map.get(hookKey) ?? null, `plugin:mode:${modeKey}`);
  return {
    split: splitIsOn(map.get(WORLD_MODES_SPLIT_KEY)),
    modeOff: parseStringList(map.get(WORLD_MODES_OFF_KEY)).includes(modeKey),
    kindsOff: new Set(modeKindsOff(map.has(kindsKey) ? map.get(kindsKey) : undefined)),
    modeHook,
  };
}

/** A mode's own post thresholds in one clan (lib/modeFilters). Unset drop halves follow the main game. */
export async function getModeFilters(clanId: number, modeKey: string): Promise<ModeFilters> {
  const floorKey = modeDropFloorKey(modeKey);
  const valueKey = modeDropValueKey(modeKey);
  const levelsKey = modeLevelsKey(modeKey);
  const map = await getSettingMap(clanId, [floorKey, valueKey, levelsKey]);
  return {
    dropFloor: storedModeDropFloor(map.get(floorKey)),
    dropMinValue: storedModeDropValue(map.get(valueKey)),
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
