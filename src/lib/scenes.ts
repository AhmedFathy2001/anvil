// Backdrop art for a card about a skill or a boss, made from the game's own art and the clan's own
// colour rather than a photograph: a skill's icon (drawn as a big clan-coloured emblem), or the boss's
// render (standing at the card's edge in the clan's light). components/SceneBackdrop draws it; this
// only says WHICH picture. Everything comes through our image cache (lib/assetUrls), never hotlinked.

import { SKILLS, SKILL_ALIASES, SKILL_LABELS, metricKeys } from '@/lib/constants';
import { proxyWikiUrl } from '@/lib/assetUrls';
import { bossImageForStatKey, bossImageUrl, skillIconUrl } from '@/lib/tileIcons';

export interface Scene {
  url: string;
  /** 'emblem': an icon, drawn large as a silhouette in the clan's colour. 'figure': a cut-out render, set to one side. */
  kind: 'emblem' | 'figure';
}

/** A skill by its key ("runecraft"), its display name, or a common alias ("Runecrafting"). */
function skillKey(name: string): string | null {
  const n = name.trim().toLowerCase();
  if ((SKILLS as readonly string[]).includes(n)) return n;
  return (SKILLS as readonly string[]).find((k) => (SKILL_LABELS[k] ?? '').toLowerCase() === n || (SKILL_ALIASES[k] ?? []).includes(n)) ?? null;
}

export function skillScene(skill: string | null | undefined): Scene | null {
  const key = skill ? skillKey(skill) : null;
  const url = key ? skillIconUrl(key) : null;
  return url ? { url, kind: 'emblem' } : null;
}

const figure = (raw: string | null | undefined): Scene | null => {
  const url = proxyWikiUrl(raw);
  // An item sprite (the fallback for a boss with no picture) is too small to stand as a figure.
  return url && !url.startsWith('/img/item/') ? { url, kind: 'figure' } : null;
};

export function bossScene(boss: string | null | undefined): Scene | null {
  return figure(bossImageUrl(boss));
}

/** The scene for a competition or a milestone by NAME: 'skill' or 'boss', and which one. */
export function sceneFor(type: 'skill' | 'boss' | string, subject: string | null | undefined): Scene | null {
  return type === 'skill' ? skillScene(subject) : type === 'boss' ? bossScene(subject) : null;
}

/** As {@link sceneFor}, from a stored metric: a skill key, or a hiscores boss key ("kreeArra"; a raid's first mode). */
export function sceneForMetric(type: 'skill' | 'boss' | string, metric: string | null | undefined): Scene | null {
  if (!metric) return null;
  return type === 'skill' ? skillScene(metricKeys(metric)[0] ?? metric) : type === 'boss' ? figure(bossImageForStatKey(metricKeys(metric)[0] ?? metric)) : null;
}
