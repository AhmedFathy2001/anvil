// "What goes where" on the clan's Discord page: every kind of post the clan's server gets, the
// webhook setting it posts through, and the settings it falls back to when that one is blank — the
// same chains lib/discord and lib/pluginConfig resolve. Written down once so the page can show,
// row by row, where a post actually lands instead of leaving admins to guess the fallbacks.
//
// Pure (no db): the page, its API route and the tests read it.

export type FeedTab = 'clan' | 'game' | 'staff';

export const FEED_TABS: { id: FeedTab; label: string; blurb: string }[] = [
  { id: 'clan', label: 'Clan & events', blurb: 'What the site posts about events, weekly competitions and your calendar.' },
  { id: 'game', label: 'In-game (plugin)', blurb: 'What members do in game, sent by the Anvil plugin. Filters apply to the whole clan.' },
  { id: 'staff', label: 'Staff only', blurb: 'Admin information. Point these at a private staff channel.' },
];

/** The site's catch-all: every clan and event post without a channel of its own ends up here. */
export const SITE_CATCH_ALL = 'discord_webhook_url';
/** The plugin's catch-all: every in-game post without a channel of its own. */
export const GAME_CATCH_ALL = 'webhook_plugin_default';

export interface DiscordFeed {
  id: string;
  tab: FeedTab;
  label: string;
  help: string;
  /** Its own webhook setting. */
  key: string;
  /** Tried in order when `key` is blank. Empty = nowhere: blank means off. */
  fallback: readonly string[];
  /**
   * How it is switched off: 'feeds' = the clan's feeds-off list, 'cohost' = the co-host fan-out
   * setting, 'perPost' = event posts, switched per post in the event defaults.
   */
  off: 'feeds' | 'cohost' | 'perPost';
  /** Where its filters live on the page, if anywhere. */
  filters?: 'drops' | 'levels' | 'deaths';
}

export const DISCORD_FEEDS: readonly DiscordFeed[] = [
  { id: 'event', tab: 'clan', label: 'Event posts', help: 'Bingo, ladder and race posts from the board reveal to the recap. Switch single posts on or off under Event posts.', key: 'discord_webhook_bingo', fallback: [SITE_CATCH_ALL], off: 'perPost' },
  { id: 'cohost', tab: 'clan', label: 'Boards you co-host', help: 'Posts from other clans’ boards your members play on. Each board can show less from its co-hosted page.', key: 'discord_webhook_cohost', fallback: ['discord_webhook_bingo', SITE_CATCH_ALL], off: 'cohost' },
  { id: 'weekly', tab: 'clan', label: 'Skill & boss of the week', help: 'The start and the results.', key: 'discord_webhook_weekly', fallback: [SITE_CATCH_ALL], off: 'feeds' },
  { id: 'clanEvents', tab: 'clan', label: 'Clan calendar events', help: 'The announcement, a reminder 15 minutes before, and "starting now".', key: 'discord_webhook_clan_events', fallback: [SITE_CATCH_ALL], off: 'feeds' },
  { id: 'rareDrops', tab: 'game', label: 'Rare drops', help: 'Valuable or rare loot.', key: 'webhook_rare_drops', fallback: [GAME_CATCH_ALL], off: 'feeds', filters: 'drops' },
  { id: 'pets', tab: 'game', label: 'Pets', help: 'Every pet, with where it really came from.', key: 'webhook_pets', fallback: [GAME_CATCH_ALL, 'webhook_rare_drops'], off: 'feeds' },
  { id: 'collectionLog', tab: 'game', label: 'Collection log', help: 'New log slots.', key: 'webhook_collection_log', fallback: [GAME_CATCH_ALL, 'webhook_combat_achievements'], off: 'feeds' },
  { id: 'levels', tab: 'game', label: 'Levels & XP milestones', help: 'Level-ups and total XP milestones.', key: 'webhook_levels', fallback: [GAME_CATCH_ALL, 'webhook_combat_achievements'], off: 'feeds', filters: 'levels' },
  { id: 'combatAchievements', tab: 'game', label: 'Combat achievements', help: 'Tier clears and high-tier tasks.', key: 'webhook_combat_achievements', fallback: [GAME_CATCH_ALL], off: 'feeds' },
  { id: 'quests', tab: 'game', label: 'Quests', help: 'Quest completions.', key: 'webhook_quests', fallback: [GAME_CATCH_ALL, 'webhook_combat_achievements'], off: 'feeds' },
  { id: 'diaries', tab: 'game', label: 'Achievement diaries', help: 'Diary tier completions.', key: 'webhook_diaries', fallback: [GAME_CATCH_ALL, 'webhook_combat_achievements'], off: 'feeds' },
  { id: 'deaths', tab: 'game', label: 'Deaths', help: 'Deaths, with your fun lines.', key: 'webhook_deaths', fallback: [GAME_CATCH_ALL], off: 'feeds', filters: 'deaths' },
  { id: 'pvpKills', tab: 'game', label: 'PvP kills', help: 'Player kills, with a screenshot.', key: 'webhook_pvp_kills', fallback: [GAME_CATCH_ALL], off: 'feeds' },
  { id: 'leagues', tab: 'game', label: 'Leagues', help: 'While a member is on a Leagues world, all their posts go here instead. Blank keeps them in the normal channels.', key: 'webhook_leagues', fallback: [], off: 'feeds' },
  { id: 'roster', tab: 'staff', label: 'Roster changes', help: 'Joins, leaves and rank changes from the in-game roster sync.', key: 'discord_webhook_roster', fallback: [SITE_CATCH_ALL], off: 'feeds' },
  { id: 'signups', tab: 'staff', label: 'Sign-up approved', help: 'Pings the player, with a reminder to pay the fee.', key: 'discord_webhook_signups', fallback: [SITE_CATCH_ALL], off: 'feeds' },
  { id: 'coffer', tab: 'staff', label: 'Coffer ledger', help: 'Every gp in or out, with the balance it leaves. Has no fallback: blank posts nothing.', key: 'discord_webhook_coffer', fallback: [], off: 'feeds' },
];

const BY_ID = new Map(DISCORD_FEEDS.map((f) => [f.id, f]));
export function feedById(id: string): DiscordFeed | undefined {
  return BY_ID.get(id);
}

/** Every webhook setting the page reads, catch-alls included. */
export const FEED_KEYS: readonly string[] = [
  ...new Set([SITE_CATCH_ALL, GAME_CATCH_ALL, ...DISCORD_FEEDS.flatMap((f) => [f.key, ...f.fallback])]),
];

/**
 * The setting a feed actually posts through today: its own when set, else the first set fallback,
 * else none (the feed posts nowhere).
 */
export function effectiveKey(feed: DiscordFeed, isSet: (key: string) => boolean): string | null {
  if (isSet(feed.key)) return feed.key;
  return feed.fallback.find(isSet) ?? null;
}

/** The clan's switched-off feeds, stored as a JSON list of feed ids. Unknown ids are dropped. */
export function parseFeedsOff(raw: string | null | undefined): Set<string> {
  try {
    const v = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && BY_ID.has(x)) : []);
  } catch {
    return new Set();
  }
}

export const FEEDS_OFF_KEY = 'discord_feeds_off';
