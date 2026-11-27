// Which raid a death happened in. A current plugin sends it with the death (moment.raid, read off
// the game's raid varbits); for an older one, from the NPC the plugin named around it:
//
// Inside a raid the plugin names the monster that killed you (Great Olm, Verzik Vitur, Ba-Ba, a
// Deathly mage), or what you were fighting when nothing was targeting you (an acid pool at Olm),
// never the raid. A Boss Rush over a raid has to count those deaths as the raid's, so this maps the
// raid's own monsters back to it. Read before lib/deathSource cleans the name up: Kephri's scarabs
// linger as the named killer for the rest of a Tombs run, and the feed blanks them, but they still
// say which raid it was.
//
// Hand-kept: the wiki drop data has no list of a raid's monsters (most of them drop nothing). Names
// are matched lower-case, whole or as the start of the name ("Great Olm (Left claw)", "Baboon
// Brawler"). A name that is also something outside a raid stays off the list (Lizardman shaman: Kebos,
// Molch; Scarab swarm: Sophanem), so an older client's death there is never guessed into a raid.
//
// Pure: the moments ingest and the tests read it.

/** The raids, each with every hiscores key its modes count under. */
export const RAID_FAMILIES = {
  cox: ['chambersOfXeric', 'chambersOfXericChallengeMode'],
  tob: ['theatreOfBlood', 'theatreOfBloodHardMode'],
  toa: ['tombsOfAmascut', 'tombsOfAmascutExpertMode'],
} as const;
export type RaidFamily = keyof typeof RAID_FAMILIES;

const NPCS: Record<RaidFamily, string[]> = {
  cox: [
    'great olm',
    'tekton',
    'vasa nistirio',
    'glowing crystal',
    'vespula',
    'abyssal portal',
    'lux grub',
    'vespine soldier',
    'muttadile',
    'vanguard',
    'ice demon',
    'skeletal mystic',
    'deathly ranger',
    'deathly mage',
    'scavenger beast',
    'scavenger runt',
    'jewelled crab',
    'corrupted scavenger',
  ],
  tob: [
    'the maiden of sugadinti',
    'blood spawn',
    'pestilent bloat',
    'nylocas',
    'sotetseg',
    'xarpus',
    'verzik vitur',
  ],
  toa: [
    'ba-ba',
    'baboon',
    'kephri',
    'agile scarab',
    'arcane scarab',
    'spitting scarab',
    'soldier scarab',
    'akkha',
    'zebak',
    "tumeken's warden",
    "elidinis' warden",
    'obelisk',
    'core',
    'energy siphon',
    "het's seal",
  ],
};

export const isRaidFamily = (v: unknown): v is RaidFamily => typeof v === 'string' && v in RAID_FAMILIES;

/** The raid this NPC belongs to, or null. */
export function raidOfNpc(name: unknown): RaidFamily | null {
  if (typeof name !== 'string') return null;
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!n) return null;
  for (const [family, names] of Object.entries(NPCS) as [RaidFamily, string[]][]) {
    if (names.some((x) => n === x || n.startsWith(`${x} `) || n.startsWith(`${x}(`))) return family;
  }
  return null;
}

/** The hiscores keys a raid counts under: a rush over either mode counts its deaths. */
export function raidKeys(family: string | null | undefined): readonly string[] {
  return family && family in RAID_FAMILIES ? RAID_FAMILIES[family as RaidFamily] : [];
}
