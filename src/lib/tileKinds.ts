import { activityFor } from '@/lib/hiscoresActivities';
import { AGILITY_COURSES, BOSSES, SEPULCHRE_TARGETS, SKILL_LABELS, lapUnitNoun } from './constants';

// Structural subset of a tile row that the kind/target helpers need — board clients keep
// their own narrowed Tile interfaces, so we type against the shape, not the shared Tile.
export interface TileKindLike {
  tileType?: string | null;
  trackedStat?: string | null;
  statType?: string | null;
  itemRequirements?: string | null;
  // Lap tiles only: the courses / Sepulchre floors, which decide the tile's countable noun.
  targetNpcs?: string | string[] | null;
}

// Human label for a tile's tracking kind — mirrors the kind picker in TileTrackingConfig.
// Collection is a drop tile that carries per-item requirements (deriveKind does the same).
export function tileKindLabel(tile: TileKindLike): string {
  switch (tile.tileType) {
    case 'drop':
      return tile.itemRequirements ? 'Collection' : 'Drop';
    case 'kill':
      return 'Kill count';
    case 'lap':
      return lapUnitNoun(parseJsonArray<string>(tile.targetNpcs)) === 'lap'
        ? 'Agility laps' : 'Hallowed Sepulchre';
    case 'pvp':
      return 'PvP kill';
    case 'gain':
      return 'Item gain';
    case 'timed':
      return 'Timed clear';
    case 'deathless':
      return 'Deathless raid';
    case 'lms':
      return 'LMS placement';
    case 'value':
      return 'Loot value';
    case 'valuetotal':
      return 'Loot value (total)';
    case 'diary':
      return 'Diary';
    case 'ca':
      return 'Combat task';
    default:
      return tile.trackedStat ? (tile.statType === 'boss' ? 'Boss KC' : 'XP') : 'Standard';
  }
}

// The countable unit for a tile — so a submission/aggregate reads with the right noun: a 500-kill
// tile is "500 kills", not "500 drops". Value tiles are handled by formatTileAmount (gp, not a count).
export function tileCountNoun(tile: TileKindLike): string {
  switch (tile.tileType) {
    case 'kill':
    case 'pvp':
      return 'kill';
    // Agility tiles count laps on a course but FLOORS (or full runs) in the Sepulchre, so the
    // noun comes off the targets rather than the kind. targetNpcs may arrive parsed or raw.
    case 'lap':
      return lapUnitNoun(parseJsonArray<string>(tile.targetNpcs));
    case 'diary':
    case 'ca':
      return 'completion';
    case 'gain':
      return 'item';
    case 'deathless':
      return 'run';
    case 'lms':
      return 'game';
    default:
      return 'drop';
  }
}

// Human-readable amount for a tile: value tiles are gp; everything else a pluralised count noun.
// "500 kills", "3 drops", "50,000,000 gp". Use everywhere a raw submission amount would otherwise
// render as a bare "x500" (which reads as drops regardless of the tile's real kind).
export function formatTileAmount(tile: TileKindLike, amount: number): string {
  if (tile.tileType === 'value' || tile.tileType === 'valuetotal') {
    return `${amount.toLocaleString()} gp`;
  }
  const noun = tileCountNoun(tile);
  return `${amount.toLocaleString()} ${noun}${amount === 1 ? '' : 's'}`;
}

// A member's amount on a tile, stat-aware: XP / KC for hiscores tiles, else the usual count/gp.
export function formatContributionAmount(c: {
  tileType?: string | null;
  statType?: string | null;
  amount: number;
}): string {
  if (c.statType === 'skill') return `${c.amount.toLocaleString()} XP`;
  if (c.statType === 'boss') return `${c.amount.toLocaleString()} KC`;
  return formatTileAmount({ tileType: c.tileType }, c.amount);
}

