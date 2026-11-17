// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Pet groups for the tile editor's one-click fill: "any pet", "a skilling pet", "a Slayer boss pet"…
//
// Ids and names come from the generated collection-log dataset (src/data/clog.json, its "All Pets"
// page), not from memory, and tests/pet-groups.test.ts fails the build if one drifts or if 'all'
// stops matching that page. Kept as a literal list rather than read from clog.json so the editor
// (a client component) doesn't ship the whole dataset.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface PetGroup {
  key: string;
  label: string;
  blurb: string;
  items: { id: number; name: string }[];
}

export const PET_GROUPS: PetGroup[] = [
  {
    key: "all",
    label: "All pets",
    blurb: "Every pet in the collection log.",
    items: [
      { id: 11995, name: "Pet chaos elemental" },
      { id: 12643, name: "Pet dagannoth supreme" },
      { id: 12644, name: "Pet dagannoth prime" },
      { id: 12645, name: "Pet dagannoth rex" },
      { id: 12646, name: "Baby mole" },
      { id: 12647, name: "Kalphite princess" },
      { id: 12648, name: "Pet smoke devil" },
      { id: 12649, name: "Pet kree'arra" },
      { id: 12650, name: "Pet general graardor" },
      { id: 12651, name: "Pet zilyana" },
      { id: 12652, name: "Pet k'ril tsutsaroth" },
      { id: 12653, name: "Prince black dragon" },
      { id: 12655, name: "Pet kraken" },
      { id: 12703, name: "Pet penance queen" },
      { id: 12816, name: "Pet dark core" },
      { id: 12921, name: "Pet snakeling" },
      { id: 13071, name: "Chompy chick" },
      { id: 13177, name: "Venenatis spiderling" },
      { id: 13178, name: "Callisto cub" },
      { id: 13179, name: "Vet'ion jr." },
      { id: 13181, name: "Scorpia's offspring" },
      { id: 13225, name: "Tzrek-jad" },
      { id: 13247, name: "Hellpuppy" },
      { id: 13262, name: "Abyssal orphan" },
      { id: 13320, name: "Heron" },
      { id: 13321, name: "Rock golem" },
      { id: 13322, name: "Beaver" },
      { id: 13324, name: "Baby chinchompa" },
      { id: 19730, name: "Bloodhound" },
      { id: 20659, name: "Giant squirrel" },
      { id: 20661, name: "Tangleroot" },
      { id: 20663, name: "Rocky" },
      { id: 20665, name: "Rift guardian" },
      { id: 20693, name: "Phoenix" },
      { id: 20851, name: "Olmlet" },
      { id: 21273, name: "Skotos" },
      { id: 21291, name: "Jal-nib-rek" },
      { id: 21509, name: "Herbi" },
      { id: 21748, name: "Noon" },
      { id: 21992, name: "Vorki" },
      { id: 22473, name: "Lil' zik" },
      { id: 22746, name: "Ikkle hydra" },
      { id: 23495, name: "Sraracha" },
      { id: 23757, name: "Youngllef" },
      { id: 23760, name: "Smolcano" },
      { id: 24491, name: "Little nightmare" },
      { id: 25348, name: "Lil' creator" },
      { id: 25602, name: "Tiny tempor" },
      { id: 26348, name: "Nexling" },
      { id: 26901, name: "Abyssal protector" },
      { id: 27352, name: "Tumeken's guardian" },
      { id: 27590, name: "Muphin" },
      { id: 28246, name: "Wisp" },
      { id: 28248, name: "Butch" },
      { id: 28250, name: "Baron" },
      { id: 28252, name: "Lil'viathan" },
      { id: 28801, name: "Scurry" },
      { id: 28960, name: "Smol heredit" },
      { id: 28962, name: "Quetzin" },
      { id: 29836, name: "Nid" },
      { id: 30152, name: "Huberte" },
      { id: 30154, name: "Moxi" },
      { id: 30622, name: "Bran" },
      { id: 30888, name: "Yami" },
      { id: 31130, name: "Dom" },
      { id: 31283, name: "Soup" },
      { id: 31285, name: "Gull (pet)" },
      { id: 33124, name: "Beef" },
      { id: 33642, name: "Maggot marquess" },
      { id: 34040, name: "Mr mcgroot" },
      { id: 34042, name: "Aggy" },
    ],
  },
  {
    key: "boss",
    label: "Boss pets",
    blurb: "Every pet from a boss or raid \u2014 skilling bosses (Wintertodt, Tempoross, Zalcano) excluded.",
    items: [
      { id: 11995, name: "Pet chaos elemental" },
      { id: 12643, name: "Pet dagannoth supreme" },
      { id: 12644, name: "Pet dagannoth prime" },
      { id: 12645, name: "Pet dagannoth rex" },
      { id: 12646, name: "Baby mole" },
      { id: 12647, name: "Kalphite princess" },
      { id: 12648, name: "Pet smoke devil" },
      { id: 12649, name: "Pet kree'arra" },
      { id: 12650, name: "Pet general graardor" },
      { id: 12651, name: "Pet zilyana" },
      { id: 12652, name: "Pet k'ril tsutsaroth" },
      { id: 12653, name: "Prince black dragon" },
      { id: 12655, name: "Pet kraken" },
      { id: 12816, name: "Pet dark core" },
      { id: 12921, name: "Pet snakeling" },
      { id: 13177, name: "Venenatis spiderling" },
      { id: 13178, name: "Callisto cub" },
      { id: 13179, name: "Vet'ion jr." },
      { id: 13181, name: "Scorpia's offspring" },
      { id: 13225, name: "Tzrek-jad" },
      { id: 13247, name: "Hellpuppy" },
      { id: 13262, name: "Abyssal orphan" },
      { id: 20851, name: "Olmlet" },
      { id: 21273, name: "Skotos" },
      { id: 21291, name: "Jal-nib-rek" },
      { id: 21748, name: "Noon" },
      { id: 21992, name: "Vorki" },
      { id: 22473, name: "Lil' zik" },
      { id: 22746, name: "Ikkle hydra" },
      { id: 23495, name: "Sraracha" },
      { id: 23757, name: "Youngllef" },
      { id: 24491, name: "Little nightmare" },
      { id: 26348, name: "Nexling" },
      { id: 27352, name: "Tumeken's guardian" },
      { id: 27590, name: "Muphin" },
      { id: 28246, name: "Wisp" },
      { id: 28248, name: "Butch" },
      { id: 28250, name: "Baron" },
      { id: 28252, name: "Lil'viathan" },
      { id: 28801, name: "Scurry" },
      { id: 28960, name: "Smol heredit" },
      { id: 29836, name: "Nid" },
      { id: 30152, name: "Huberte" },
      { id: 30154, name: "Moxi" },
      { id: 30622, name: "Bran" },
      { id: 30888, name: "Yami" },
      { id: 31130, name: "Dom" },
      { id: 31285, name: "Gull (pet)" },
      { id: 33124, name: "Beef" },
      { id: 33642, name: "Maggot marquess" },
      { id: 34042, name: "Aggy" },
    ],
  },
  {
    key: "skilling",
    label: "Skilling pets",
    blurb: "Skilling pets, including the skilling bosses and Guardians of the Rift.",
    items: [
      { id: 13322, name: "Beaver" },
      { id: 13320, name: "Heron" },
      { id: 13321, name: "Rock golem" },
      { id: 13324, name: "Baby chinchompa" },
      { id: 20659, name: "Giant squirrel" },
      { id: 20661, name: "Tangleroot" },
      { id: 20663, name: "Rocky" },
      { id: 20665, name: "Rift guardian" },
      { id: 20693, name: "Phoenix" },
      { id: 25602, name: "Tiny tempor" },
      { id: 23760, name: "Smolcano" },
      { id: 21509, name: "Herbi" },
      { id: 26901, name: "Abyssal protector" },
      { id: 28962, name: "Quetzin" },
      { id: 31283, name: "Soup" },
      { id: 34040, name: "Mr mcgroot" },
    ],
  },
  {
    key: "slayer",
    label: "Slayer boss pets",
    blurb: "Pets of the Slayer-locked bosses.",
    items: [
      { id: 13262, name: "Abyssal orphan" },
      { id: 22746, name: "Ikkle hydra" },
      { id: 13247, name: "Hellpuppy" },
      { id: 21748, name: "Noon" },
      { id: 12655, name: "Pet kraken" },
      { id: 12648, name: "Pet smoke devil" },
      { id: 29836, name: "Nid" },
    ],
  },
  {
    key: "gwd",
    label: "God Wars pets",
    blurb: "The four generals and Nex.",
    items: [
      { id: 12650, name: "Pet general graardor" },
      { id: 12651, name: "Pet zilyana" },
      { id: 12649, name: "Pet kree'arra" },
      { id: 12652, name: "Pet k'ril tsutsaroth" },
      { id: 26348, name: "Nexling" },
    ],
  },
  {
    key: "raids",
    label: "Raid pets",
    blurb: "Chambers of Xeric, Theatre of Blood, Tombs of Amascut.",
    items: [
      { id: 20851, name: "Olmlet" },
      { id: 22473, name: "Lil' zik" },
      { id: 27352, name: "Tumeken's guardian" },
    ],
  },
  {
    key: "wilderness",
    label: "Wilderness pets",
    blurb: "Wilderness bosses.",
    items: [
      { id: 11995, name: "Pet chaos elemental" },
      { id: 13177, name: "Venenatis spiderling" },
      { id: 13178, name: "Callisto cub" },
      { id: 13179, name: "Vet'ion jr." },
      { id: 13181, name: "Scorpia's offspring" },
      { id: 12653, name: "Prince black dragon" },
    ],
  },
  {
    key: "dt2",
    label: "DT2 pets",
    blurb: "Desert Treasure II bosses.",
    items: [
      { id: 28250, name: "Baron" },
      { id: 28248, name: "Butch" },
      { id: 28252, name: "Lil'viathan" },
      { id: 28246, name: "Wisp" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Where each pet comes from, as hiscores boss keys (lib/constants BOSSES): what a pet hunt adds up
// for "kills since the hunt started".
//
// Read off the collection log: a boss pet sits on its boss's own page in src/data/clog.json, and the
// page names the boss. A page that covers two bosses ("Callisto and Artio"), both modes of a raid, or
// an activity the hiscores list under its boss ("The Inferno" is TzKal-Zuk) gives every key that can
// roll the pet. tests/pet-groups.test.ts checks every key is a real BOSSES key, that every key a
// pet's page names by label is here, and that no pet is listed without such a page.
//
// A pet that is NOT here has no kill count on the hiscores: the skilling pets, and the ones from
// minigames and clues (Pet penance queen, Lil' creator, Abyssal protector, Bloodhound…).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export const PET_BOSS_KEYS: Readonly<Record<number, readonly string[]>> = {
  11995: ["chaosElemental", "chaosFanatic"], // Pet chaos elemental
  12643: ["dagannothSupreme"], // Pet dagannoth supreme
  12644: ["dagannothPrime"], // Pet dagannoth prime
  12645: ["dagannothRex"], // Pet dagannoth rex
  12646: ["giantMole"], // Baby mole
  12647: ["kalphiteQueen"], // Kalphite princess
  12648: ["thermonuclearSmokeDevil"], // Pet smoke devil
  12649: ["kreeArra"], // Pet kree'arra
  12650: ["generalGraardor"], // Pet general graardor
  12651: ["commanderZilyana"], // Pet zilyana
  12652: ["krilTsutsaroth"], // Pet k'ril tsutsaroth
  12653: ["kingBlackDragon"], // Prince black dragon
  12655: ["kraken"], // Pet kraken
  12816: ["corporealBeast"], // Pet dark core
  12921: ["zulrah"], // Pet snakeling
  13177: ["venenatis", "spindel"], // Venenatis spiderling
  13178: ["callisto", "artio"], // Callisto cub
  13179: ["vetion", "calvarion"], // Vet'ion jr.
  13181: ["scorpia"], // Scorpia's offspring
  13225: ["tzTokJad"], // Tzrek-jad (The Fight Caves)
  13247: ["cerberus"], // Hellpuppy
  13262: ["abyssalSire"], // Abyssal orphan
  20693: ["wintertodt"], // Phoenix
  20851: ["chambersOfXeric", "chambersOfXericChallengeMode"], // Olmlet
  21273: ["skotizo"], // Skotos
  21291: ["tzKalZuk"], // Jal-nib-rek (The Inferno)
  21748: ["grotesqueGuardians"], // Noon
  21992: ["vorkath"], // Vorki
  22473: ["theatreOfBlood", "theatreOfBloodHardMode"], // Lil' zik
  22746: ["alchemicalHydra"], // Ikkle hydra
  23495: ["sarachnis"], // Sraracha
  23757: ["gauntlet", "corruptedGauntlet"], // Youngllef
  23760: ["zalcano"], // Smolcano
  24491: ["nightmare", "phosanisNightmare"], // Little nightmare
  25602: ["tempoross"], // Tiny tempor
  26348: ["nex"], // Nexling
  27352: ["tombsOfAmascut", "tombsOfAmascutExpertMode"], // Tumeken's guardian
  27590: ["phantomMuspah"], // Muphin
  28246: ["whisperer"], // Wisp
  28248: ["vardorvis"], // Butch
  28250: ["dukeSucellus"], // Baron
  28252: ["leviathan"], // Lil'viathan
  28801: ["scurrius"], // Scurry
  28960: ["solHeredit"], // Smol heredit (Fortis Colosseum)
  29836: ["araxxor"], // Nid
  30152: ["hueycoatl"], // Huberte
  30154: ["amoxliatl"], // Moxi
  30622: ["royalTitans"], // Bran
  30888: ["yama"], // Yami
  31130: ["doomOfMokhaiotl"], // Dom
  31285: ["shellbaneGryphon"], // Gull (pet)
  33124: ["brutus"], // Beef
  33642: ["maggotKing"], // Maggot marquess
  34042: ["madAngel"], // Aggy
};
