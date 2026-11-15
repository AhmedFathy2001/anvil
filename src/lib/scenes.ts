// Backdrop art for a card about a skill or a boss: a wide OSRS Wiki picture of where the skill is
// trained (src/data/skillScenes.json, one hand-picked file per skill), or the boss's own render. Drawn
// faded behind the card's text, through our image cache (lib/assetUrls) — never hotlinked.

import skillScenes from '@/data/skillScenes.json';
import { SKILLS, SKILL_ALIASES, SKILL_LABELS } from '@/lib/constants';
import { proxyWikiUrl, wikiImageUrl } from '@/lib/assetUrls';
import { bossImageForStatKey, bossImageUrl } from '@/lib/tileIcons';
import { metricKeys } from '@/lib/constants';

export interface Scene {
  url: string;
  /** 'cover': a landscape that fills the card. 'contain': a cut-out figure, set to one side. */
  fit: 'cover' | 'contain';
}

const SCENES = skillScenes as Record<string, string>;
/** The width the cache serves a scene at (lib/assetUrls WIKI_THUMB_WIDTHS): small on purpose, it is drawn faded and soft. */
const SCENE_WIDTH = 320;

/** A skill by its key ("runecraft") or its display name ("Runecrafting"). */
function skillKey(name: string): string | null {
  const n = name.trim().toLowerCase();
  if ((SKILLS as readonly string[]).includes(n)) return n;
  return (SKILLS as readonly string[]).find((k) => (SKILL_LABELS[k] ?? '').toLowerCase() === n || (SKILL_ALIASES[k] ?? []).includes(n)) ?? null;
}

export function skillScene(skill: string | null | undefined): Scene | null {
  const key = skill ? skillKey(skill) : null;
  const file = key ? SCENES[key] : null;
  return file ? { url: wikiImageUrl(`thumb/${file}/${SCENE_WIDTH}px-${file}`), fit: 'cover' } : null;
}

export function bossScene(boss: string | null | undefined): Scene | null {
  return figure(bossImageUrl(boss));
}

const figure = (raw: string | null | undefined): Scene | null => {
  const url = proxyWikiUrl(raw);
  // An item sprite (the fallback for a boss with no picture) is too small to be a backdrop.
  return url && !url.startsWith('/img/item/') ? { url, fit: 'contain' } : null;
};

/** As {@link sceneFor}, from a stored metric: a skill key, or a hiscores boss key ("kreeArra"; a raid's first mode). */
export function sceneForMetric(type: 'skill' | 'boss' | string, metric: string | null | undefined): Scene | null {
  if (!metric) return null;
  return type === 'skill' ? skillScene(metric) : type === 'boss' ? figure(bossImageForStatKey(metricKeys(metric)[0] ?? metric)) : null;
}

/** The scene for a competition or a milestone: 'skill' or 'boss', and which one. */
export function sceneFor(type: 'skill' | 'boss' | string, subject: string | null | undefined): Scene | null {
  return type === 'skill' ? skillScene(subject) : type === 'boss' ? bossScene(subject) : null;
}
