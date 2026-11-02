// The pure half of the tile creator (components/tile-creator): what each purpose-built control
// (raid modes, Barracuda Trials, items) turns into, and how a finished draft becomes the same
// write the full editor makes. No database and no React, so the matcher (lib/taskMatch), the
// creator UI and the tests share one set of rules.
//
// The admin never picks a "kind" here. They say what players do; these helpers pick the stored
// shape — and lib/killSource still decides hiscores vs plugin for anything that is a kill count.

import { BOSSES, COUNTER_TARGETS, RAID_MODE_VARIANTS } from '@/lib/constants';
import { TRIAL_COURSES, TRIAL_COURSE_LEVELS, TRIAL_RANKS, TRIAL_RANK_ACTIVITIES } from '@/lib/barracudaTrials';
import { chooseKillSource, hiscoresKeyForMonster, hiscoresKeyLabel, type KillSource } from '@/lib/killSource';
import { howTileCounts, tileKindKey, type TileKindKey, type TileKindLike } from '@/lib/tileKinds';
import type { TileCsvRow } from '@/lib/csvTiles';
import type { TileConfig } from '@/lib/types';

// ─── Raids ───────────────────────────────────────────────────────────────────────────────────

export type RaidId = 'cox' | 'tob' | 'toa' | 'tfa';
export type RaidModeId = 'entry' | 'normal' | 'cm' | 'hard' | 'expert';

export interface RaidModeOption {
  id: RaidModeId;
  label: string;
  /** Short name used in a tile title ("ToB HM"). */
  short: string;
  /** The exact game string the plugin matches — straight off RAID_MODE_VARIANTS. */
  name: string;
}

export interface RaidOption {
  id: RaidId;
  label: string;
  short: string;
  modes: RaidModeOption[];
}

function variant(base: string, includes: string): string {
  const row = RAID_MODE_VARIANTS.find((r) => r.base === base);
  const hit = row?.modes.find((m) => m.includes(includes));
  if (!hit) throw new Error(`RAID_MODE_VARIANTS has no ${includes} mode for ${base}`);
  return hit;
}

// Mode strings come from RAID_MODE_VARIANTS so the load-bearing spelling (CoX CM has NO colon,
// ToB/ToA modes DO) lives in exactly one place.
export const RAID_OPTIONS: RaidOption[] = [
  {
    id: 'cox',
    label: 'Chambers of Xeric',
    short: 'CoX',
    modes: [
      { id: 'normal', label: 'Normal', short: 'CoX', name: 'Chambers of Xeric' },
      { id: 'cm', label: 'Challenge Mode', short: 'CoX CM', name: variant('Chambers of Xeric', 'Challenge') },
    ],
  },
  {
    id: 'tob',
    label: 'Theatre of Blood',
    short: 'ToB',
    modes: [
      { id: 'entry', label: 'Entry', short: 'ToB Entry', name: variant('Theatre of Blood', 'Entry') },
      { id: 'normal', label: 'Normal', short: 'ToB', name: 'Theatre of Blood' },
      { id: 'hard', label: 'Hard', short: 'ToB HM', name: variant('Theatre of Blood', 'Hard') },
    ],
  },
  {
    id: 'toa',
    label: 'Tombs of Amascut',
    short: 'ToA',
    modes: [
      { id: 'entry', label: 'Entry', short: 'ToA Entry', name: variant('Tombs of Amascut', 'Entry') },
      { id: 'normal', label: 'Normal', short: 'ToA', name: 'Tombs of Amascut' },
      { id: 'expert', label: 'Expert', short: 'ToA Expert', name: variant('Tombs of Amascut', 'Expert') },
    ],
  },
  {
    // One mode, and the count line carries no article ("Your completed Fractured Archive count is").
    id: 'tfa',
    label: 'The Fractured Archive',
    short: 'TFA',
    modes: [{ id: 'normal', label: 'Normal', short: 'TFA', name: RAID_MODE_VARIANTS.find((r) => r.base === 'Fractured Archive')!.base }],
  },
];

/** Ticked modes, keyed "<raid>:<mode>" ("tob:hard"). */
export type RaidSelection = Record<string, boolean>;

export const raidModeKey = (raid: RaidId, mode: RaidModeId) => `${raid}:${mode}`;

