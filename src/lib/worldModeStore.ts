import { pickWebhookUrl } from '@/lib/discord';
import { absoluteAssetUrl } from '@/lib/seo';
import { proxyWikiUrl } from '@/lib/assetUrls';
import { leaguesIconUrl } from '@/lib/leagues';
import { log } from '@/lib/logger';
import { DEFAULT_MODE_KINDS_OFF } from '@/lib/modeLines';
import { getSetting, getSettingMap, setSetting } from '@/lib/settings';
import { storedModeDropFloor, storedModeLevels, type ModeFilters } from '@/lib/modeFilters';
import {
  WORLD_MODES,
  WORLD_MODES_OFF_KEY,
  WORLD_MODES_SEEN_KEY,
  WORLD_MODES_SPLIT_KEY,
  modeIconKey,
  modeDropFloorKey,
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

/** A mode's own post filters in one clan (lib/modeFilters). Unset halves follow the main game. */
export async function getModeFilters(clanId: number, modeKey: string): Promise<ModeFilters> {
  const floorKey = modeDropFloorKey(modeKey);
  const levelsKey = modeLevelsKey(modeKey);
  const map = await getSettingMap(clanId, [floorKey, levelsKey]);
  return { dropFloor: storedModeDropFloor(map.get(floorKey)), levels: storedModeLevels(map.get(levelsKey)) };
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
