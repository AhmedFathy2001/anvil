import { BOSSES } from './constants';
import { HISCORES_ACTIVITIES } from './hiscoresActivities';

// ─── "Kills": one authoring kind, two counting engines ─────────────────────────────────────────
//
// Admins used to choose between "Boss KC" (a hiscores stat tile: statType 'boss', trackedStat =
// comma-separated hiscores keys whose gains SUM, polled + live plugin overlay) and "Kill count" (a
// plugin tile: tileType 'kill', credited off the Jagex KC chat line for bosses and NpcLootReceived
// for everything else). Nobody could tell them apart — a clan picked "Kill count" for bosses and got
// a Discord post per kill. So authoring now offers ONE kind, and the source is picked for the admin:
//
//   • every chosen monster is on the hiscores → today's boss-stat tile;
//   • anything off the hiscores               → today's plugin kill tile, and all of the selection is
//                                               counted by the plugin (never two sources summed).
//
// Storage and both scoring engines are untouched: this only decides which of the two existing tile
// shapes a selection is saved as. Once an event has started a tile's source is frozen — see
// `frozen` on chooseKillSource and killSourceOf.
//
// Pure (constants only) so the editor, the CSV importer and the tests share one rule.

export type KillSource = 'hiscores' | 'plugin';

/** One chosen monster: the name the plugin would match, and its hiscores key if it has one. */
export interface KillPick {
  name: string;
  key: string | null;
}

const BOSS_BY_KEY = new Map(BOSSES.map((b) => [b.key, b]));
const ACTIVITY_BY_KEY = new Map(HISCORES_ACTIVITIES.map((a) => [a.key, a]));

// Where the hiscores label isn't the name the game's kill-count line carries — the plugin matches a
// kill tile's names against that line verbatim (case-insensitive), so a hiscores pick saved onto a
// plugin tile must use the line's spelling. Raid modes per RAID_MODE_VARIANTS (CoX CM has NO colon;
// ToB/ToA modes DO); "The …" bosses drop the article on the line.
const KC_LINE_FIXES: Record<string, string> = {
  chambersOfXericChallengeMode: 'Chambers of Xeric Challenge Mode',
  theatreOfBloodHardMode: 'Theatre of Blood: Hard Mode',
  tombsOfAmascutExpertMode: 'Tombs of Amascut: Expert Mode',
  thermonuclearSmokeDevil: 'Thermonuclear Smoke Devil',
  fracturedArchive: 'Fractured Archive',
  leviathan: 'Leviathan',
  whisperer: 'Whisperer',
  hueycoatl: 'Hueycoatl',
  royalTitans: 'Royal Titans',
  gauntlet: 'Gauntlet',
  lunarChests: 'Lunar Chest',
};

/**
 * The name a plugin kill tile should carry for a hiscores key, or null when the plugin has no kill
 * to count for it (clue tiers, GOTR, LMS rank… — the non-boss hiscores activities).
 */
export function killLineNameForKey(key: string): string | null {
  const boss = BOSS_BY_KEY.get(key);
  if (!boss) return null;
  return KC_LINE_FIXES[key] ?? boss.label;
}

/** Display label for a hiscores key ("CoX: CM", "Clue Scrolls (elite)"), or the key itself. */
export function hiscoresKeyLabel(key: string): string {
  return BOSS_BY_KEY.get(key)?.label ?? ACTIVITY_BY_KEY.get(key)?.label ?? key;
}

/** Is this key a non-boss hiscores counter (clues, GOTR, …) rather than something you kill? */
export function isActivityOnlyKey(key: string): boolean {
  return !BOSS_BY_KEY.has(key) && ACTIVITY_BY_KEY.has(key);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stripThe = (s: string) => s.replace(/^the\s+/, '');

// Name → hiscores key. Deliberately NOT the boss aliases: those are search shorthands ("hydra",
// "rat", "mole", "corp"), and several are real monsters that are NOT the boss — a slayer Hydra is not
// the Alchemical Hydra. Only full names count: the hiscores label, the kill-count-line spelling, and
// the long-form mode aliases ("Theatre of Blood: Hard Mode") a raid tile is written with.
const NAME_TO_KEY: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const add = (name: string, key: string) => {
    const n = norm(name);
    if (n && !m.has(n)) m.set(n, key);
    const bare = stripThe(n);
    if (bare && !m.has(bare)) m.set(bare, key);
  };
  for (const b of BOSSES) add(b.label, b.key);
  for (const b of BOSSES) {
    const line = killLineNameForKey(b.key);
    if (line) add(line, b.key);
    // Long-form aliases only: the mode spellings ("chambers of xeric challenge mode") and the
    // display-shorthand expansions ("thermonuclear smoke devil"). Short tags are search terms.
    for (const a of b.aliases ?? []) if (a.split(' ').length >= 3) add(a, b.key);
  }
  for (const a of HISCORES_ACTIVITIES) add(a.label, a.key);
  return m;
})();

