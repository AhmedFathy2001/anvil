// The optional modules a clan can switch off on Admin → Features.
//
// OFF MEANS HIDDEN FOR EVERYONE, staff and members alike: the sidebar entry, the member nav link,
// the event-form option and its settings all go. Nothing is deleted — switching a feature back on
// brings it all back, data included. Running events that already use a feature keep working.
//
// Pure on purpose (no `@/db` import): the nav, the event form and tests all read this list. The
// per-clan read lives in lib/clanFeatures.

export type FeatureKey =
  | 'weekly'
  | 'poolFormats'
  | 'missions'
  | 'survey'
  | 'fees'
  | 'coffer'
  | 'announce'
  | 'funMessages'
  | 'clanHall';

export interface FeatureDef {
  key: FeatureKey;
  group: 'Events' | 'Money' | 'Discord & plugin';
  name: string;
  /** One plain sentence: what it is, for someone who has never seen it. */
  what: string;
  /** The guide section that explains it. */
  guide: string;
  /** Off for a clan created after the Features page shipped. Existing clans keep everything on. */
  offForNewClans: boolean;
}

export const FEATURES: readonly FeatureDef[] = [
  { key: 'weekly', group: 'Events', name: 'Skill & Boss of the Week', what: 'Week-long competitions the whole roster is entered in automatically.', guide: '/guide/admin#weekly', offForNewClans: false },
  { key: 'poolFormats', group: 'Events', name: 'Surprise-task formats', what: 'Showdown, Lucky draw, Bounty hunt and Ladder in the New event picker.', guide: '/guide/formats', offForNewClans: true },
  { key: 'missions', group: 'Events', name: 'Missions', what: 'Extra tasks you announce in the middle of an event, for bonus points.', guide: '/guide/admin#missions', offForNewClans: true },
  { key: 'survey', group: 'Events', name: 'Post-event survey', what: 'Ask players what they thought once an event ends.', guide: '/guide/admin#survey', offForNewClans: true },
  { key: 'fees', group: 'Money', name: 'Sign-up fees', what: 'Charge gp to join an event and keep track of who has paid.', guide: '/guide/fees', offForNewClans: false },
  { key: 'coffer', group: 'Money', name: 'Clan coffer', what: 'A record of the clan’s gp: donations in, prizes out.', guide: '/guide/coffer', offForNewClans: true },
  { key: 'announce', group: 'Discord & plugin', name: 'Post to Discord', what: 'Write an announcement here and the bot posts it in a channel.', guide: '/guide/discord', offForNewClans: false },
  { key: 'funMessages', group: 'Discord & plugin', name: 'Death & fun messages', what: 'Light-hearted posts when someone dies or gets unlucky.', guide: '/guide/plugin', offForNewClans: true },
  { key: 'clanHall', group: 'Discord & plugin', name: 'Clan Hall card', what: 'Shows who’s online in your Discord on your public clan page.', guide: '/guide/discord', offForNewClans: false },
];

const KEYS = new Set<string>(FEATURES.map((f) => f.key));

export function isFeatureKey(v: unknown): v is FeatureKey {
  return typeof v === 'string' && KEYS.has(v);
}

/** The settings row that holds the switched-off keys, as a JSON array. Absent = everything on. */
export const FEATURES_OFF_SETTING = 'features_off';

/** Parse the stored value. Unknown keys are dropped so a removed feature can't linger as "off". */
export function parseFeaturesOff(raw: string | null | undefined): Set<FeatureKey> {
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter(isFeatureKey) : []);
  } catch {
    return new Set();
  }
}

export function serializeFeaturesOff(off: Iterable<FeatureKey>): string {
  return JSON.stringify([...new Set(off)].sort());
}

/** What a brand-new clan starts with switched off. */
export function defaultFeaturesOffForNewClan(): string {
  return serializeFeaturesOff(FEATURES.filter((f) => f.offForNewClans).map((f) => f.key));
}

export interface FeatureFlags {
  on(key: FeatureKey): boolean;
  off: ReadonlySet<FeatureKey>;
}

export function featureFlags(off: ReadonlySet<FeatureKey>): FeatureFlags {
  return { off, on: (key) => !off.has(key) };
}
