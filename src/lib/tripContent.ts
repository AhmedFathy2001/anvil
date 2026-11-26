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
  /** Food and a prayer restore are checked as packed, whatever the setup (lib/tripCheck 'supplies'). */
  basics?: boolean;
  /**
   * Items carried for this trip and nothing else: worn or packed, the trip is the next-trip target
   * (lib/tripTarget 'carried'), checked at any bank. `carrying` says it: "carrying a waystone".
   */
  tripItems?: { ids: number[]; carrying: string };
  /**
   * Where the trip has begun: standing in one of these regions (template ids inside an instance) takes
   * the overlay's warning down. Only ever used to hide our own warning, never to say anything there.
   */
  fightRegions?: number[];
  /** Any instance counts as the fight area too: a raid entered from its lobby or bank. */
  instance?: true;
}

/** Mokhaiotl waystone: a one-use teleport to the Doom's ruins, carried for nothing else. */
export const MOKHAIOTL_WAYSTONE = 31099;

export const TRIP_CONTENT: TripContent[] = [
  { key: 'toa', name: 'Tombs of Amascut', short: 'ToA', guide: 'tombs-of-amascut-entry', spec: true, instance: true, targets: ['Akkha', 'Ba-Ba', 'Kephri#Shielded', 'Zebak#Normal', "Tumeken's Warden#Damaged"] },
  { key: 'tob', name: 'Theatre of Blood', short: 'ToB', spec: true, instance: true, targets: ['The Maiden of Sugadinti#Normal', 'Pestilent Bloat#Normal', 'Sotetseg#Normal', 'Xarpus', 'Verzik Vitur#Phase 3'] },
  { key: 'cox', name: 'Chambers of Xeric', short: 'CoX', guide: 'chambers-of-xeric-learner', spec: true, instance: true, targets: ['Tekton#Normal', 'Vespula#Normal', 'Vasa Nistirio#Normal', 'Great Olm#Head (Normal)', 'Great Olm#Left claw (Normal)'] },
  // Ungael (2272,4064) and Vorkath's lair (its template, 2269,4062) are both region 9023.
  { key: 'vorkath', name: 'Vorkath', short: 'Vorkath', guide: 'vorkath-guide', targets: ['Vorkath#Post-quest'], fightRegions: [9023] },
  // Zulrah's shrine 2268,3070 (the instance's template); Zul-Andra itself (8751) is where players bank.
  { key: 'zulrah', name: 'Zulrah', short: 'Zulrah', targets: ['Zulrah#Serpentine', 'Zulrah#Magma', 'Zulrah#Tanzanite'], fightRegions: [9007] },
  // The Barrows 3565,3288 and the crypts 3551,9695.
  { key: 'barrows', name: 'Barrows', short: 'Barrows', guide: 'barrows-beginners', targets: ['Ahrim the Blighted', 'Dharok the Wretched', 'Karil the Tainted', 'Verac the Defiled'], fightRegions: [14131, 14231] },
  { key: 'nex', name: 'Nex', short: 'Nex', spec: true, targets: ['Nex'] },
  // Every delve has the same stats but its hitpoints; delve 8 stands for the deep delves too.
  // The waystone teleports to the ruins from anywhere: carrying one means a Doom trip, banked wherever.
  { key: 'doom', name: 'Doom of Mokhaiotl', short: 'Doom', spec: true, basics: true, targets: ['Doom of Mokhaiotl#Delve 8'], tripItems: { ids: [MOKHAIOTL_WAYSTONE], carrying: 'carrying a waystone' }, fightRegions: [5268] },
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
  // The Ruins of Mokhaiotl 1311,9520 (the waystone lands at 1311,9497), on the way to the Doom's
  // lobby. No bank down there.
  5268: { name: 'the Ruins of Mokhaiotl', content: 'doom', noBank: true },
};

/** Every trip region id, for the plugin config's `tripRegions`. */
export const TRIP_REGION_IDS: number[] = Object.keys(TRIP_REGIONS).map(Number).sort((a, b) => a - b);

/** Each trip region's trip, short, for the config's `tripNames`: the overlay's "Checking ToA…" at once. */
export const TRIP_NAMES: Record<number, string> = Object.fromEntries(TRIP_REGION_IDS.map((r) => [r, TRIP_CONTENT.find((c) => c.key === TRIP_REGIONS[r].content)?.short ?? 'your trip']));

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
  // The overlay's title is 200px: "Doom of Mokhaiotl" → "Doom", never a name cut off mid-word.
  const lead = name.split(/ (?:of|the) /)[0];
  const short = name.length <= 16 ? name : lead.length <= 16 ? lead : name.split(' ')[0];
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

/**
 * What the calc's answer is worth, said on the card. A raid's (several bosses) is a rough fallback:
 * one worn set and switches from the bank can't know the room-by-room roles a raid really needs.
 */
export const calcSourceLine = (content: Pick<TripContent, 'name' | 'short' | 'targets'>): string =>
  content.targets.length > 1
    ? `Rough: worked out from your bank. A ${content.short} guide for your role will be more accurate.`
    : `No setup saved for ${content.name}: compared with the best your bank can make`;
