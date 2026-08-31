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
  // Sailing's gryphon Slayer boss (Nov 2025). On the hiscores — osrs-json-hiscores has carried the
  // column since the release — but it was missed on the last BOSSES bump, so until now no tile
  // could track it and the stats sweep had nothing to look up.
  { key: "shellbaneGryphon", label: "Shellbane Gryphon", aliases: ["gryphon", "shellbane"] },
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

// Agility courses, by the EXACT name the game's lap-counter chat line carries — "Your
// <name> lap count is: N". Same load-bearing-verbatim rule as RAID_MODE_VARIANTS above:
// the course name is NOT the wiki's page title. The game drops the trailing "Course" on
// most of them ("Gnome Stronghold Agility", "Ardougne Rooftop"), keeps it on the newer
// ones ("Prifddinas Agility Course"), and parenthesises the Colossal Wyrm tiers. These
// strings are the canonical counter names RuneLite's own !kc table resolves to.
//
// Stored in tiles.targetNpcs (the lap tileType reinterprets that column, like diary/ca);
// the plugin matches them against the lap line via the same kill-count parser it uses for
// boss KC, so laps are counted live and forward-only — laps banked before the event, or
// run with the client closed, never count.
//
// The Hallowed Sepulchre is agility content too, but it announces floors rather than laps, so it
// lives in SEPULCHRE_TARGETS below rather than here.
//
// Deliberately absent: Brimhaven Agility Arena — counts tickets, not laps ("Your Agility Arena
// Total Ticket count is: N"), and the plugin's parser doesn't know that counter word.
export const AGILITY_COURSES: { name: string; label: string; level: number }[] = [
  // Rooftop courses (Marks of Grace) — the game says "<Town> Rooftop", no "Course".
  { name: "Draynor Village Rooftop", label: "Draynor Village Rooftop", level: 10 },
  { name: "Al Kharid Rooftop", label: "Al Kharid Rooftop", level: 20 },
  { name: "Varrock Rooftop", label: "Varrock Rooftop", level: 30 },
  { name: "Canifis Rooftop", label: "Canifis Rooftop", level: 40 },
  { name: "Falador Rooftop", label: "Falador Rooftop", level: 50 },
  { name: "Seers' Village Rooftop", label: "Seers' Village Rooftop", level: 60 },
  { name: "Pollnivneach Rooftop", label: "Pollnivneach Rooftop", level: 70 },
  { name: "Rellekka Rooftop", label: "Rellekka Rooftop", level: 80 },
  { name: "Ardougne Rooftop", label: "Ardougne Rooftop", level: 90 },
  // Everything else with a lap counter.
  { name: "Gnome Stronghold Agility", label: "Gnome Stronghold", level: 1 },
  { name: "Shayzien Basic Agility Course", label: "Shayzien (Basic)", level: 1 },
  { name: "Agility Pyramid", label: "Agility Pyramid", level: 30 },
  { name: "Penguin Agility", label: "Penguin Agility", level: 30 },
  { name: "Barbarian Outpost", label: "Barbarian Outpost", level: 35 },
  { name: "Shayzien Advanced Agility Course", label: "Shayzien (Advanced)", level: 45 },
  { name: "Ape Atoll Agility", label: "Ape Atoll", level: 48 },
  { name: "Colossal Wyrm Agility Course (Basic)", label: "Colossal Wyrm (Basic)", level: 50 },
  { name: "Wilderness Agility", label: "Wilderness", level: 52 },
  { name: "Werewolf Agility", label: "Werewolf", level: 60 },
  { name: "Werewolf Skullball", label: "Werewolf Skullball", level: 60 },
  { name: "Colossal Wyrm Agility Course (Advanced)", label: "Colossal Wyrm (Advanced)", level: 62 },
  { name: "Dorgesh-Kaan Agility", label: "Dorgesh-Kaan", level: 70 },
  { name: "Prifddinas Agility Course", label: "Prifddinas", level: 75 },
];