// A stat tile's trackedStat can hold SEVERAL hiscores keys, comma-separated ("chambersOfXeric,
// chambersOfXericChallengeMode" — CoX + CM count together). Single-key tiles are the common
// case and pass through unchanged. Gains for a composite tile are the SUM across its keys.
export function statKeys(trackedStat: string | null | undefined): string[] {
  return (trackedStat ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Human labels for a (possibly composite) trackedStat — "CoX + CoX: CM" instead of raw keys.
export function statLabel(trackedStat: string | null | undefined, statType?: string | null): string {
  return statKeys(trackedStat)
    .map((key) =>
      statType === 'boss'
        ? BOSSES.find((b) => b.key === key)?.label ?? activityFor(key)?.label ?? key
        : SKILL_LABELS[key] ?? key,
    )
    .join(' + ');
}

// ─── The admin-side reading of a kind ────────────────────────────────────────────────────────
// tileKindLabel above answers "what kind is this" for members. Authoring needs three more things
// about the same kind — the badge it wears, the sentence describing what it credits, and the key
// the kind filter narrows by — and every authoring surface needs the same answers. They lived
// inside TilesClient, which meant a second view of the same board would have had to duplicate
// them (and drift). They belong next to the kind derivation they're derived from.

/** The one canonical kind of a tile, as the authoring surfaces group them. */
export type TileKindKey =
  | 'standard' | 'skill' | 'boss' | 'drop' | 'collection' | 'kill' | 'lap' | 'pvp'
  | 'gain' | 'timed' | 'deathless' | 'lms' | 'value' | 'diary' | 'ca';

/** Shape the kind badge/summary helpers read — a superset of TileKindLike. */
export interface TileSummaryLike extends TileKindLike {
  requiredAmount?: number | null;
  statGoal?: number | null;
  trackingMode?: string | null;
  timedActivity?: string | null;
  timeThresholdSeconds?: number | null;
}

/** Derive the single canonical kind from the stored columns (mirrors TileTrackingConfig). */
export function tileKindKey(tile: TileKindLike): TileKindKey {
  if (tile.tileType === 'kill') return 'kill';
  if (tile.tileType === 'lap') return 'lap';
  if (tile.tileType === 'pvp') return 'pvp';
  if (tile.tileType === 'gain') return 'gain';
  if (tile.tileType === 'timed') return 'timed';
  if (tile.tileType === 'deathless') return 'deathless';
  if (tile.tileType === 'lms') return 'lms';
  if (tile.tileType === 'value' || tile.tileType === 'valuetotal') return 'value';
  if (tile.tileType === 'diary') return 'diary';
  if (tile.tileType === 'ca') return 'ca';
  if (tile.tileType === 'drop') {
    const isCollection =
      !!tile.itemRequirements && tile.itemRequirements !== '[]' && tile.itemRequirements !== 'null';
    return isCollection ? 'collection' : 'drop';
  }
  if (tile.statType === 'skill') return 'skill';
  if (tile.statType === 'boss') return 'boss';
  return 'standard';
}

// `blurb` is the hover explanation shown on each tile's kind badge — a one-liner on what the kind
// tracks and how it credits. Mirrors the pickers' blurbs in TileTrackingConfig.
export const TILE_KIND_BADGES: Record<TileKindKey, { label: string; cls: string; blurb: string }> = {
  standard: { label: 'Standard', cls: 'bg-gold/15 text-gold', blurb: 'Manual tile — a captain marks it done. No auto-tracking.' },
  skill: { label: 'Skill', cls: 'bg-blue-500/20 text-blue-300', blurb: 'Auto-completes when a skill reaches an XP goal (hiscores-polled).' },
  boss: { label: 'Boss KC', cls: 'bg-purple-500/20 text-purple-300', blurb: 'Auto-completes when a boss reaches a kill-count goal (hiscores-polled).' },
  drop: { label: 'Drop', cls: 'bg-accent-green/20 text-accent-green-light', blurb: 'N drops of an item (or any of a pool) — plugin-detected, baked screenshot.' },
  collection: { label: 'Item set', cls: 'bg-accent-green/20 text-accent-green-light', blurb: 'Multiple items, each with its own required count — 1× each for a full set.' },
  kill: { label: 'Kill count', cls: 'bg-red-500/20 text-red-300', blurb: 'N kills of an NPC — even ones off the hiscores (chickens, cows). Plugin-detected.' },
  lap: { label: 'Agility laps', cls: 'bg-lime-500/20 text-lime-300', blurb: 'N laps of an agility course, or N Hallowed Sepulchre floors / full runs — counted live off the in-game counter. Only laps run during the event count.' },
  pvp: { label: 'PvP kill', cls: 'bg-red-500/20 text-red-200', blurb: 'Kill players — anyone, rival teams, or a named bounty — in the Wild / PvP worlds. Safe minigames never count.' },
  gain: { label: 'Item gain', cls: 'bg-teal-500/20 text-teal-300', blurb: 'Catch/cook/gather N of an item — counted from inventory gains. Plugin-detected.' },
  timed: { label: 'Timed', cls: 'bg-cyan-500/20 text-cyan-300', blurb: 'Clear an activity under a time cap (Inferno, raids, Colosseum). Plugin times it.' },
  deathless: { label: 'Deathless', cls: 'bg-fuchsia-500/20 text-fuchsia-300', blurb: 'Complete a raid with ZERO party deaths, N times. Plugin counts deaths in the instance.' },
  lms: { label: 'LMS', cls: 'bg-rose-500/20 text-rose-300', blurb: 'Place top-N in Last Man Standing (1 = win), M times. Plugin-detected at game end.' },
  value: { label: 'Loot value', cls: 'bg-amber-500/20 text-amber-200', blurb: 'Loot worth X gp — one haul or hauls summing to a target. Plugin prices the haul.' },
  diary: { label: 'Diary', cls: 'bg-amber-500/20 text-amber-300', blurb: 'Complete achievement-diary tiers during the event. Plugin-detected off the completion message.' },
  ca: { label: 'Combat task', cls: 'bg-orange-500/20 text-orange-300', blurb: 'Complete Combat Achievement tasks during the event. Plugin-detected off the completion message.' },
};

/** The badge one tile wears on any authoring surface. */
export const tileKindBadge = (tile: TileKindLike) => TILE_KIND_BADGES[tileKindKey(tile)];

/** The kind filter's options, in picker order. */
export const TILE_KIND_FILTERS: { key: 'all' | TileKindKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'standard', label: 'Standard' },
  { key: 'skill', label: 'Skill' },
  { key: 'boss', label: 'Boss' },
  { key: 'drop', label: 'Drop' },
  { key: 'collection', label: 'Item set' },
  { key: 'kill', label: 'Kill' },
  { key: 'lap', label: 'Laps' },
  { key: 'pvp', label: 'PvP' },
  { key: 'gain', label: 'Gain' },
  { key: 'timed', label: 'Timed' },
  { key: 'deathless', label: 'Deathless' },
  { key: 'lms', label: 'LMS' },
  { key: 'value', label: 'Value' },
  { key: 'diary', label: 'Diary' },
  { key: 'ca', label: 'Combat task' },
];

/**
 * One-line summary of a tile's current configuration, shown under its label while authoring.
 * `noun` is what the board calls its entries (lib/tileAuthoring) — it only reaches the fallback,
 * which is the one line that talks about the thing itself rather than what it tracks.
 */
export function tileConfigSummary(tile: TileSummaryLike, noun = 'tile'): string {
  switch (tileKindKey(tile)) {
    case 'collection': {
      const count = parseJsonArray<unknown>(tile.itemRequirements).length;
      return `Item set · ${count} item${count !== 1 ? 's' : ''}`;
    }
    case 'drop':
      return tile.requiredAmount ? `Required: ${tile.requiredAmount}` : 'Item drop';
    case 'skill':
    case 'boss': {
      const goal = tile.statGoal ? ` · goal ${tile.statGoal.toLocaleString()}` : '';
      return `${statLabel(tile.trackedStat, tile.statType)}${goal} · ${tile.trackingMode}`;
    }
    case 'kill':
      return tile.requiredAmount ? `Kill count · ${tile.requiredAmount}` : 'Kill count';
    case 'lap': {
      const courses = parseJsonArray<string>(tile.targetNpcs);
      const noun = lapUnitNoun(courses);
      const label = (n: string) =>
        AGILITY_COURSES.find((c) => c.name === n)?.label
        ?? SEPULCHRE_TARGETS.find((t) => t.name === n)?.label
        ?? n;
      const where = courses.length === 1 ? label(courses[0]) : `${courses.length} ${noun === 'lap' ? 'courses' : 'targets'}`;
      const head = noun === 'lap' ? 'Laps' : noun === 'floor' ? 'Sepulchre' : 'Runs';
      return `${head} · ${where}${tile.requiredAmount ? ` ×${tile.requiredAmount}` : ''}`;
    }
    case 'pvp': {
      const sels = parseJsonArray<string>(tile.targetNpcs);
      const bounties = sels.filter((s) => s.startsWith('rsn:')).map((s) => s.slice(4));
      const who = bounties.length > 0 ? bounties.join(', ') : 'rival team';
      return `PvP kill · ${who}${tile.requiredAmount && tile.requiredAmount > 1 ? ` ×${tile.requiredAmount}` : ''}`;
    }
    case 'gain':
      return tile.requiredAmount ? `Item gain · ${tile.requiredAmount}` : 'Item gain';
    case 'deathless': {
      const party = tile.timeThresholdSeconds ? ` · ${tile.timeThresholdSeconds}-man` : '';
      return `Deathless · ${tile.timedActivity || 'raid'}${party}${tile.requiredAmount && tile.requiredAmount > 1 ? ` ×${tile.requiredAmount}` : ''}`;
    }
    case 'timed':
      return tile.timeThresholdSeconds ? `Timed · under ${tile.timeThresholdSeconds}s` : 'Timed clear';
    case 'lms': {
      const cap = tile.timeThresholdSeconds ?? 1;
      const games = tile.requiredAmount && tile.requiredAmount > 1 ? ` ×${tile.requiredAmount}` : '';
      return cap <= 1 ? `LMS · win${games}` : `LMS · top ${cap}${games}`;
    }
    case 'value':
      if (!tile.requiredAmount) return 'Loot value';
      return tile.tileType === 'valuetotal'
        ? `Loot value · ${tile.requiredAmount.toLocaleString()} gp total`
        : `Loot value · ≥${tile.requiredAmount.toLocaleString()} gp haul`;
    case 'diary': {
      const sels = parseJsonArray<string>(tile.targetNpcs);
      const what = sels.length === 1 ? sels[0] : `${sels.length} selectors`;
      return `Diary · ${what}${tile.requiredAmount && tile.requiredAmount > 1 ? ` ×${tile.requiredAmount}` : ''}`;
    }
    case 'ca': {
      const sels = parseJsonArray<string>(tile.targetNpcs);
      const what = sels.length === 1 ? sels[0] : `${sels.length} selectors`;
      return `Combat task · ${what}${tile.requiredAmount && tile.requiredAmount > 1 ? ` ×${tile.requiredAmount}` : ''}`;
    }
    default:
      return `Manual ${noun} — no auto-tracking`;
  }
}

// Safe JSON.parse for the tiles table's JSON-array text columns (targetNpcs, sourceNpcs, …).
// Some client stores keep these already parsed — pass arrays through untouched.
export function parseJsonArray<T>(raw: string | T[] | null | undefined): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