/** Every mode of these raids except Entry — what "5 CoX or ToB" means unless Entry is named. */
export function defaultRaidSelection(raids: RaidId[], withEntry = false): RaidSelection {
  const sel: RaidSelection = {};
  for (const r of RAID_OPTIONS) {
    if (!raids.includes(r.id)) continue;
    for (const m of r.modes) if (m.id !== 'entry' || withEntry) sel[raidModeKey(r.id, m.id)] = true;
  }
  return sel;
}

export function selectedRaidModes(sel: RaidSelection): { raid: RaidOption; mode: RaidModeOption }[] {
  const out: { raid: RaidOption; mode: RaidModeOption }[] = [];
  for (const raid of RAID_OPTIONS) for (const mode of raid.modes) if (sel[raidModeKey(raid.id, mode.id)]) out.push({ raid, mode });
  return out;
}

export interface RaidTileResult {
  ok: boolean;
  error?: string;
  source: 'hiscores' | 'plugin' | null;
  /** True when an Entry mode is ticked — the reason the plugin counts it. */
  entryTicked: boolean;
  title: string;
  config: Partial<TileConfig>;
}

/**
 * The multi-key kill tile a set of raid modes becomes. Every non-Entry mode is on the hiscores, so
 * those read off them (statType 'boss', comma-separated keys whose gains SUM); ticking an Entry mode
 * moves the whole tile to the plugin, which counts each mode's completion line. lib/killSource
 * makes that call, exactly as it does in the full editor.
 */
export function raidTileConfig(sel: RaidSelection, amount: number | null): RaidTileResult {
  const picked = selectedRaidModes(sel);
  const n = amount && amount > 0 ? amount : 1;
  const entryTicked = picked.some((p) => p.mode.id === 'entry');
  const title = raidTitle(sel, n);
  if (picked.length === 0) {
    return { ok: false, error: 'Tick at least one raid mode.', source: null, entryTicked, title, config: {} };
  }
  const choice = chooseKillSource(picked.map((p) => p.mode.name));
  if (!choice.ok) return { ok: false, error: choice.error, source: null, entryTicked, title, config: {} };
  if (choice.source === 'hiscores') {
    return {
      ok: true,
      source: 'hiscores',
      entryTicked,
      title,
      config: { tileType: 'standard', statType: 'boss', trackedStat: choice.trackedStat, statGoal: n, statBasis: 'gain' },
    };
  }
  return {
    ok: true,
    source: 'plugin',
    entryTicked,
    title,
    config: { tileType: 'kill', targetNpcs: choice.targetNpcs, requiredAmount: n },
  };
}

/** "5 CoX + CoX CM + ToB + ToB HM" — or "5 raids (any mode)" when everything is ticked. */
export function raidTitle(sel: RaidSelection, n: number): string {
  const picked = selectedRaidModes(sel);
  const prefix = n > 1 ? `${n.toLocaleString('en-US')} ` : '';
  if (picked.length === 0) return `${prefix}raids`;
  // A whole raid ticked (every non-Entry mode) reads as the raid's short name.
  const parts: string[] = [];
  const whole: RaidId[] = [];
  for (const raid of RAID_OPTIONS) {
    const mine = picked.filter((p) => p.raid.id === raid.id).map((p) => p.mode.id);
    if (mine.length === 0) continue;
    const nonEntry = raid.modes.filter((m) => m.id !== 'entry').map((m) => m.id);
    if (nonEntry.every((m) => mine.includes(m)) && mine.length === nonEntry.length) {
      whole.push(raid.id);
      parts.push(raid.modes.length === 1 ? raid.short : `${raid.short} (any mode)`);
    } else {
      for (const m of raid.modes) if (mine.includes(m.id)) parts.push(m.short);
    }
  }
  // Say "no Entry" only where it is a choice someone might have assumed the other way: a whole
  // ToB/ToA ticked without its Entry mode.
  const noEntry = whole.some((r) => r === 'tob' || r === 'toa');
  if (whole.length === RAID_OPTIONS.length) return n > 1 ? `${prefix}raids (any raid${noEntry ? ', no Entry' : ''})` : `Any raid${noEntry ? ' (no Entry)' : ''}`;
  return `${prefix}${parts.join(' + ')}${noEntry ? ' (no Entry)' : ''}`;
}

// ─── Several bosses on one tile ──────────────────────────────────────────────────────────────

/**
 * A boss family: several bosses whose kills count together on one tile. Members are hiscores keys
 * or exact count-line names (an awakened DT2 boss is only a count line); lib/killSource then picks
 * the engine — every member on the hiscores → one stat tile whose keys' gains SUM, anything off
 * them (the awakened variants) → a plugin kill tile listing every name.
 */
