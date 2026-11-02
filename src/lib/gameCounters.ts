// Counters read off a GAME VALUE (a varbit or varp) rather than a chat line. The plugin is generic: it
// reads each source every tick once logged in and settled, and credits kill tiles targeting the
// entry's `name` with every change in `direction` (default increase). Spending lowers the value and
// never subtracts. Which values exist, and what each is called, lives HERE — adding one is one line
// in GAME_COUNTERS, not a plugin release.
//
// Shipped to the plugin in /api/plugin/config as `gameCounters` (capability 'game-counters').
//
// `confirmed: false` = nobody has watched the value move in game yet. It still counts, but every
// credit arrives flagged 'unverified_counter' so staff get a "check" badge on it, and the kill
// picker marks it "beta". Flip it to true once someone has checked it in game.
//
// NAMES MUST NOT END IN "(...)": the plugin's kill index strips a trailing parenthetical as a wiki
// qualifier ("Armoured zombie (Zemouregal's Fort)" → "Armoured zombie"), so "Slayer tasks (Mortimer)"
// would never match and every master would fold onto one key. Hence "Slayer tasks: Mortimer".
//
// Pure module (no db), so tests and the client bundle can import it.

export type GameValueSource = { type: 'varbit' | 'varp'; id: number };

export type GameCounter = {
  /** The target name a kill tile lists. Matched case-insensitively, verbatim otherwise. */
  name: string;
  /** Chip group in the kill picker (COUNTER_TARGETS). */
  group: string;
  /** Chip tooltip. */
  note: string;
  /** One or more vars; their changes are SUMMED (or counted once per tick with `changes`). */
  sources: GameValueSource[];
  /** 'increase' (default): earned. 'decrease': claimed/spent. */
  direction?: 'increase' | 'decrease';
  /** False until checked in game: credits flagged 'unverified_counter', chip marked beta. */
  confirmed: boolean;
  /**
   * Largest single per-source jump credited; bigger is a resync, re-baselined. Plugin default 1000.
   * Set it to ONE real action's ceiling: it is also what keeps a var that arrives late after login
   * (0, then the whole balance) from being credited.
   */
  maxDelta?: number;
  /**
   * A points balance: a rise FROM 0 is the value arriving late, not points earned, so it re-baselines.
   * Costs a player sitting on exactly 0 their first action; never set it where 0 → small is normal
   * (streaks that reset, a reward pool that empties).
   */
  balance?: boolean;
  /** Count 1 per tick on which any source moved (one task bumping two streak vars counts once). */
  changes?: boolean;
  /** Skip a tick on which any of these moved the same way. */
  unless?: GameValueSource[];
};

const varbit = (id: number): GameValueSource => ({ type: 'varbit', id });
const varp = (id: number): GameValueSource => ({ type: 'varp', id });

// Ids from RuneLite's gameval (runelite-api net.runelite.api.gameval.VarbitID / VarPlayerID).
const SLAYER_TASKS_COMPLETED = varbit(4069); // the main streak (every master but the two below, maybe them too)
const SLAYER_WILDERNESS_TASKS_COMPLETED = varbit(5617); // Krystilia
const SLAYER_MORTIMER_TASKS_COMPLETED = varp(5720);

// DOM_LEVEL_1_COMPLETIONS .. DOM_LEVEL_8_COMPLETIONS, then DOM_LEVEL_8_PLUS_COMPLETIONS.
const DOOM_LEVELS: { label: string; source: GameValueSource }[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ label: String(n), source: varp(4807 + n) })),
  { label: '8+', source: varp(4816) },
];

