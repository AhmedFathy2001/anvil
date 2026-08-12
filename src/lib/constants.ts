// Fun one-liners the Anvil plugin may post on a player's death (1/100 roll, otherwise
// the player's own configured message is used). `{name}` is substituted with the RSN.
// Served via GET /api/plugin/config so the pool can be edited without a plugin release;
// the plugin keeps a small baked-in fallback for when it's offline.
export const FUN_DEATH_MESSAGES: string[] = [
  "{name} has been sent to Lumbridge to think about their choices.",
  "{name} forgot to flick Protect from Magic. Classic.",
  "{name} died doing what they loved: not eating.",
  "GG {name}, the gravestone fund thanks you for your donation.",
  "{name} has logged out to the respawn screen.",
  "{name} found out the hard way that it does, in fact, hit through prayer.",
  "{name} bravely tanked one more hit than they had HP for.",
  "Press F for {name}.",
  "{name} just speedran a trip to Lumbridge.",
  "{name} would like to remind everyone that food is optional, apparently.",
];

export const SKILLS = [
  "overall",
  "attack",
  "defence",
  "strength",
  "hitpoints",
  "ranged",
  "prayer",
  "magic",
  "cooking",
  "woodcutting",
  "fletching",
  "fishing",
  "firemaking",
  "crafting",
  "smithing",
  "mining",
  "herblore",
  "agility",
  "thieving",
  "slayer",
  "farming",
  "runecraft",
  "hunter",
  "construction",
  "sailing",
] as const;

export const SKILL_LABELS: Record<string, string> = {
  overall: "Total",
  attack: "Attack",
  defence: "Defence",
  strength: "Strength",
  hitpoints: "Hitpoints",
  ranged: "Ranged",
  prayer: "Prayer",
  magic: "Magic",
  cooking: "Cooking",
  woodcutting: "Woodcutting",
  fletching: "Fletching",
  fishing: "Fishing",
  firemaking: "Firemaking",
  crafting: "Crafting",
  smithing: "Smithing",
  mining: "Mining",
  herblore: "Herblore",
  agility: "Agility",
  thieving: "Thieving",
  slayer: "Slayer",
  farming: "Farming",
  runecraft: "Runecraft",
  hunter: "Hunter",
  construction: "Construction",
  sailing: "Sailing",
};

// Extra search terms players actually type ("colosseum" for Sol Heredit, "inferno" for
// TzKal-Zuk). Lowercase — filters compare with a lowercased query. Keys mirror the
// osrs-json-hiscores boss keys; the list is alphabetical by label so new bosses must be
// inserted in place, not appended.
export interface BossOption {
  key: string;
  label: string;
  aliases?: string[];
}