export interface BossFamily {
  key: string;
  name: string;
  /** Phrases that name the family as a whole ("dt2 bosses", "wildy bosses"). */
  aliases: string[];
  members: string[];
}

const AWAKENED = COUNTER_TARGETS.filter((c) => c.name.endsWith(' (awakened)')).map((c) => c.name);

export const BOSS_FAMILIES: BossFamily[] = [
  { key: 'nightmare', name: 'Nightmare (any)', aliases: ['nightmare any', 'any nightmare', 'both nightmare', 'nightmare any mode', 'all nightmare'], members: ['nightmare', 'phosanisNightmare'] },
  { key: 'gauntlet', name: 'Gauntlet (any)', aliases: ['gauntlet any', 'any gauntlet', 'gauntlet any mode', 'both gauntlet', 'gauntlet cg'], members: ['gauntlet', 'corruptedGauntlet'] },
  { key: 'dt2', name: 'Desert Treasure II bosses', aliases: ['dt2', 'dt2 bosses', 'desert treasure 2', 'desert treasure ii'], members: ['dukeSucellus', 'leviathan', 'vardorvis', 'whisperer'] },
  { key: 'dt2-awakened', name: 'Awakened DT2 bosses', aliases: ['awakened dt2', 'dt2 awakened', 'awakened bosses', 'awakened'], members: AWAKENED },
  // Each DT2 boss with its awakened version (separate counters in game, one tile here).
  ...AWAKENED.map((name) => {
    const base = name.replace(/ \(awakened\)$/, '');
    const key = hiscoresKeyForMonster(base) ?? base;
    return { key: `${key}-any`, name: `${base} (any)`, aliases: [`${base} any`, `${base} awakened or normal`, `any ${base}`], members: [key, name] };
  }),
  { key: 'wildy', name: 'Wilderness bosses', aliases: ['wildy bosses', 'wilderness bosses', 'wildy', 'wilderness boss'], members: ['callisto', 'artio', 'vetion', 'calvarion', 'venenatis', 'spindel', 'chaosElemental', 'chaosFanatic', 'crazyArchaeologist', 'scorpia'] },
  { key: 'callisto', name: 'Callisto or Artio', aliases: ['callisto any', 'callisto artio', 'any callisto'], members: ['callisto', 'artio'] },
  { key: 'vetion', name: 'Vet’ion or Calvar’ion', aliases: ['vetion any', 'vetion calvarion', 'any vetion'], members: ['vetion', 'calvarion'] },
  { key: 'venenatis', name: 'Venenatis or Spindel', aliases: ['venenatis any', 'venenatis spindel', 'any venenatis'], members: ['venenatis', 'spindel'] },
  { key: 'gwd', name: 'God Wars generals', aliases: ['gwd', 'god wars', 'gwd bosses', 'god wars dungeon', 'gwd generals'], members: ['generalGraardor', 'commanderZilyana', 'kreeArra', 'krilTsutsaroth'] },
  { key: 'dks', name: 'Dagannoth Kings', aliases: ['dks', 'dagannoth kings', 'dag kings'], members: ['dagannothPrime', 'dagannothRex', 'dagannothSupreme'] },
  { key: 'archaeologists', name: 'Archaeologists', aliases: ['archaeologists', 'archaeologist any'], members: ['crazyArchaeologist', 'derangedArchaeologist'] },
].filter((f) => f.members.length >= 2 && f.members.every((m) => BOSSES.some((b) => b.key === m) || COUNTER_TARGETS.some((c) => c.name === m)));

/** Display label for one pick (a hiscores key or a count-line name). */
export function killPickLabel(pick: string): string {
  return hiscoresKeyLabel(pick);
}

/** The family whose members are exactly these picks, if any. */
export function familyFor(picks: string[]): BossFamily | null {
  const set = new Set(picks.map(normPick));
  return BOSS_FAMILIES.find((f) => f.members.length === set.size && f.members.every((m) => set.has(normPick(m)))) ?? null;
}

function normPick(p: string): string {
  return (hiscoresKeyForMonster(p) ?? p).toLowerCase();
}

export interface KillPicksResult {
  ok: boolean;
  error?: string;
  source: KillSource | null;
  /** "Nightmare + Phosani's Nightmare", or the family name. */
  what: string;
  config: Partial<TileConfig>;
}