export const GAME_COUNTERS: GameCounter[] = [
  // Points balances: every rise is points earned; buying from the shop lowers it and is ignored.
  // Ceilings (wiki): a sack takes at most 100 fruit per deposit at 1 point per 3 fruit + 2 for the
  // 100th → 35; Foundry reputation per sword = its final quality, at most 199.
  { name: 'Tithe Farm points', group: 'Skilling', note: 'Tithe Farm reward points earned (the HUD balance; spending doesn’t subtract)', sources: [varbit(4893)], maxDelta: 40, balance: true, confirmed: true },
  { name: "Giants' Foundry reputation", group: 'Skilling', note: 'Giants’ Foundry reputation earned (spending doesn’t subtract)', sources: [varp(3436)], maxDelta: 200, balance: true, confirmed: true },
  // WINT_REWARD_POOL: rewards banked in the cart. A big search claims 5 at once, which is why the
  // loot line can't count claims.
  // A round owes 2 rewards at 500 points plus 1 per further 500 (wiki); ~13,500 points is a very high
  // solo round → ~28, so 30. A big search takes 5. NOT a balance: the cart emptying to 0 is normal.
  { name: 'Wintertodt rewards earned', group: 'Skilling', note: 'Reward rolls banked in the Wintertodt reward cart', sources: [varbit(11435)], maxDelta: 30, confirmed: false },
  { name: 'Wintertodt rewards claimed', group: 'Skilling', note: 'Reward rolls taken out of the Wintertodt reward cart (a big search takes 5)', sources: [varbit(11435)], direction: 'decrease', maxDelta: 5, confirmed: false },
  // Slayer: one completion per tick. A Mortimer or Krystilia task may or may not ALSO bump the main
  // streak — "other masters" excludes a tick where either of theirs moved, so it is right either way.
  // A streak reset (Turael/Spria skip) drops a value to 0 and is ignored like any spend.
  { name: 'Slayer tasks: any master', group: 'Slayer', note: 'Every slayer task completed, whoever assigned it', sources: [SLAYER_TASKS_COMPLETED, SLAYER_WILDERNESS_TASKS_COMPLETED, SLAYER_MORTIMER_TASKS_COMPLETED], changes: true, maxDelta: 1, confirmed: false },
  { name: 'Slayer tasks: Mortimer', group: 'Slayer', note: 'Tasks completed for Mortimer', sources: [SLAYER_MORTIMER_TASKS_COMPLETED], maxDelta: 1, confirmed: false },
  { name: 'Slayer tasks: Krystilia', group: 'Slayer', note: 'Wilderness tasks completed for Krystilia', sources: [SLAYER_WILDERNESS_TASKS_COMPLETED], maxDelta: 1, confirmed: false },
  { name: 'Slayer tasks: other masters', group: 'Slayer', note: 'Tasks completed for any master but Mortimer and Krystilia', sources: [SLAYER_TASKS_COMPLETED], unless: [SLAYER_MORTIMER_TASKS_COMPLETED, SLAYER_WILDERNESS_TASKS_COMPLETED], maxDelta: 1, confirmed: false },
  // Doom: one per delve cleared, any level, repeats included. Counted once per tick in case a deep
  // delve bumps both the level-8 and the 8+ var.
  { name: 'Doom of Mokhaiotl delves', group: 'Combat', note: 'Every delve completed, any level (repeats count)', sources: DOOM_LEVELS.map((l) => l.source), changes: true, maxDelta: 5, confirmed: false },
  ...DOOM_LEVELS.map((l): GameCounter => ({
    name: `Doom delve level ${l.label}`, group: 'Combat', note: `Doom of Mokhaiotl delve level ${l.label} completions`,
    sources: [l.source], maxDelta: 5, confirmed: false,
  })),
];

/** What /api/plugin/config ships (`gameCounters`): only what the plugin's GameValueCounters reads. */
export type PluginGameCounter = {
  name: string;
  sources: GameValueSource[];
  direction: 'increase' | 'decrease';
  confirmed: boolean;
  maxDelta?: number;
  balance?: boolean;
  changes?: boolean;
  unless?: GameValueSource[];
};

export function pluginGameCounters(): PluginGameCounter[] {
  return GAME_COUNTERS.map((c) => ({
    name: c.name,
    sources: c.sources,
    direction: c.direction ?? 'increase',
    confirmed: c.confirmed,
    ...(c.maxDelta != null ? { maxDelta: c.maxDelta } : {}),
    ...(c.balance ? { balance: true } : {}),
    ...(c.changes ? { changes: true } : {}),
    ...(c.unless?.length ? { unless: c.unless } : {}),
  }));
}

/** Kill-picker chips for the catalog (merged into COUNTER_TARGETS). */
/**
 * The most ONE real action can credit off this counter — what the plugin credits on a single tick.
 * `changes` counters count 1 per tick; otherwise each source's jump is capped at maxDelta (plugin
 * default 1000) and the sources are summed. Feeds a tile's image-less ping ceiling (lib/pingMax).
 */
export function gameCounterActionMax(c: GameCounter): number {
  return c.changes ? 1 : (c.maxDelta ?? 1000) * c.sources.length;
}

export function gameCounterTargets(): { name: string; group: string; note: string; confirmed: boolean; actionMax: number }[] {
  return GAME_COUNTERS.map((c) => ({ name: c.name, group: c.group, note: c.note, confirmed: c.confirmed, actionMax: gameCounterActionMax(c) }));
}
