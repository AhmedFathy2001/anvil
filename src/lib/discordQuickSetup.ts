/**
 * Discord quick setup — the pure half (no database, no network), so it can be unit-tested and
 * imported by the client.
 *
 * Quick setup routes every plugin post kind into one of three layouts, and can reuse the channels
 * a clan's old webhooks (Dink, usually) already post into, so nothing moves for members.
 *
 * The routing it writes leans on the fallbacks in lib/pluginConfig (getNotificationWebhooks): an
 * unset kind asks the catch-all (`webhook_plugin_default`), then its old home (pets → drops;
 * levels, quests, diaries, collection log → achievements).
 */

export type QuickSetupLayout = 'one' | 'few' | 'all';

export const QUICK_SETUP_LAYOUTS: readonly QuickSetupLayout[] = ['one', 'few', 'all'];

export interface QuickSetupTarget {
  settingKey: string;
  /** Exact Discord channel name looked for, and created if missing. */
  channelName: string;
  /** What lands there, for result rows: "Drops & pets". */
  label: string;
  /**
   * Kinds that share this channel, written with the same webhook. Explicit rather than left to the
   * fallbacks: a catch-all set earlier beats a kind's old home, so "pets follow drops" only holds
   * when pets are told so.
   */
  alsoKeys?: readonly string[];
}

export const QUICK_SETUP_GROUPS: Record<QuickSetupLayout, readonly QuickSetupTarget[]> = {
  one: [{ settingKey: 'webhook_plugin_default', channelName: 'clan-highlights', label: 'Everything' }],
  few: [
    { settingKey: 'webhook_rare_drops', channelName: 'drops', label: 'Drops & pets', alsoKeys: ['webhook_pets'] },
    { settingKey: 'webhook_deaths', channelName: 'deaths', label: 'Deaths & PvP kills', alsoKeys: ['webhook_pvp_kills'] },
    {
      settingKey: 'webhook_combat_achievements',
      channelName: 'achievements',
      label: 'Achievements, levels, quests, diaries & collection log',
      alsoKeys: ['webhook_levels', 'webhook_quests', 'webhook_diaries', 'webhook_collection_log'],
    },
  ],
  all: [
    { settingKey: 'webhook_rare_drops', channelName: 'drops', label: 'Drops' },
    { settingKey: 'webhook_pets', channelName: 'pets', label: 'Pets' },
    { settingKey: 'webhook_deaths', channelName: 'deaths', label: 'Deaths' },
    { settingKey: 'webhook_levels', channelName: 'levels', label: 'Levels' },
    {
      settingKey: 'webhook_combat_achievements',
      channelName: 'achievements',
      label: 'Achievements, quests & diaries',
      alsoKeys: ['webhook_quests', 'webhook_diaries'],
    },
    { settingKey: 'webhook_collection_log', channelName: 'collection-log', label: 'Collection log' },
    { settingKey: 'webhook_pvp_kills', channelName: 'pvp', label: 'PvP kills' },
  ],
};

/**
 * Event news (start / end, draft, results, sign-ups) — the site's own posts, not the plugin's. Quick
 * setup gives it a channel too when the clan has none, so a first run sets up everything at once.
 */
export const NEWS_TARGET: QuickSetupTarget = { settingKey: 'discord_webhook_url', channelName: 'events', label: 'Event news' };

/** The catch-all every plugin kind falls back to. Mirrors PLUGIN_WEBHOOK_BASE_KEY in pluginConfig. */
export const BASE_KEY = 'webhook_plugin_default';

/**
 * The per-kind plugin settings ("split keys"), with a short label. Mirrors SETTING_KEY in
 * lib/pluginConfig minus `leagues`, which only ever diverts and never inherits the base.
 */
export const SPLIT_KEY_LABELS: Record<string, string> = {
  webhook_rare_drops: 'Drops',
  webhook_pets: 'Pets',
  webhook_deaths: 'Deaths',
  webhook_combat_achievements: 'Combat achievements',
  webhook_levels: 'Levels',
  webhook_quests: 'Quests',
  webhook_diaries: 'Diaries',
  webhook_collection_log: 'Collection log',
  webhook_pvp_kills: 'PvP kills',
  webhook_clips: 'Clips',
};

/** Every plugin routing key quick setup reads or writes: the base plus the split keys. */
export const QUICK_SETUP_KEYS: readonly string[] = [BASE_KEY, ...Object.keys(SPLIT_KEY_LABELS)];

export function quickSetupLabel(settingKey: string): string {
  if (settingKey === BASE_KEY) return 'Everything else';
  if (settingKey === NEWS_TARGET.settingKey) return NEWS_TARGET.label;
  return SPLIT_KEY_LABELS[settingKey] ?? settingKey;
}

export function isQuickSetupLayout(v: unknown): v is QuickSetupLayout {
  return v === 'one' || v === 'few' || v === 'all';
}