// Activities that keep an in-game count but are NOT on the hiscores — so they can only ever be
// tracked as a kill tile, never as a stat tile. Every one of these is a name the plugin credits;
// none of them turn up in the wiki monster search behind the kill tile's NPC box, which is the
// only reason this list exists: without it an admin has to already know the string to type.
//
// `note` is shown on the chip's tooltip — several of these count something other than kills.
export const COUNTER_TARGETS: { name: string; group: string; note: string }[] = [
  // Standard "Your <X> ... count is: N" lines the plugin has always parsed — they just aren't
  // findable, because the hiscores don't carry them and the monster search doesn't know them.
  { name: 'Herbiboar', group: 'Skilling', note: 'Harvest counter — "Your Herbiboar harvest count is: N"' },
  { name: 'Agility Arena', group: 'Skilling', note: 'Brimhaven — counts TICKETS earned, not laps run' },
  { name: "TzHaar-Ket-Rak's First Challenge", group: 'Combat', note: 'Jad challenge — one counter per tier' },
  { name: "TzHaar-Ket-Rak's Second Challenge", group: 'Combat', note: 'Jad challenge — one counter per tier' },
  { name: "TzHaar-Ket-Rak's Third Challenge", group: 'Combat', note: 'Jad challenge — one counter per tier' },
  { name: "TzHaar-Ket-Rak's Fourth Challenge", group: 'Combat', note: 'Jad challenge — one counter per tier' },
  { name: "TzHaar-Ket-Rak's Fifth Challenge", group: 'Combat', note: 'Jad challenge — one counter per tier' },
  { name: "TzHaar-Ket-Rak's Sixth Challenge", group: 'Combat', note: 'Jad challenge — one counter per tier' },
  // Awakened DT2 — separate counters from the normal versions, so a tile can demand the hard mode.
  { name: 'Duke Sucellus (awakened)', group: 'Combat', note: 'Awakened variant — counted separately from the normal boss' },
  { name: 'Vardorvis (awakened)', group: 'Combat', note: 'Awakened variant — counted separately from the normal boss' },
  { name: 'Leviathan (awakened)', group: 'Combat', note: 'Awakened variant — counted separately from the normal boss' },
  { name: 'Whisperer (awakened)', group: 'Combat', note: 'Awakened variant — counted separately from the normal boss' },
  // Own line shapes, parsed separately plugin-side (AnvilPlugin.HUNTER_RUMOUR_PATTERN / EGG_OFFERING_PATTERN).
  { name: 'Hunter Rumours', group: 'Skilling', note: 'Counts rumours handed in at the Hunter Guild' },
  { name: "Bird's egg offerings", group: 'Skilling', note: 'Bird’s eggs offered at the Woodcutting Guild shrine' },
  // Chests are credited off the LOOT EVENT (one event per open), NOT off the game's "You have
  // opened the crystal chest N times." line — that one is a query response (it has a "never
  // opened" form), so counting occurrences of it would credit nothing for a real open and
  // everything for someone re-asking. Names are RuneLite's loot-event names verbatim, from
  // LootTrackerPlugin's chest table; matching is case-insensitive, but keeping the exact casing
  // means these can be diffed against that table without guessing.
  { name: 'Crystal Chest', group: 'Chests', note: 'Counts opens, credited off the loot event' },
  { name: 'Elven Crystal Chest', group: 'Chests', note: 'Prifddinas crystal chest — counts opens' },
  { name: "Larran's big chest", group: 'Chests', note: 'Counts opens, credited off the loot event' },
  { name: "Larran's small chest", group: 'Chests', note: 'Counts opens, credited off the loot event' },
  { name: 'Brimstone Chest', group: 'Chests', note: 'Counts opens, credited off the loot event' },
];

// Hallowed Sepulchre targets, shipped alongside the courses on a lap tile. The Sepulchre doesn't
// use the lap counter — it prints its own lines, which the plugin parses separately and credits
// under these synthesized names (AnvilPlugin.SEPULCHRE_*). Unlike the course names these are OURS,
// not game strings, so they only need to agree with the plugin.
//
// A floor clear credits BOTH its own floor and the any-floor name, which is what makes the two
// natural tile shapes authorable off one signal:
//   • "Complete 20 Sepulchre floors"  → target "Hallowed Sepulchre" (any floor)
//   • "Clear floor 5 ten times"       → target "Hallowed Sepulchre Floor 5"
// A full 1→5 run announces five floors, so an any-floor tile ticks five times per run. The
// Grand Hallowed Coffin is the only signal that means a COMPLETE run rather than a floor.
export const SEPULCHRE_TARGETS: { name: string; label: string; unit: 'floor' | 'run'; level: number }[] = [
  { name: "Hallowed Sepulchre", label: "Any floor", unit: 'floor', level: 52 },
  { name: "Hallowed Sepulchre Floor 1", label: "Floor 1", unit: 'floor', level: 52 },
  { name: "Hallowed Sepulchre Floor 2", label: "Floor 2", unit: 'floor', level: 62 },
  { name: "Hallowed Sepulchre Floor 3", label: "Floor 3", unit: 'floor', level: 72 },
  { name: "Hallowed Sepulchre Floor 4", label: "Floor 4", unit: 'floor', level: 82 },
  { name: "Hallowed Sepulchre Floor 5", label: "Floor 5", unit: 'floor', level: 92 },
  { name: "Grand Hallowed Coffin", label: "Grand Hallowed Coffin (full run)", unit: 'run', level: 92 },
];

const SEPULCHRE_NAMES = new Set(SEPULCHRE_TARGETS.map((t) => t.name));

/**
 * The countable noun for a lap tile, read off its targets — a Sepulchre tile counts floors or
 * runs, not laps, and the whole board says so ("12/20 floors"). Mixed tiles fall back to the
 * neutral "run" rather than calling a rooftop lap a floor.
 */