export const BOSSES: BossOption[] = [
  { key: "abyssalSire", label: "Abyssal Sire", aliases: ["sire"] },
  { key: "alchemicalHydra", label: "Alchemical Hydra", aliases: ["hydra"] },
  { key: "amoxliatl", label: "Amoxliatl" },
  { key: "araxxor", label: "Araxxor", aliases: ["rax"] },
  { key: "artio", label: "Artio" },
  { key: "barrows", label: "Barrows" },
  { key: "brutus", label: "Brutus", aliases: ["demonic brutus", "ides of milk"] },
  { key: "bryophyta", label: "Bryophyta" },
  { key: "callisto", label: "Callisto" },
  { key: "calvarion", label: "Calvar'ion", aliases: ["calvarion"] },
  { key: "cerberus", label: "Cerberus", aliases: ["cerb"] },
  { key: "chambersOfXeric", label: "Chambers of Xeric", aliases: ["cox", "raids", "olm"] },
  { key: "chaosElemental", label: "Chaos Elemental" },
  { key: "chaosFanatic", label: "Chaos Fanatic" },
  { key: "commanderZilyana", label: "Commander Zilyana", aliases: ["sara", "saradomin", "zily", "gwd"] },
  { key: "corporealBeast", label: "Corporeal Beast", aliases: ["corp"] },
  { key: "corruptedGauntlet", label: "Corrupted Gauntlet", aliases: ["cg"] },
  { key: "chambersOfXericChallengeMode", label: "CoX: CM", aliases: ["chambers of xeric challenge mode", "cox cm", "raids"] },
  { key: "crazyArchaeologist", label: "Crazy Archaeologist" },
  { key: "dagannothPrime", label: "Dagannoth Prime", aliases: ["dks"] },
  { key: "dagannothRex", label: "Dagannoth Rex", aliases: ["dks"] },
  { key: "dagannothSupreme", label: "Dagannoth Supreme", aliases: ["dks"] },
  { key: "derangedArchaeologist", label: "Deranged Archaeologist" },
  { key: "doomOfMokhaiotl", label: "Doom of Mokhaiotl", aliases: ["doom", "delve"] },
  { key: "dukeSucellus", label: "Duke Sucellus", aliases: ["dt2"] },
  { key: "generalGraardor", label: "General Graardor", aliases: ["bandos", "gwd"] },
  { key: "giantMole", label: "Giant Mole", aliases: ["mole"] },
  { key: "grotesqueGuardians", label: "Grotesque Guardians", aliases: ["ggs", "dusk", "dawn"] },
  { key: "hespori", label: "Hespori" },
  { key: "kalphiteQueen", label: "Kalphite Queen", aliases: ["kq"] },
  { key: "kingBlackDragon", label: "King Black Dragon", aliases: ["kbd"] },
  { key: "kraken", label: "Kraken" },
  { key: "kreeArra", label: "Kree'Arra", aliases: ["kree", "arma", "armadyl", "gwd"] },
  { key: "krilTsutsaroth", label: "K'ril Tsutsaroth", aliases: ["kril", "zammy", "zamorak", "gwd"] },
  { key: "lunarChests", label: "Lunar Chests", aliases: ["moons", "moons of peril", "perilous moons"] },
  { key: "madAngel", label: "Mad Angel" },
  { key: "maggotKing", label: "Maggot King" },
  { key: "mimic", label: "Mimic" },
  { key: "nex", label: "Nex" },
  { key: "nightmare", label: "Nightmare" },
  { key: "obor", label: "Obor" },
  { key: "phantomMuspah", label: "Phantom Muspah", aliases: ["muspah"] },
  { key: "phosanisNightmare", label: "Phosani's Nightmare", aliases: ["phosanis"] },
  { key: "sarachnis", label: "Sarachnis" },
  { key: "scorpia", label: "Scorpia" },
  { key: "scurrius", label: "Scurrius", aliases: ["rat"] },
  { key: "skotizo", label: "Skotizo" },
  { key: "solHeredit", label: "Sol Heredit", aliases: ["colosseum", "fortis colosseum", "colo"] },
  { key: "spindel", label: "Spindel" },
  { key: "tempoross", label: "Tempoross" },
  { key: "gauntlet", label: "The Gauntlet" },
  { key: "hueycoatl", label: "The Hueycoatl", aliases: ["huey"] },
  { key: "leviathan", label: "The Leviathan", aliases: ["dt2"] },
  { key: "royalTitans", label: "The Royal Titans", aliases: ["titans"] },
  { key: "whisperer", label: "The Whisperer", aliases: ["dt2", "whisp"] },
  { key: "theatreOfBlood", label: "Theatre of Blood", aliases: ["tob", "raids"] },
  { key: "thermonuclearSmokeDevil", label: "Thermy", aliases: ["thermonuclear smoke devil"] },
  { key: "tombsOfAmascutExpertMode", label: "ToA: Expert", aliases: ["tombs of amascut expert mode", "toa expert", "raids"] },
  { key: "theatreOfBloodHardMode", label: "ToB: HM", aliases: ["theatre of blood hard mode", "tob hm", "hmt", "raids"] },
  { key: "tombsOfAmascut", label: "Tombs of Amascut", aliases: ["toa", "raids"] },
  { key: "tzKalZuk", label: "TzKal-Zuk", aliases: ["inferno", "zuk", "infernal cape"] },
  { key: "tzTokJad", label: "TzTok-Jad", aliases: ["fight caves", "jad", "fire cape"] },
  { key: "vardorvis", label: "Vardorvis", aliases: ["dt2"] },
  { key: "venenatis", label: "Venenatis" },
  { key: "vetion", label: "Vet'ion", aliases: ["vetion"] },
  { key: "vorkath", label: "Vorkath", aliases: ["vork"] },
  { key: "wintertodt", label: "Wintertodt", aliases: ["wt", "todt"] },
  { key: "yama", label: "Yama" },
  { key: "zalcano", label: "Zalcano" },
  { key: "zulrah", label: "Zulrah" },
];

// Achievement diary areas + tiers, for diary-tile selectors. A selector is the string
// "<Area> <Tier>" ("Ardougne Elite") with "Any" as a wildcard on either side ("Any Elite",
// "Wilderness Any"). Stored in tiles.targetNpcs (the diary tileType reinterprets that
// column); the plugin parses the same strings when matching completion chat lines.
export const DIARY_AREAS = [
  "Ardougne",
  "Desert",
  "Falador",
  "Fremennik",
  "Kandarin",
  "Karamja",
  "Kourend & Kebos",
  "Lumbridge & Draynor",
  "Morytania",
  "Varrock",
  "Western Provinces",
  "Wilderness",
] as const;

