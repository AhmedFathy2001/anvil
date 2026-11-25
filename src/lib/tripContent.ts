// The content the pre-trip check knows (lib/tripCheck), and the map regions that are its banks or
// lobbies. PURE. The plugin is handed TRIP_REGION_IDS on /api/plugin/config (`tripRegions`) and asks
// for the 'trip' view when the bank closes in one of them (pluginUi/tripView).
//
// Region ids are the game's (x >> 6) << 8 | (y >> 6), compared by the plugin against
// WorldPoint.fromLocalInstance(...).getRegionID(), so an instanced area would need its template
// region. Each id below was worked out from the OSRS Wiki's map coordinates for the bank or lobby
// (the coordinates are in the comment); see the PR for which still want an in-game look.
//
// A content's setup comes from, in order: the player's own saved setup (lib/tripSetups), the guide
// named by `guide` (its best tier that fits them), else Anvil's own calc from their bank against
// `targets` (monster keys of the DPS dataset, "Name#Version").

export interface TripContent {
  key: string;
  /** "Tombs of Amascut" */
  name: string;
  /** "ToA": the overlay's title is 200px wide. */
  short: string;
  /** Library guide slug with a gear block, when there is one. */
  guide?: string;
  /** DPS dataset monster keys for the calc (and for a guide whose block names none we know). */
  targets: string[];
  /** Bossing where a spec weapon belongs in the inventory. */
  spec?: boolean;
}

export const TRIP_CONTENT: TripContent[] = [
  { key: 'toa', name: 'Tombs of Amascut', short: 'ToA', guide: 'tombs-of-amascut-entry', spec: true, targets: ['Akkha', 'Ba-Ba', 'Kephri#Shielded', 'Zebak#Normal', "Tumeken's Warden#Damaged"] },
  { key: 'tob', name: 'Theatre of Blood', short: 'ToB', spec: true, targets: ['The Maiden of Sugadinti#Normal', 'Pestilent Bloat#Normal', 'Sotetseg#Normal', 'Xarpus', 'Verzik Vitur#Phase 3'] },
  { key: 'cox', name: 'Chambers of Xeric', short: 'CoX', guide: 'chambers-of-xeric-learner', spec: true, targets: ['Tekton#Normal', 'Vespula#Normal', 'Vasa Nistirio#Normal', 'Great Olm#Head (Normal)', 'Great Olm#Left claw (Normal)'] },
  { key: 'vorkath', name: 'Vorkath', short: 'Vorkath', guide: 'vorkath-guide', targets: ['Vorkath#Post-quest'] },
  { key: 'zulrah', name: 'Zulrah', short: 'Zulrah', targets: ['Zulrah#Serpentine', 'Zulrah#Magma', 'Zulrah#Tanzanite'] },
  { key: 'barrows', name: 'Barrows', short: 'Barrows', guide: 'barrows-beginners', targets: ['Ahrim the Blighted', 'Dharok the Wretched', 'Karil the Tainted', 'Verac the Defiled'] },
  { key: 'nex', name: 'Nex', short: 'Nex', spec: true, targets: ['Nex'] },
];

export interface TripRegion {
  /** "the ToA lobby": said as "picked from the ToA lobby". */
  name: string;
  content: string;
  /**
   * A bank many trips start from (Ferox Enclave): the content is only picked when the inventory or
   * worn gear holds one of these, else nothing is checked there.
   */
  cues?: number[];
  /** No bank here: the check only runs when asked for (the plugin's bank-close never fires). */
  noBank?: true;
}

/** Spade: the one thing every Barrows trip carries. */
export const SPADE = 952;

export const TRIP_REGIONS: Record<number, TripRegion> = {
  // Jaltevas: the lobby's rewards niche and cavity are at 3370,9114 / 3367,9114.
  13454: { name: 'the ToA lobby', content: 'toa' },
  // Ver Sinhaza bank 3648–3654, 3204–3208.
  14642: { name: 'Ver Sinhaza', content: 'tob' },
  // Mount Quidamortem, the raid's entrance and bank chest at 1245,3557.
  4919: { name: 'Mount Quidamortem', content: 'cox' },
  // Ungael 2272,4064 (Vorkath 2269,4062).
  9023: { name: 'Ungael', content: 'vorkath', noBank: true },
  // Zul-Andra 2193,3060.
  8751: { name: 'Zul-Andra', content: 'zulrah', noBank: true },
  // Ferox Enclave's banker 3135,3629: Barrows only with a spade along.
  12344: { name: 'Ferox Enclave', content: 'barrows', cues: [SPADE] },
  // The Barrows 3565,3288.
  14131: { name: 'the Barrows', content: 'barrows', noBank: true },
  // Ashuelot Reis, the Ancient Prison's banker, 2904,5205.
  11601: { name: 'the Nex bank', content: 'nex' },
};

/** Every trip region id, for the plugin config's `tripRegions`. */
export const TRIP_REGION_IDS: number[] = Object.keys(TRIP_REGIONS).map(Number).sort((a, b) => a - b);

export const tripContent = (key: string | null | undefined): TripContent | null => TRIP_CONTENT.find((c) => c.key === key) ?? null;

/**
 * The content a region picks, or null. A shared bank (cues) picks it only when `held` (inventory and
 * worn ids) has a cue item.
 */
export function contentForRegion(region: number, held: ReadonlySet<number>): TripContent | null {
  const r = TRIP_REGIONS[region];
  if (!r) return null;
  if (r.cues?.length && !r.cues.some((id) => held.has(id))) return null;
  return tripContent(r.content);
}

/** A monster picked by hand (the slayer case, any boss without a guide): content key "m:<monster key>". */
export const MONSTER_PREFIX = 'm:';
export function monsterContent(monsterKey: string): TripContent {
  const name = monsterKey.split('#')[0];
  const short = name.length > 16 ? `${name.slice(0, 15).trim()}…` : name;
  return { key: `${MONSTER_PREFIX}${monsterKey}`, name, short, targets: [monsterKey] };
}

/** A content key from the view's args: a known content, or "m:<monster>" for one picked by hand. */
export function contentFromKey(key: string | null | undefined): TripContent | null {
  if (!key) return null;
  if (key.startsWith(MONSTER_PREFIX)) {
    const m = key.slice(MONSTER_PREFIX.length).trim();
    return m && m.length <= 80 ? monsterContent(m) : null;
  }
  return tripContent(key);
}
