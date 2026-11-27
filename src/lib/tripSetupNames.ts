// Names and tags of a player's saved trip setups (lib/tripSetups). PURE: the panel and the site's
// My setups page both read it. A setup saved from the panel is named after the first preset tag of its
// trip the player hasn't used yet ("CoX Solo", then "CoX Trio"), else "Setup N"; the player renames it
// on the site (24 characters at most).

import { MONSTER_PREFIX } from './tripContent';

/** The longest name a setup may have: what the plugin's dropdown fits. */
export const SETUP_NAME_MAX = 24;

/** Preset tags per trip key, or per boss name for a boss picked by hand ("m:Yama…"). */
const PRESETS: Record<string, readonly string[]> = {
  cox: ['Solo', 'Trio', 'CM'],
  tob: ['Solo', 'Duo', 'Trio', '4-5', 'Entry', 'HM'],
  toa: ['Solo', 'Group', 'Expert'],
  yama: ['Contract 1', 'Contract 2'],
};

/** The boss a hand-picked key names, lower case: "m:Yama#Normal" → "yama". */
const bossName = (content: string): string | null =>
  content.startsWith(MONSTER_PREFIX) ? content.slice(MONSTER_PREFIX.length).split('#')[0].trim().toLowerCase() || null : null;

/** The preset tags a trip's setups can carry (empty: none, the setups are "Setup N"). */
export function presetTags(content: string): readonly string[] {
  return PRESETS[content] ?? PRESETS[bossName(content) ?? ''] ?? [];
}

/** A tag from a request: one of the trip's presets (null clears it), else undefined (refused). */
export function cleanTag(content: string, v: unknown): string | null | undefined {
  if (v === null || v === '') return null;
  return typeof v === 'string' && presetTags(content).includes(v) ? v : undefined;
}

/** A name from a request: trimmed, one line, plain text, 1–24 characters; null when it can't be one. */
export function cleanSetupName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return s.length >= 1 && s.length <= SETUP_NAME_MAX ? s : null;
}

/**
 * The name and tag for a new setup of `content`: the first preset not used yet, "CoX Trio"; else
 * "Setup N" counting the ones the trip has. `short` is the trip's short name ("CoX", "Yama").
 */
export function newSetupName(content: string, short: string, existing: readonly { name: string; tag: string | null }[]): { name: string; tag: string | null } {
  const used = new Set(existing.map((s) => s.tag));
  const names = new Set(existing.map((s) => s.name.toLowerCase()));
  for (const tag of presetTags(content)) {
    const name = `${short} ${tag}`.slice(0, SETUP_NAME_MAX);
    if (!used.has(tag) && !names.has(name.toLowerCase())) return { name, tag };
  }
  for (let n = existing.length + 1; ; n++) {
    const name = `Setup ${n}`;
    if (!names.has(name.toLowerCase())) return { name, tag: null };
  }
}
