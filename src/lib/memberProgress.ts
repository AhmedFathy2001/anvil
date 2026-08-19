// Account progress that isn't a hiscores number: quest points, combat-achievement points and tier,
// achievement diaries. The game knows all of it, the hiscores publish none of it, and until now the
// plugin only ever spent it — crediting a tile, firing a Discord line — and then forgot it.
//
// KEYED rows, one per (member, key), rather than a wide row per member: a login pushes only what
// actually moved, which is usually nothing and never more than one or two keys, so an idle clan
// costs no writes. It also means adding a key later is a registry entry rather than a migration.
//
// Pure: the registry is data, the clamps are arithmetic, and tests/member-progress.test.ts runs it
// without a database.

export type ProgressGroup = 'quests' | 'combat' | 'diaries';

export interface ProgressKey {
  key: string;
  label: string;
  group: ProgressGroup;
  /** The most this can ever be, for progress bars. Null when the game keeps moving the ceiling. */
  max: number | null;
  /** Guard against a client reporting nonsense — anything above is refused, not clamped silently. */
  ceiling: number;
}

/**
 * Diary regions we can read a straight yes/no from: eleven of the twelve. Karamja's easy, medium and
 * hard tiers have no completion varbit — the game tracks them as task COUNTS, whose totals we would
 * have to hardcode and would then be wrong about after any update — so those three are left out
 * rather than guessed at. Karamja elite has a real completion varbit and is counted.
 */
export const DIARY_REGIONS_READABLE = 11;
export const DIARY_REGIONS_ELITE = 12;

/** Tier bits inside a region's stored mask, and inside `caTiers`. */
export const DIARY_EASY = 1;
export const DIARY_MEDIUM = 2;
export const DIARY_HARD = 4;
export const DIARY_ELITE = 8;
export const DIARY_TIERS: { bit: number; label: string; short: string }[] = [
  { bit: DIARY_EASY, label: 'Easy', short: 'E' },
  { bit: DIARY_MEDIUM, label: 'Medium', short: 'M' },
  { bit: DIARY_HARD, label: 'Hard', short: 'H' },
  { bit: DIARY_ELITE, label: 'Elite', short: 'El' },
];

/**
 * The twelve diary regions, in the order the game's own interface lists them, with the key each
 * one's tier mask is stored under. Karamja carries `unreadable`: only its ELITE tier has a
 * completion varbit, so its other three are shown as unknown rather than as unfinished.
 */
export const DIARY_REGIONS: { key: string; label: string; unreadable?: number }[] = [
  { key: 'diaryArdougne', label: 'Ardougne' },
  { key: 'diaryDesert', label: 'Desert' },
  { key: 'diaryFalador', label: 'Falador' },
  { key: 'diaryFremennik', label: 'Fremennik' },
  { key: 'diaryKandarin', label: 'Kandarin' },
  // Easy | Medium | Hard are unreadable here — see DIARY_REGIONS_READABLE.
  { key: 'diaryKaramja', label: 'Karamja', unreadable: DIARY_EASY | DIARY_MEDIUM | DIARY_HARD },
  { key: 'diaryKourend', label: 'Kourend & Kebos' },
  { key: 'diaryLumbridge', label: 'Lumbridge & Draynor' },
  { key: 'diaryMorytania', label: 'Morytania' },
  { key: 'diaryVarrock', label: 'Varrock' },
  { key: 'diaryWestern', label: 'Western Provinces' },
  { key: 'diaryWilderness', label: 'Wilderness' },
];