/** Several bosses / monsters / counters whose kills count together on one tile. */
export function killPicksConfig(picks: string[], amount: number | null): KillPicksResult {
  const n = amount && amount > 0 ? amount : 1;
  const family = familyFor(picks);
  const what = family?.name ?? picks.map(killPickLabel).join(' + ');
  const choice = chooseKillSource(picks);
  if (!choice.ok) return { ok: false, error: choice.error, source: null, what, config: {} };
  if (choice.source === 'hiscores') {
    return { ok: true, source: 'hiscores', what, config: { tileType: 'standard', statType: 'boss', trackedStat: choice.trackedStat, statGoal: n, statBasis: 'gain' } };
  }
  return { ok: true, source: 'plugin', what, config: { tileType: 'kill', targetNpcs: choice.targetNpcs, requiredAmount: n } };
}

/** The picks a kills config carries (stat keys or plugin target names). */
export function killPicksOf(config: Partial<TileConfig>): string[] {
  if (config.tileType === 'kill') return config.targetNpcs ?? [];
  if (config.statType === 'boss' && config.trackedStat) return config.trackedStat.split(',').map((k) => k.trim()).filter(Boolean);
  return [];
}

// ─── Barracuda Trials ────────────────────────────────────────────────────────────────────────

export interface TrialCourseOption {
  id: (typeof TRIAL_COURSES)[number];
  label: string;
  /** Sailing level the course unlocks at. */
  level: number;
}

// Sailing levels per course come from lib/barracudaTrials. The ranks on a course unlock in order
// (Swordfish → Shark → Marlin) by beating the previous rank, not by level.
export const TRIAL_COURSE_OPTIONS: TrialCourseOption[] = [
  { id: 'tempor tantrum', label: 'The Tempor Tantrum', level: TRIAL_COURSE_LEVELS['tempor tantrum'] },
  { id: 'jubbly jive', label: 'The Jubbly Jive', level: TRIAL_COURSE_LEVELS['jubbly jive'] },
  { id: 'gwenith glide', label: 'The Gwenith Glide', level: TRIAL_COURSE_LEVELS['gwenith glide'] },
];

export const TRIAL_RANK_OPTIONS_UI: { id: (typeof TRIAL_RANKS)[number]; label: string; unlock: string }[] = [
  { id: 'swordfish', label: 'Swordfish', unlock: 'first' },
  { id: 'shark', label: 'Shark', unlock: 'after Swordfish' },
  { id: 'marlin', label: 'Marlin', unlock: 'after Shark' },
];

/** "Gwenith Glide — Marlin": the timed tile's activity, exactly as the trial picker offers it. */
export function trialActivity(course: string, rank: string): string | null {
  const c = TRIAL_COURSES.indexOf(course as (typeof TRIAL_COURSES)[number]);
  const r = TRIAL_RANKS.indexOf(rank as (typeof TRIAL_RANKS)[number]);
  if (c < 0 || r < 0) return null;
  return TRIAL_RANK_ACTIVITIES[c * TRIAL_RANKS.length + r] ?? null;
}

/**
 * A trial rank tile: a timed tile gated on the rank the game reports (never a time cap).
 * `requiredAmount` is the runs needed — the tile routes honour it on the rank-runs branch.
 */
export function trialTileConfig(course: string, rank: string, runs: number | null): Partial<TileConfig> | null {
  const activity = trialActivity(course, rank);
  if (!activity) return null;
  return {
    tileType: 'timed',
    timedActivity: activity,
    timeThresholdSeconds: null,
    requiredAmount: runs && runs > 0 ? runs : 1,
  };
}

// ─── Items ───────────────────────────────────────────────────────────────────────────────────

export type ItemHow = 'gain' | 'drop';
/** Any 1 of them / N in total (repeats count) / one of each (a set). */
export type ItemNeed = 'any' | 'total' | 'each';

