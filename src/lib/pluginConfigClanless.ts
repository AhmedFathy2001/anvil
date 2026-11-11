// /api/plugin/config for a person in NO clan who is in a head-to-head drop race.
//
// A clanless plugin gets a 404 config (lib/pluginNoClan) and so holds no config at all — and the
// plugin only reports drops as moments when it has one (`momentsEnabled` needs a config carrying the
// `moments` capability; `luckItemIds` is what makes it report an item whatever it sells for). Kill and
// XP races read stats the plugin pushes clan or not, but "first to a drop" never heard a thing.
//
// So the site answers such a person with the smallest config that works: the shape a clan member
// with no live event gets (event null, noActiveEvent, every tracked list empty, no notify channels),
// with no clan in it and `luckItemIds` set to the items of their running drop races. The moments
// route already takes a report from a character the token owns and runs it through the races
// (lib/h2h recordH2hDrops) before it gives up for want of a seat, so nothing else is stored for it.
//
// DELIBERATELY NARROW. Everyone else still gets the 404, which the plugin reads as "signed in with no
// clan" — only a person mid-race on a plugin new enough to draw its panel from the site (so an empty
// clan name renders nothing odd) is answered, and only while the race runs. When it ends the 404
// comes back and the plugin returns to exactly today's state.

import { DEFAULT_ALWAYS_NOTIFY } from '@/lib/alwaysNotify';
import { serverInfo } from '@/lib/serverInfo';
import { NOTIFY_CHANNELS, personalBestActivities } from '@/lib/pluginConfig';
import { combatTaskVarps } from '@/lib/combatTasks';
import { pluginRollTables } from '@/lib/pluginConfigEnrolled';
import { resolvePluginCharacter } from '@/lib/pluginAccount';
import { h2hDropItemIdsForAccount } from '@/lib/h2h';
import { pluginVersionHeader } from '@/lib/pluginSeen';
import { compareVersions } from '@/lib/tileRequirementChecks';

/**
 * The first plugin whose side panel is drawn by the site (`plugin-ui`) and whose config-less fallbacks
 * all read the same capabilities a config carries — so a config with no clan in it changes nothing
 * on screen. Older jars draw their own clan card and would show one with no name: they keep the 404.
 */
export const CLANLESS_CONFIG_MIN_PLUGIN = '1.14.0';

export function clanlessConfigSupported(request: Request): boolean {
  const cmp = compareVersions(pluginVersionHeader(request), CLANLESS_CONFIG_MIN_PLUGIN);
  return cmp != null && cmp >= 0;
}

/** The config body itself. Pure, so the shape is tested without a database. */
export function clanlessConfigBody(luckItemIds: number[]): Record<string, unknown> {
  return {
    server: serverInfo(),
    // Says this is the no-clan answer, so the site's own Clan tab (lib/pluginUi/views homeView) keeps
    // its "not in a clan yet" line. Plugins ignore unknown fields.
    clanless: true,
    // Only ever built for a character the token owns (resolvePluginCharacter).
    accountStanding: 'yours',
    event: null,
    team: null,
    player: null,
    clanName: null,
    activeClan: null,
    clans: [],
    homeBoard: null,
    unlinkedActiveEvent: null,
    codeword: null,
    startProof: null,
    pbActivities: personalBestActivities(),
    caVarps: combatTaskVarps(),
    trackedStats: [],
    trackedKcNames: [],
    trackedSkillNames: [],
    trackedActivityKeys: [],
    trackedDrops: [],
    trackedKills: [],
    trackedPvp: [],
    pvpRoster: [],
    trackedTimed: [],
    trackedLms: [],
    trackedValues: [],
    trackedGains: [],
    trackedDeathless: [],
    trackedDiaries: [],
    trackedCombatTasks: [],
    trackedClog: [],
    // The point of the whole answer (lib/h2h): the plugin reports these as moments, price aside.
    luckItemIds: [...new Set(luckItemIds)].sort((a, b) => a - b),
    noActiveEvent: true,
    rollTables: pluginRollTables,
    schedule: { bingos: [], weeklies: [] },
    activeWeekly: null,
    // No clan, no channels: nothing is forwarded to a Discord.
    notify: Object.fromEntries(NOTIFY_CHANNELS.map((c) => [c, false])),
    funDeathMessages: [],
    deathTaunts: [],
    spoonTaunts: [],
    // The defaults, so a plugin that takes the site's list in place of its own still has one.
    alwaysNotifyItems: [...DEFAULT_ALWAYS_NOTIFY],
    alwaysNotifyItemIds: [],
    showKillCount: true,
    dropRarityFloor: 0,
    panel: { tiles: [], activeNow: [], scheduled: [], weeklies: [] },
  };
}

/**
 * The clanless config for this request, or null when the 404 still stands: no character the token
 * owns, an older plugin, or no drop race running. Never throws.
 */
export async function clanlessPluginConfig(request: Request): Promise<Record<string, unknown> | null> {
  try {
    if (!clanlessConfigSupported(request)) return null;
    const character = await resolvePluginCharacter(request);
    if (!character) return null;
    const ids = await h2hDropItemIdsForAccount(character.accountId);
    return ids.length ? clanlessConfigBody(ids) : null;
  } catch {
    return null;
  }
}