export const PROGRESS_KEYS: ProgressKey[] = [
  {
    key: 'questPoints',
    label: 'Quest points',
    group: 'quests',
    // The cap rises with every quest released, so a bar would be wrong within a month.
    max: null,
    ceiling: 10_000,
  },
  {
    key: 'questsCompleted',
    label: 'Quests completed',
    group: 'quests',
    // The game keeps releasing them, so a denominator would be stale within a month.
    max: null,
    ceiling: 1_000,
  },
  { key: 'caPoints', label: 'Combat achievement points', group: 'combat', max: null, ceiling: 100_000 },
  {
    key: 'caTiers',
    label: 'Combat achievement tiers',
    group: 'combat',
    // A bitmask, not a count: bit 0 is Easy through bit 5 Grandmaster, so every tier the player has
    // cleared lights up rather than only the highest.
    max: null,
    ceiling: 63,
  },
  {
    key: 'caTier',
    label: 'Combat achievement tier',
    group: 'combat',
    // 0 = none, then Easy…Grandmaster.
    max: 6,
    ceiling: 6,
  },
  { key: 'diaryEasy', label: 'Easy diaries', group: 'diaries', max: DIARY_REGIONS_READABLE, ceiling: 20 },
  { key: 'diaryMedium', label: 'Medium diaries', group: 'diaries', max: DIARY_REGIONS_READABLE, ceiling: 20 },
  { key: 'diaryHard', label: 'Hard diaries', group: 'diaries', max: DIARY_REGIONS_READABLE, ceiling: 20 },
  { key: 'diaryElite', label: 'Elite diaries', group: 'diaries', max: DIARY_REGIONS_ELITE, ceiling: 20 },
  // One mask per region, so the grid can show WHICH diary rather than only how many. Kept alongside
  // the four counts above rather than replacing them: a plugin that predates the regions still fills
  // the summary line, and one that has them fills both.
  ...DIARY_REGIONS.map((r) => ({
    key: r.key,
    label: r.label,
    group: 'diaries' as const,
    max: DIARY_EASY | DIARY_MEDIUM | DIARY_HARD | DIARY_ELITE,
    ceiling: 15,
  })),
];

const byKey = new Map(PROGRESS_KEYS.map((k) => [k.key, k]));

/** The registry entry for a key the client named, or null for one we don't accept. */
export function progressKey(key: string | null | undefined): ProgressKey | null {
  if (!key) return null;
  return byKey.get(key) ?? null;
}

/** CA tiers in order, so a stored 0–6 reads as a name. Index 0 is "hasn't cleared one yet". */
export const CA_TIER_NAMES = ['—', 'Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];

export function caTierName(value: number | null | undefined): string {
  if (value == null || value <= 0) return CA_TIER_NAMES[0];
  return CA_TIER_NAMES[Math.min(value, CA_TIER_NAMES.length - 1)];
}

export interface IncomingProgress {
  key?: unknown;
  value?: unknown;
}

/**
 * What of a push we're willing to store: known keys, whole numbers, inside the key's ceiling.
 *
 * Silently dropping a bad row rather than refusing the request is deliberate — one unknown key from
 * a newer plugin shouldn't cost a member the four good ones alongside it.
 */
export function cleanProgress(rows: IncomingProgress[] | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    const spec = progressKey(typeof row?.key === 'string' ? row.key : null);
    if (!spec) continue;
    const raw = row?.value;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const value = Math.floor(raw);
    if (value < 0 || value > spec.ceiling) continue;
    out.set(spec.key, value);
  }
  return out;
}

/**
 * What actually needs writing.
 *
 * Progress only goes UP: quest points, CA points and diary counts have no way down in a live game,
 * so a lower number is a client that read a varbit before the game had populated it — which is
 * exactly what a fresh login looks like for a few ticks. Taking the max makes the push idempotent
 * and stops a half-loaded client from erasing someone's account.
 */
export function progressUpdates(
  stored: Map<string, number>,
  incoming: Map<string, number>,
): Map<string, number> {
  const updates = new Map<string, number>();
  for (const [key, value] of incoming) {
    const current = stored.get(key);
    if (current == null || value > current) updates.set(key, value);
  }
  return updates;
}

/** A stored row, ready to render: the registry entry plus what this member has. */
export interface ProgressView {
  key: string;
  label: string;
  group: ProgressGroup;
  value: number;
  max: number | null;
  updatedAt: string | null;
}

/**
 * Fold stored rows into the registry's order, dropping keys nobody has pushed yet.
 *
 * Registry order rather than row order, so the strip reads the same for everyone — and a member
 * whose plugin predates a key simply doesn't show that line, rather than showing a zero that looks
 * like a claim about their account.
 */