export function itemTileConfig(opts: {
  items: { id: number; name: string }[];
  how: ItemHow;
  need: ItemNeed;
  amount: number | null;
  sources?: string[];
}): Partial<TileConfig> | null {
  const { items, how, need } = opts;
  if (items.length === 0) return null;
  const ids = items.map((i) => i.id);
  const n = need === 'total' ? Math.max(1, opts.amount ?? 1) : 1;
  if (how === 'gain') {
    // Gain tiles track a flat pool — "one of each" is a set, which only a drop tile can carry.
    return { tileType: 'gain', trackedItemIds: ids, itemRequirements: null, requiredAmount: n, sourceNpcs: null };
  }
  const sources = opts.sources && opts.sources.length > 0 ? opts.sources : null;
  if (need === 'each' && items.length > 1) {
    return {
      tileType: 'drop',
      trackedItemIds: null,
      itemRequirements: items.map((i) => ({ itemId: i.id, name: i.name, requiredAmount: 1, group: null })),
      requiredAmount: null,
      sourceNpcs: sources,
    };
  }
  return { tileType: 'drop', trackedItemIds: ids, itemRequirements: null, requiredAmount: n, sourceNpcs: sources };
}

// ─── How it counts ───────────────────────────────────────────────────────────────────────────

export type CountEngine = 'hiscores' | 'plugin' | 'screenshot';

/**
 * The one line an admin reads to know how a tile will be credited. The engine comes off the same
 * classification players see (lib/tileKinds howTileCounts); the wording is for whoever builds the
 * board, so it names what the plugin actually reads.
 */
export function howItCountsLine(config: Partial<TileConfig>): { engine: CountEngine; text: string } {
  const kind = configKind(config);
  const base = howTileCounts(kind, false);
  if (!base.auto) return { engine: 'screenshot', text: 'Needs a screenshot: staff approve each one.' };
  if (kind === 'skill') return { engine: 'hiscores', text: 'Counts by itself from the hiscores. Only XP gained during the event counts.' };
  if (kind === 'boss') return { engine: 'hiscores', text: 'Counts by itself from the hiscores. Nothing to upload.' };
  switch (kind) {
    case 'kill':
      return { engine: 'plugin', text: 'Counts by itself: the plugin reads the in-game count line as players go.' };
    case 'lap':
      return { engine: 'plugin', text: 'Counts by itself off the in-game counter. Only runs during the event count.' };
    case 'gain':
      return { engine: 'plugin', text: 'Counts by itself: the plugin sees them land in the inventory. Banking and trades never count.' };
    case 'drop':
    case 'collection':
      return { engine: 'plugin', text: 'Counts by itself: the plugin spots the drop and keeps a screenshot.' };
    case 'timed':
      return config.timedActivity && / — (Swordfish|Shark|Marlin)$/.test(config.timedActivity)
        ? { engine: 'plugin', text: 'Counts by itself: the plugin reads the rank the game announces after each run.' }
        : { engine: 'plugin', text: 'Counts by itself: the plugin times the run off the game’s completion line.' };
    case 'diary':
    case 'ca':
      return { engine: 'plugin', text: 'Counts by itself off the completion message in chat.' };
    case 'deathless':
      return { engine: 'plugin', text: 'Counts by itself: the plugin watches for deaths in the raid.' };
    case 'lms':
      return { engine: 'plugin', text: 'Counts by itself when the game ends.' };
    case 'pvp':
      return { engine: 'plugin', text: 'Counts by itself in the Wilderness and on PvP worlds. Safe minigames never count.' };
    case 'value':
      return { engine: 'plugin', text: 'Counts by itself: the plugin prices each haul.' };
    default:
      return { engine: 'plugin', text: base.text };
  }
}

/** tileKindKey over an editor config (arrays where the stored row has JSON text). */
export function configKind(config: Partial<TileConfig>): TileKindKey {
  const reqs = config.itemRequirements;
  return tileKindKey({
    tileType: config.tileType ?? 'standard',
    trackedStat: config.trackedStat ?? null,
    statType: config.statType ?? null,
    itemRequirements: reqs && reqs.length > 0 ? JSON.stringify(reqs) : null,
    targetNpcs: config.targetNpcs ?? null,
  } as TileKindLike);
}

// ─── A finished draft ────────────────────────────────────────────────────────────────────────

export interface TileDraft {
  label: string;
  /** What the tile tracks: kind fields only (anything not named is cleared on save). */
  config: Partial<TileConfig>;
  points: number | null;
  trackingMode: 'team' | 'individual';
  category?: string | null;
  description?: string | null;
}

