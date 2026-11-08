/**
 * What a personal webhook can take, by name: the clan channels (minus clips, which never route
 * per-person) and each newer kind on its own (lib/notifyKinds), so a webhook can take GE offers and
 * nothing else. One list for both webhook routes and the settings page. Pure.
 */
export const HOOK_KIND_LABELS = {
  rareDrops: 'Rare drops',
  pets: 'Pets',
  deaths: 'Deaths',
  combatAchievements: 'Combat achievements',
  levels: 'Levels & milestones',
  quests: 'Quests',
  diaries: 'Achievement diaries',
  collectionLog: 'Collection log',
  pvpKills: 'PvP kills',
  slayer: 'Slayer tasks',
  clues: 'Clue scrolls',
  speedruns: 'Speedruns & PBs',
  kc: 'Kill counts',
  ba: 'BA gambles',
  custom: 'Custom chat messages',
  ge: 'Grand Exchange',
  trade: 'Trades',
  storage: 'Group storage',
  ext: 'Other plugins',
} as const;
export type HookKind = keyof typeof HOOK_KIND_LABELS;
export const HOOK_KINDS = Object.keys(HOOK_KIND_LABELS) as HookKind[];
export const isHookKind = (k: unknown): k is HookKind => typeof k === 'string' && (HOOK_KINDS as string[]).includes(k);
