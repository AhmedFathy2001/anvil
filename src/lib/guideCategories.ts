// Guide categories and small pure helpers shared by the site, the editor and the API. No imports, so
// client components and tests can take them freely.

export const GUIDE_CATEGORIES = [
  { key: 'raids', label: 'Raids', icon: '🏛️' },
  { key: 'bossing', label: 'Bossing', icon: '🐉' },
  { key: 'skilling', label: 'Skilling', icon: '⛏️' },
  { key: 'money', label: 'Money making', icon: '💰' },
  { key: 'quests', label: 'Quests & diaries', icon: '📜' },
  { key: 'minigames', label: 'Minigames', icon: '🎲' },
  { key: 'pvp', label: 'PvP', icon: '⚔️' },
  { key: 'clan', label: 'Clan info', icon: '🏰' },
  { key: 'general', label: 'General', icon: '📖' },
] as const;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number]['key'];

export function categoryOf(key: string | null | undefined) {
  return GUIDE_CATEGORIES.find((c) => c.key === key) ?? GUIDE_CATEGORIES[GUIDE_CATEGORIES.length - 1];
}

export function isGuideCategory(key: unknown): key is GuideCategory {
  return typeof key === 'string' && GUIDE_CATEGORIES.some((c) => c.key === key);
}

export const GUIDE_STATUSES = ['draft', 'published'] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

/** Limits enforced by the API and shown by the editor. */
export const GUIDE_LIMITS = {
  title: 100, // a forum post's name is capped at 100 by Discord
  summary: 300,
  body: 60_000,
  note: 200,
} as const;

/** A url-safe slug from a title: `Chambers of Xeric — Learner` → `chambers-of-xeric-learner`. */
export function slugify(title: string): string {
  const s = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return s || 'guide';
}

/** Reading time at ~220 wpm, never less than a minute. */
export function readingMinutes(body: string): number {
  const words = body.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