export const DIARY_TIERS = ["Easy", "Medium", "Hard", "Elite"] as const;

// Combat Achievement tiers, for CA-tile selectors. A selector is either an exact task name
// ("Whack-a-Mole" — unique in-game, it's what the completion chat line carries) or the wildcard
// "Any <Tier>" ("Any Master"). Stored in tiles.targetNpcs (the ca tileType reinterprets that
// column); the plugin matches the same strings against completion chat lines. Players who
// already own a task re-fire the line via the in-game "Repeat completion" setting.
export const CA_TIERS = ["Easy", "Medium", "Hard", "Elite", "Master", "Grandmaster"] as const;

// Raid difficulty variants, by the EXACT string the game's kill-count chat line carries — the
// plugin matches these verbatim (case-insensitive, punctuation-sensitive), so the colon
// conventions below are load-bearing game facts, not typos: CoX CM has NO colon
// ("...Chambers of Xeric Challenge Mode count is:"), while ToB/ToA sub-modes DO
// ("...Theatre of Blood: Hard Mode count is:").
//
// Matching semantics per tile kind:
// - kill tiles: exact name match per mode — list every variant that should count.
// - timed/deathless tiles: substring match, so the BASE name also matches every harder mode
//   (deathless additionally refuses Entry clears against a base tile); a variant string pins
//   that one mode.
export const RAID_MODE_VARIANTS: { base: string; modes: string[] }[] = [
  { base: "Chambers of Xeric", modes: ["Chambers of Xeric Challenge Mode"] },
  { base: "Theatre of Blood", modes: ["Theatre of Blood: Entry Mode", "Theatre of Blood: Hard Mode"] },
  { base: "Tombs of Amascut", modes: ["Tombs of Amascut: Entry Mode", "Tombs of Amascut: Expert Mode"] },
];

// Same idea for skills — shorthand players type into filter boxes. Lowercase.
export const SKILL_ALIASES: Record<string, string[]> = {
  attack: ["atk"],
  strength: ["str"],
  defence: ["def", "defense"],
  hitpoints: ["hp"],
  runecraft: ["runecrafting", "rc"],
  woodcutting: ["wc"],
  firemaking: ["fm"],
  construction: ["con"],
};

// ── Efficiency metrics (EHP / EHB) ─────────────────────────────────────────────────────────────
// A third kind of weekly competition, alongside skill (SOTW) and boss (BOTW): rank by efficient
// hours gained rather than by one skill's XP or one boss's KC. It's the only metric that measures a
// whole week of play in one number — an hour at Zulrah and an hour of Runecrafting both count.
//
// Values are computed by src/lib/efficiency.ts and stored as MILLI-hours: weeklyParticipants keeps
// baseline/current in integer columns, and 12.4 EHB rounded to 12 would throw away most of a week's
// gain. Everything that reads these for display divides by EFFICIENCY_SCALE.
export const EFFICIENCY_SCALE = 1000;

export const EFFICIENCY_METRICS: { key: string; label: string; blurb: string }[] = [
  {
    key: "ehp",
    label: "EHP",
    blurb: "Efficient hours played — XP converted to time at the best known rates, so a slow skill counts for more than a fast one.",
  },
  {
    key: "ehb",
    label: "EHB",
    blurb: "Efficient hours bossed — boss kills converted to time, so 22 Barrows chests and 3.5 Chambers both read as an hour.",
  },
];

export const EFFICIENCY_LABELS: Record<string, string> = Object.fromEntries(
  EFFICIENCY_METRICS.map((m) => [m.key, m.label]),
);

/**
 * What to call a weekly competition of this type. Efficiency is a THIRD type, not a fallback —
 * `type === 'skill' ? SOTW : BOTW` labels every EHP/EHB week "Boss of the Week", which is what the
 * home page and the plugin's clog tab both did.
 */
export function weeklyKindLabel(type: string): string {
  if (type === 'skill') return 'Skill of the Week';
  return type === 'efficiency' ? 'Efficiency of the Week' : 'Boss of the Week';
}

/** Milli-hours → a display string. Two decimals: a week's honest gain is often under 10 hours. */
export function formatEfficiencyHours(milli: number): string {
  const hours = milli / EFFICIENCY_SCALE;
  if (Math.abs(hours) >= 1000) return `${(hours / 1000).toFixed(1)}K`;
  return hours.toFixed(2);
}