// Channel-name keywords → the setting key they suggest. Matched against whole words of the name
// (split on anything not a letter or digit, so "💰│drops-and-pets" is ["drops","and","pets"]):
// a bare substring test would read "ca" into "vacation".
const KEYWORDS: { settingKey: string; match: (word: string) => boolean }[] = [
  { settingKey: 'webhook_rare_drops', match: (w) => w.startsWith('drop') || w.startsWith('loot') },
  { settingKey: 'webhook_pets', match: (w) => w.startsWith('pet') },
  { settingKey: 'webhook_deaths', match: (w) => w.startsWith('death') },
  { settingKey: 'webhook_levels', match: (w) => w.startsWith('level') || w === 'lvl' || w === 'lvls' },
  { settingKey: 'webhook_collection_log', match: (w) => w.startsWith('clog') || w.startsWith('collection') },
  { settingKey: 'webhook_pvp_kills', match: (w) => w === 'pk' || w === 'pks' || w.startsWith('pking') || w.startsWith('pvp') },
  {
    settingKey: 'webhook_combat_achievements',
    match: (w) =>
      w.startsWith('achiev') || w === 'ca' || w === 'cas' || w.startsWith('quest') || w.startsWith('diar'),
  },
];

function words(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** The setting keys a channel's name suggests. A "drops-and-pets" channel suggests both. */
export function keysForChannelName(name: string): string[] {
  const ws = words(name);
  return KEYWORDS.filter((k) => ws.some(k.match)).map((k) => k.settingKey);
}

export interface ForeignWebhookLike {
  channelId: string;
  channelName: string;
  name: string;
}

/**
 * Map the channels foreign webhooks post into onto the layout's setting keys, so quick setup can
 * post into the same places. Returns { settingKey: channelId } for keys it found a home for.
 *
 * - one: the channel holding the most foreign webhooks (first seen wins a tie) takes everything.
 * - few / all: by channel-name keyword, only for keys the layout uses. When two channels suggest
 *   the same key, the one with more foreign webhooks wins.
 */
export function suggestReuse(foreign: readonly ForeignWebhookLike[], layout: QuickSetupLayout): Record<string, string> {
  // Count per channel, keeping first-seen order for stable tie-breaks.
  const counts = new Map<string, { name: string; count: number }>();
  for (const w of foreign) {
    if (!w.channelId) continue;
    const c = counts.get(w.channelId);
    if (c) c.count++;
    else counts.set(w.channelId, { name: w.channelName, count: 1 });
  }
  if (counts.size === 0) return {};

  if (layout === 'one') {
    let best: string | null = null;
    let bestCount = 0;
    for (const [id, { count }] of counts) {
      if (count > bestCount) {
        best = id;
        bestCount = count;
      }
    }
    return best ? { [BASE_KEY]: best } : {};
  }

  const wanted = new Set(QUICK_SETUP_GROUPS[layout].map((t) => t.settingKey));
  const out: Record<string, string> = {};
  const outCount: Record<string, number> = {};
  for (const [id, { name, count }] of counts) {
    for (const key of keysForChannelName(name)) {
      if (!wanted.has(key)) continue;
      if (out[key] === undefined || count > outCount[key]) {
        out[key] = id;
        outCount[key] = count;
      }
    }
  }
  return out;
}

/**
 * Plain-English warnings about settings quick setup leaves alone but which change where posts go.
 * `current` is the clan's routing settings as they stood BEFORE setup (blank = unset).
 */
export function setupNotes(layout: QuickSetupLayout, current: Record<string, string | null | undefined>): string[] {
  const isSet = (k: string) => !!current[k]?.trim();
  const written = new Set(QUICK_SETUP_GROUPS[layout].flatMap((t) => [t.settingKey, ...(t.alsoKeys ?? [])]));
  const notes: string[] = [];

  // Split keys set earlier and not rewritten now keep their own channel, beating the new routing.
  const keeping = Object.keys(SPLIT_KEY_LABELS).filter((k) => !written.has(k) && isSet(k));
  if (keeping.length > 0) {
    notes.push(
      `${keeping.map((k) => SPLIT_KEY_LABELS[k]).join(', ')} still ${keeping.length === 1 ? 'goes' : 'go'} to the channel set earlier. Change it under “Change channels by hand”.`,
    );
  }
  return notes;
}

/** The numeric webhook id inside a Discord webhook URL, or null. */
export function webhookIdFromUrl(url: string): string | null {
  const m = /\/api\/(?:v\d+\/)?webhooks\/(\d+)\//.exec(url);
  return m ? m[1] : null;
}

/** Every webhook id named in a block of text (a setting can hold several URLs). */
export function webhookIdsInText(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\/api\/(?:v\d+\/)?webhooks\/(\d+)\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

export interface RawGuildWebhook {
  id: string;
  type: number;
  name?: string | null;
  channel_id?: string | null;
  application_id?: string | null;
  user?: { id?: string } | null;
}

/**
 * Is this a webhook Anvil should treat as someone else's? Only incoming webhooks (type 1) count —
 * channel-follower and application webhooks are never Dink's. One made by our bot, or one whose
 * URL any Anvil setting or destination uses (a pasted URL is ours even though a person made it),
 * is not foreign. `botIds` holds our bot's user id and application id (usually the same).
 */
export function isForeignWebhook(
  w: RawGuildWebhook,
  botIds: ReadonlySet<string>,
  anvilIds: ReadonlySet<string>,
): boolean {
  if (w.type !== 1) return false;
  if (anvilIds.has(w.id)) return false;
  if (w.user?.id && botIds.has(w.user.id)) return false;
  if (w.application_id && botIds.has(w.application_id)) return false;
  return true;
}