/** The hiscores key a monster name is tracked under, or null when it's off the hiscores. */
export function hiscoresKeyForMonster(name: string): string | null {
  const raw = name.trim();
  if (!raw) return null;
  if (BOSS_BY_KEY.has(raw) || ACTIVITY_BY_KEY.has(raw)) return raw;
  const n = norm(raw);
  return NAME_TO_KEY.get(n) ?? NAME_TO_KEY.get(stripThe(n)) ?? null;
}

/**
 * A pick from whatever the admin typed or chose: a hiscores key ("zulrah"), a label ("CoX: CM") or an
 * NPC name ("Chicken"). A key or label becomes the plugin-line name; a free name is kept VERBATIM —
 * it may be what a live kill tile already matches on, and rewriting it would change what counts.
 */
export function killPick(input: string): KillPick {
  const raw = input.trim();
  if (BOSS_BY_KEY.has(raw) || ACTIVITY_BY_KEY.has(raw)) {
    return { name: killLineNameForKey(raw) ?? hiscoresKeyLabel(raw), key: raw };
  }
  return { name: raw, key: hiscoresKeyForMonster(raw) };
}

export type KillSourceChoice =
  | { ok: true; source: 'hiscores'; trackedStat: string; keys: string[]; mixed: false }
  | { ok: true; source: 'plugin'; targetNpcs: string[]; mixed: boolean }
  | { ok: false; error: string };

/** The one line the editor shows when a mixed selection falls back to the plugin. */
export const MIXED_SOURCE_NOTE =
  'Counted by the plugin, because this includes monsters that aren’t on the hiscores.';

/**
 * Which engine counts this selection, and the stored fields that go with it.
 *
 * `frozen` pins the source (an event that has started never has a tile's source converted): the
 * selection then has to fit that source, or this explains why it can't.
 */
export function chooseKillSource(
  picks: (string | KillPick)[],
  frozen: KillSource | null = null,
): KillSourceChoice {
  const list = picks
    .map((p) => (typeof p === 'string' ? killPick(p) : { name: p.name.trim(), key: p.key ?? hiscoresKeyForMonster(p.name) }))
    .filter((p) => p.name || p.key);
  if (list.length === 0) return { ok: false, error: 'Add at least one monster to count kills for.' };

  const offHiscores = list.filter((p) => !p.key);
  const wantsPlugin = frozen === 'plugin' || (frozen == null && offHiscores.length > 0);

  if (!wantsPlugin) {
    if (offHiscores.length > 0) {
      return {
        ok: false,
        error: `This tile counts from the hiscores, and that can’t change once the event has started — ${offHiscores
          .map((p) => p.name)
          .join(', ')} ${offHiscores.length === 1 ? 'isn’t' : 'aren’t'} on the hiscores.`,
      };
    }
    const keys = [...new Set(list.map((p) => p.key!))];
    return { ok: true, source: 'hiscores', trackedStat: keys.join(','), keys, mixed: false };
  }

  // The plugin counts kills; a clue tier or a minigame score isn't one, so it can't ride along.
  const uncountable = list.filter((p) => p.key && isActivityOnlyKey(p.key) && !killLineNameForKey(p.key));
  if (uncountable.length > 0) {
    const names = uncountable.map((p) => hiscoresKeyLabel(p.key!)).join(', ');
    return {
      ok: false,
      error: frozen === 'plugin'
        ? `${names} can only be counted from the hiscores, and this tile is counted by the plugin.`
        : `${names} can only be counted from the hiscores, so it can’t share a tile with monsters that aren’t on the hiscores. Put them on separate tiles.`,
    };
  }
  const seen = new Set<string>();
  const targetNpcs: string[] = [];
  for (const p of list) {
    const k = p.name.toLowerCase();
    if (!p.name || seen.has(k)) continue;
    seen.add(k);
    targetNpcs.push(p.name);
  }
  const mixed = offHiscores.length > 0 && offHiscores.length < list.length;
  return { ok: true, source: 'plugin', targetNpcs, mixed };
}

/** The source a stored tile counts from, or null when it isn't a kills tile at all. */
export function killSourceOf(tile: { tileType?: string | null; statType?: string | null }): KillSource | null {
  if (tile.tileType === 'kill') return 'plugin';
  if (tile.statType === 'boss' && (!tile.tileType || tile.tileType === 'standard')) return 'hiscores';
  return null;
}

// ─── Milestone posts for plugin-counted kill tiles ─────────────────────────────────────────────
//
// A plugin kill tile used to post every debounce window — on a boss you kill once a minute that is a
// post per kill. Tiles created since tiles.kill_posts existed carry 'milestones' (the column's
// default; every older row is NULL and keeps the old behaviour, so no running event changes): they
// post at 25 / 50 / 75 % and on completion. Tiny goals just post the completion.

