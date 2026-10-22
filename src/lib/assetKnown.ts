// Wiki files the app itself references — built server-side, never from a request.
//
// The /img miss throttle has a global ceiling so a flood of junk names cannot hammer the wiki, but a
// few clients burning that ceiling must not blank the art every page actually draws. Names in this
// set skip the GLOBAL cap (the per-IP cap still applies); everything else — unknown names, item ids —
// counts against both. Missing a name here only means it shares the global budget; nothing breaks.

import { datasetWikiFiles, normalizeWikiFile, type AssetRef } from '@/lib/assetUrls';
import { SKILLS } from '@/lib/constants';

/** Hand-named wiki files in lib/tileIcons, landing/TileKinds, ProfileTabs, the og cards, lib/leagues. */
const STATIC_WIKI_FILES = [
  'Stats_icon.png',
  'Combat_icon.png',
  'Skull_(status)_icon.png',
  'Achievement_Diaries_icon.png',
  'Combat_Achievements_icon.png',
  'League_icon.png',
];

/** The equipment-slot silhouettes (components/gear/EquipmentPanel SLOT_LABEL). */
const SLOT_GLYPHS = ['Head', 'Cape', 'Neck', 'Ammo', 'Weapon', 'Body', 'Shield', 'Legs', 'Hands', 'Feet', 'Ring'].map(
  (s) => `${s}_slot.png`,
);

const KNOWN: ReadonlySet<string> = (() => {
  const set = new Set<string>(datasetWikiFiles());
  for (const skill of SKILLS) {
    if (skill === 'overall') continue;
    set.add(`${skill.charAt(0).toUpperCase()}${skill.slice(1)}_icon.png`);
  }
  for (const f of [...STATIC_WIKI_FILES, ...SLOT_GLYPHS]) {
    const n = normalizeWikiFile(f);
    if (n) set.add(n);
  }
  return set;
})();

/** Is this an asset the app itself draws (so it bypasses the global miss ceiling)? */
export function isKnownAsset(ref: AssetRef): boolean {
  return ref.kind === 'wiki' && KNOWN.has(ref.file);
}