export function lapUnitNoun(targets: string[]): 'lap' | 'floor' | 'run' {
  if (targets.length === 0) return 'lap';
  const sep = targets.filter((t) => SEPULCHRE_NAMES.has(t));
  if (sep.length === 0) return 'lap';
  if (sep.length < targets.length) return 'run'; // courses AND Sepulchre on one tile
  return sep.every((t) => t === 'Grand Hallowed Coffin') ? 'run' : 'floor';
}

// Snap a typed/imported course name onto its verbatim counter name. The wiki, the world map and
// the in-game counter disagree about the trailing "Course" and about "Village"/"Stronghold", and
// a name that's one word off simply never credits — the tile looks fine and silently counts zero
// all event. So accept the obvious spellings (case, punctuation, a trailing "Course", the short
// label) and canonicalise. Anything genuinely unknown passes through untouched: free text stays
// possible for courses that ship after this list was written.
export function canonicalAgilityCourse(name: string): string {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'() ]+/g, ' ')
      .replace(/\s+/g, ' ').trim()
      .replace(/ (agility )?course$/, '')
      .replace(/^the /, '');
  const target = norm(name);
  if (!target) return name.trim();
  const hit = AGILITY_COURSES.find(
    (c) => norm(c.name) === target || norm(c.label) === target
      // "gnome stronghold" for "Gnome Stronghold Agility", "wilderness" for "Wilderness Agility".
      || norm(c.name).replace(/ agility$/, '') === target,
  );
  if (hit) return hit.name;
  // Sepulchre targets. Their labels ("Floor 5", "Any floor") are too generic to match on, so these
  // accept the name with the "hallowed sepulchre" prefix optional — "floor 5" and "sepulchre floor
  // 5" both land on "Hallowed Sepulchre Floor 5".
  const sepFloor = /^(?:(?:the )?(?:hallowed )?sepulchre )?floor ([1-5])$/.exec(target)
    ?? /^(?:the )?(?:hallowed )?sepulchre(?: floor)? ([1-5])$/.exec(target);
  if (sepFloor) return `Hallowed Sepulchre Floor ${sepFloor[1]}`;
  const sepHit = SEPULCHRE_TARGETS.find((t) => norm(t.name) === target);
  if (sepHit) return sepHit.name;
  if (/^(?:the )?(?:hallowed )?sepulchre$/.test(target)) return 'Hallowed Sepulchre';
  if (/^(?:the )?(?:grand )?hallowed coffin$/.test(target)) return 'Grand Hallowed Coffin';
  return name.trim();
}

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

/**
 * What a weekly competition tracks, spelled the way a person writes it: `phosanisNightmare` →
 * "Phosani's Nightmare", `ehb` → "EHB".
 *
 * <p>The keys are hiscores keys, and no amount of client-side de-camel-casing recovers an
 * apostrophe or a name like "CoX: CM" — so anything that shows a metric to somebody (including the
 * plugin, over the API) has to take the label from here rather than prettify the key itself. Three
 * copies of this function had already grown in lib/; the API routes couldn't see any of them, which
 * is why the in-game banner read "PhosanisNightmare".
 */
export function weeklyMetricLabel(type: string, metric: string): string {
  if (!metric) return '';
  if (type === 'skill') return SKILL_LABELS[metric] ?? metric;
  if (type === 'efficiency') return EFFICIENCY_LABELS[metric] ?? metric.toUpperCase();
  return BOSSES.find((b) => b.key === metric)?.label ?? metric;
}

/**
 * What to call the thing a milestone was crossed in.
 *
 * The metric on a milestone is a HISCORES KEY — `chambersOfXeric`, `alchemicalHydra` — and the apex
 * feed used to render it by upper-casing the first letter, which turns a key into a slightly
 * different key ("ChambersOfXeric") rather than into English. Anything that shows a metric to a
 * person goes through here instead.
 *
 * A `kc` milestone can be a boss OR one of the non-boss hiscores rows (clue tiers, Colosseum, LMS),
 * so the boss table alone is not enough — the caller passes the activity fallback in, because that
 * table lives in a module this one must not depend on.
 */
export function milestoneMetricLabel(
  kind: string,
  metric: string | null | undefined,
  activityLabel?: (key: string) => string | null,
): string {
  if (!metric) return '';
  if (kind === 'kc') {
    return (
      BOSSES.find((b) => b.key === metric)?.label ??
      activityLabel?.(metric) ??
      // Last resort, and still better than a raw key: split the camelCase into words.
      metric.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
    );
  }
  if (kind === 'ehp' || kind === 'ehb') return EFFICIENCY_LABELS[metric] ?? metric.toUpperCase();
  return SKILL_LABELS[metric] ?? metric.replace(/^./, (c) => c.toUpperCase());
}

/** Milli-hours → a display string. Two decimals: a week's honest gain is often under 10 hours. */
export function formatEfficiencyHours(milli: number): string {
  const hours = milli / EFFICIENCY_SCALE;
  if (Math.abs(hours) >= 1000) return `${(hours / 1000).toFixed(1)}K`;
  return hours.toFixed(2);
}