/** Goals at or below this only ever post the completion. */
export const KILL_MILESTONE_MIN_GOAL = 4;
const KILL_MILESTONE_PCTS = [25, 50, 75] as const;

/** Does this tile post kill progress at milestones (vs. the legacy every-window posts)? */
export function usesKillMilestones(tile: { tileType?: string | null; killPosts?: string | null }): boolean {
  return tile.tileType === 'kill' && tile.killPosts === 'milestones';
}

/**
 * The milestone (25 / 50 / 75) the count crossed going from `prev` to `next`, or null when none was.
 * When one step crosses several, the highest is reported once. Reaching the goal is not a milestone —
 * the completion post covers it.
 */
export function killMilestoneToPost(prev: number | null, next: number | null, goal: number | null): 25 | 50 | 75 | null {
  if (prev == null || next == null || goal == null || !(goal > KILL_MILESTONE_MIN_GOAL)) return null;
  if (next <= prev) return null;
  let hit: 25 | 50 | 75 | null = null;
  for (const pct of KILL_MILESTONE_PCTS) {
    const at = Math.ceil((goal * pct) / 100);
    if (at >= goal) continue;
    if (prev < at && next >= at) hit = pct;
  }
  return hit;
}

// ─── Spreadsheet / library rows ─────────────────────────────────────────────────────────────────
//
// A sheet may say `type=kills` and let the rule pick, or keep the explicit shapes every older sheet
// uses — `type=kill` (plugin) and `type=standard` + `statType=boss` (hiscores) — which import exactly
// as they always did. A few names people type for those are accepted too. Exports keep writing the
// explicit shapes, so a downloaded sheet re-imports to the same tiles.

/** Hand-typed type names → the stored shape they mean. `kills` is resolved by resolveKillsRow. */
const TYPE_ALIASES: Record<string, { tileType: string; statType?: 'boss' }> = {
  boss: { tileType: 'standard', statType: 'boss' },
  'boss kc': { tileType: 'standard', statType: 'boss' },
  bosskc: { tileType: 'standard', statType: 'boss' },
  'kill count': { tileType: 'kill' },
  killcount: { tileType: 'kill' },
  kc: { tileType: 'standard', statType: 'boss' },
  kill: { tileType: 'kill' },
  kills: { tileType: 'kills' },
};

/** Normalise a row's type cell in place: lowercase, and the legacy/alternative kills names. */
export function applyKillTypeAlias<T extends { tileType?: string; statType?: string | null }>(row: T): T {
  if (typeof row.tileType !== 'string') return row;
  const t = row.tileType.trim().toLowerCase();
  const alias = TYPE_ALIASES[t];
  if (!alias) {
    row.tileType = t;
    return row;
  }
  row.tileType = alias.tileType;
  if (alias.statType && !row.statType) row.statType = alias.statType;
  return row;
}

/** The fields resolveKillsRow reads and writes — a structural subset of a CSV/library/import row. */
export interface KillsRowLike {
  tileType?: string;
  targetNpcs?: string[] | null;
  trackedStat?: string | null;
  statType?: string | null;
  statGoal?: number | null;
  requiredAmount?: number | null;
  statBasis?: string | null;
  coopCredit?: string | null;
  coopMinMembers?: number | null;
}

/**
 * Turn a `type=kills` row into one of the two stored shapes. Monsters come from `targetNpcs` and/or
 * `trackedStat` (keys or names, comma-separated); the amount from `requiredAmount`, else `statGoal`.
 * Any other row passes through untouched. `frozen` pins the source (an existing tile on a started
 * event), exactly as in the editor.
 */
export function resolveKillsRow<T extends KillsRowLike>(
  row: T,
  frozen: KillSource | null = null,
): { ok: true; row: T } | { ok: false; error: string } {
  if (row.tileType !== 'kills') return { ok: true, row };
  const monsters = [
    ...(row.targetNpcs ?? []),
    ...(row.trackedStat ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  ];
  const choice = chooseKillSource(monsters, frozen);
  if (!choice.ok) return { ok: false, error: choice.error };
  const amount = row.requiredAmount ?? row.statGoal ?? null;
  const out: T = { ...row };
  if (choice.source === 'hiscores') {
    out.tileType = 'standard';
    out.statType = 'boss';
    out.trackedStat = choice.trackedStat;
    out.statGoal = amount;
    out.requiredAmount = null;
    out.targetNpcs = null;
    // Shared-kill rules belong to plugin tiles only.
    if (out.coopCredit !== undefined) out.coopCredit = null;
    if (out.coopMinMembers !== undefined) out.coopMinMembers = null;
  } else {
    out.tileType = 'kill';
    out.targetNpcs = choice.targetNpcs;
    out.requiredAmount = amount;
    out.trackedStat = null;
    out.statType = null;
    out.statGoal = null;
    // A lifetime milestone is a hiscores idea; a plugin tile counts kills during the event.
    delete out.statBasis;
  }
  return { ok: true, row: out };
}