export function progressView(rows: { key: string; value: number; updatedAt?: string | null }[]): ProgressView[] {
  const byKeyStored = new Map(rows.map((r) => [r.key, r]));
  return PROGRESS_KEYS.flatMap((spec) => {
    const row = byKeyStored.get(spec.key);
    if (!row) return [];
    return [{
      key: spec.key,
      label: spec.label,
      group: spec.group,
      value: row.value,
      max: spec.max,
      updatedAt: row.updatedAt ?? null,
    }];
  });
}

// ── The shape a profile card wants ────────────────────────────────────────────────────────────

export interface DiaryRegionView {
  key: string;
  label: string;
  /** Per tier, in game order: done, not done, or unknown (Karamja's lower three). */
  tiers: { label: string; short: string; state: 'done' | 'todo' | 'unknown' }[];
}

export interface ProgressSummary {
  questPoints: number | null;
  questsCompleted: number | null;
  caPoints: number | null;
  /** Every tier cleared, so the chips light up cumulatively rather than only the highest. */
  caTiers: { name: string; cleared: boolean }[];
  /** Highest cleared tier's name, or '—'. */
  caTier: string;
  regions: DiaryRegionView[];
  /** Diary tiers finished / knowable, across every region we can read. */
  diariesDone: number;
  diariesKnowable: number;
  /** True when we hold nothing at all — the card shouldn't render. */
  empty: boolean;
  updatedAt: string | null;
}

/**
 * Fold stored rows into what a profile draws.
 *
 * Per-region masks are preferred when present; the four summary counts are the fallback for a member
 * whose plugin predates them. Either way the numbers agree, because both are counted here rather
 * than trusted from the client.
 */
export function progressSummary(rows: { key: string; value: number; updatedAt?: string | null }[]): ProgressSummary {
  const byKeyStored = new Map(rows.map((r) => [r.key, r]));
  const value = (key: string): number | null => byKeyStored.get(key)?.value ?? null;

  const regions: DiaryRegionView[] = [];
  let diariesDone = 0;
  let diariesKnowable = 0;
  for (const region of DIARY_REGIONS) {
    const mask = value(region.key);
    if (mask == null) continue;
    regions.push({
      key: region.key,
      label: region.label,
      tiers: DIARY_TIERS.map((tier) => ({
        label: tier.label,
        short: tier.short,
        state: (region.unreadable ?? 0) & tier.bit
          ? 'unknown'
          : mask & tier.bit
            ? 'done'
            : 'todo',
      })),
    });
    for (const tier of DIARY_TIERS) {
      if ((region.unreadable ?? 0) & tier.bit) continue;
      diariesKnowable += 1;
      if (mask & tier.bit) diariesDone += 1;
    }
  }

  // No region masks (an older plugin): fall back to the four counts, which say how many without
  // saying which.
  if (regions.length === 0) {
    const counts = [
      value('diaryEasy'), value('diaryMedium'), value('diaryHard'), value('diaryElite'),
    ];
    if (counts.some((c) => c != null)) {
      diariesDone = counts.reduce<number>((sum, c) => sum + (c ?? 0), 0);
      diariesKnowable = DIARY_REGIONS_READABLE * 3 + DIARY_REGIONS_ELITE;
    }
  }

  const tierMask = value('caTiers');
  const highest = value('caTier') ?? 0;
  const caTiers = CA_TIER_NAMES.slice(1).map((name, i) => ({
    name,
    // A mask says exactly which; without one, everything up to the highest cleared tier is implied.
    cleared: tierMask != null ? (tierMask & (1 << i)) !== 0 : i < highest,
  }));

  const stamps = rows.map((r) => r.updatedAt).filter((v): v is string => !!v).sort();

  return {
    questPoints: value('questPoints'),
    questsCompleted: value('questsCompleted'),
    caPoints: value('caPoints'),
    caTiers,
    caTier: caTierName(highest),
    regions,
    diariesDone,
    diariesKnowable,
    empty: rows.length === 0,
    updatedAt: stamps.length > 0 ? stamps[stamps.length - 1] : null,
  };
}