// Every field that says what a tile tracks, cleared — the same defaults the full editor's save
// starts from, so a draft can never leave a previous kind's fields behind.
export const KIND_FIELDS_NULL = {
  tileType: 'standard',
  trackedStat: null,
  statType: null,
  statGoal: null,
  statBasis: 'gain',
  requiredAmount: null,
  trackedItemIds: null,
  itemRequirements: null,
  groupMode: null,
  setsRequired: null,
  countMode: null,
  perKillCap: null,
  coopCredit: null,
  coopMinMembers: null,
  sourceNpcs: null,
  targetNpcs: null,
  timedActivity: null,
  timeThresholdSeconds: null,
  partySize: null,
  minRaidLevel: null,
  partyTeamOnly: null,
  pvpMinLootValue: null,
} as const;

/** Kinds where "as a team" vs "one player alone" means something (the full editor shows the toggle). */
export function supportsTrackingMode(config: Partial<TileConfig>): boolean {
  const kind = configKind(config);
  return ['skill', 'boss', 'kill', 'lap', 'pvp', 'diary', 'ca', 'gain'].includes(kind);
}

/**
 * The draft's kind fields, made consistent for the tile API: the amount lands on the field this
 * kind uses, and a trial's runs-needed is only sent when it is more than one (one run is what a
 * timed tile means without it).
 */
export function draftKindFields(config: Partial<TileConfig>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...KIND_FIELDS_NULL };
  for (const [k, v] of Object.entries(config)) if (k in KIND_FIELDS_NULL && v !== undefined) out[k] = v;
  if (out.tileType === 'timed' && typeof out.requiredAmount === 'number' && out.requiredAmount <= 1) out.requiredAmount = null;
  // A collection carries per-item counts; the API derives its total.
  if (Array.isArray(out.itemRequirements) && out.itemRequirements.length > 0) out.requiredAmount = null;
  return out;
}

/** The PUT body the tile API takes for this draft — the same shape the full editor sends. */
export function draftPayload(draft: TileDraft, tileId: number, baseUpdatedAt: string | null): Record<string, unknown> {
  return {
    tileId,
    baseUpdatedAt,
    label: draft.label.trim() || undefined,
    description: draft.description ?? null,
    points: draft.points != null ? Math.max(0, Math.round(draft.points)) : 1,
    category: draft.category?.trim() || null,
    ...draftKindFields(draft.config),
    trackingMode: supportsTrackingMode(draft.config) ? draft.trackingMode : 'team',
  };
}

/** The full editor's starting point for this draft ("More options" opens it prefilled). */
export function draftToTileConfig(base: TileConfig, draft: TileDraft): TileConfig {
  const kind = draftKindFields(draft.config) as Partial<TileConfig>;
  return {
    ...base,
    ...kind,
    // The editor shows a trial's runs-needed when it knows about them; keep the number either way.
    requiredAmount: draft.config.requiredAmount ?? kind.requiredAmount ?? null,
    label: draft.label.trim() || base.label,
    points: draft.points ?? base.points,
    trackingMode: draft.trackingMode,
    category: draft.category ?? base.category,
    description: draft.description ?? base.description,
  };
}

/** The bulk importer's row for this draft (POST tiles/import with append: true). */
export function draftToCsvRow(draft: TileDraft): TileCsvRow {
  const c = draftKindFields(draft.config) as Partial<TileConfig> & Record<string, unknown>;
  const row: TileCsvRow = {
    label: draft.label.trim(),
    tileType: (c.tileType as string) ?? 'standard',
    points: draft.points ?? null,
    category: draft.category ?? null,
    description: draft.description ?? null,
    requiredAmount: (c.requiredAmount as number | null) ?? null,
    trackedStat: c.trackedStat ?? null,
    statType: c.statType ?? null,
    statGoal: c.statGoal ?? null,
    statBasis: c.statGoal != null ? (c.statBasis ?? 'gain') : null,
    targetNpcs: c.targetNpcs ?? null,
    timedActivity: c.timedActivity ?? null,
    timeThresholdSeconds: c.timeThresholdSeconds ?? null,
    countMode: c.countMode ?? null,
    perKillCap: c.perKillCap ?? null,
  };
  const reqs = draft.config.itemRequirements;
  if (reqs && reqs.length > 0) {
    row.items = reqs.map((r) => ({ name: r.name, id: r.itemId, count: r.requiredAmount }));
    row.requiredAmount = null;
  } else if (draft.config.trackedItemIds && draft.config.trackedItemIds.length > 0) {
    // Ids pin the exact item; the importer only falls back to the name when no id is given.
    row.items = draft.config.trackedItemIds.map((id) => ({ name: '', id, count: 1 }));
  }
  return row;
}
