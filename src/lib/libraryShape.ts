// The shape of the task library, so you can see what a generated board will feel like.
//
// The library page was a flat list of every task sorted by points. It answered "what is in here"
// and nothing else — you couldn't see that Ultra held four tasks until a board drew three of them
// twice, or that half the pool was Slayer, or that two people had both added "Abyssal whip".
//
// This derives the facts a curator actually needs before generating a board: how the pool spreads
// across the difficulty bands, which categories and tile kinds it leans on, and the handful of
// things that are outright defects (a duplicate, a task worth nothing, a band nothing can fall in).
//
// Every finding is a statement of fact about the pool, never a guess about the board someone might
// build — "Ultra holds 4 tasks" is true and useful; "your board will break" would be neither.
//
// Pure and dependency-free (no `@/` imports) so tests/library-shape.test.ts can run it directly
// with Node type-stripping, the same way lib/eventStage and lib/scheduleLanes do.

export interface ShapeTask {
  id: number;
  label: string;
  points: number;
  category: string | null;
  /** Band key, already derived from points by the caller. */
  tier: string | null;
  tileType: string;
}

export interface ShapeBand {
  key: string;
  label: string;
}

export interface TierSlice {
  key: string;
  label: string;
  count: number;
  /** Share of the whole library, 0–1. */
  share: number;
  /** Point range actually present in this band, or null when it holds nothing. */
  range: { min: number; max: number } | null;
}

export interface CountedSlice {
  key: string;
  count: number;
}

export type FindingLevel = 'warn' | 'info';

export interface Finding {
  key: string;
  level: FindingLevel;
  message: string;
  /** Task ids the finding is about, when it points at specific rows. */
  ids: number[];
}

export interface LibraryShape {
  total: number;
  tiers: TierSlice[];
  categories: CountedSlice[];
  kinds: CountedSlice[];
  findings: Finding[];
  /** The thinnest band that holds anything — the ceiling on an unrepeated draw. */
  thinnest: TierSlice | null;
}

/** Below this, a band is thin enough that a board of any size will start repeating. */
const THIN_BAND = 5;

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Case- and space-insensitive, so "Abyssal whip" and "abyssal  whip" collide as they should. */
function normalise(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function libraryShape(tasks: ShapeTask[], bands: ShapeBand[]): LibraryShape {
  const total = tasks.length;

  const tiers: TierSlice[] = bands.map((band) => {
    const inBand = tasks.filter((t) => t.tier === band.key);
    const points = inBand.map((t) => t.points);
    return {
      key: band.key,
      label: band.label,
      count: inBand.length,
      share: total > 0 ? inBand.length / total : 0,
      range: points.length ? { min: Math.min(...points), max: Math.max(...points) } : null,
    };
  });

  const tally = (pick: (t: ShapeTask) => string | null): CountedSlice[] => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const key = pick(t);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  };

  const categories = tally((t) => t.category);
  const kinds = tally((t) => t.tileType);

  const findings: Finding[] = [];

  // Duplicates. Two tasks with the same name can both be drawn onto one board, which reads as a
  // bug to every player who sees it.
  const byLabel = new Map<string, ShapeTask[]>();
  for (const t of tasks) {
    const key = normalise(t.label);
    if (!key) continue;
    byLabel.set(key, [...(byLabel.get(key) ?? []), t]);
  }
  const dupes = [...byLabel.values()].filter((group) => group.length > 1);
  if (dupes.length > 0) {
    findings.push({
      key: 'duplicates',
      level: 'warn',
      message: `${plural(dupes.length, 'task is', 'tasks are')} in the pool twice — a board can draw both copies.`,
      ids: dupes.flat().map((t) => t.id),
    });
  }

  // A task worth nothing can be drawn but never scores.
  const zero = tasks.filter((t) => t.points <= 0);
  if (zero.length > 0) {
    findings.push({
      key: 'zero-points',
      level: 'warn',
      message: `${plural(zero.length, 'task is', 'tasks are')} worth 0 points — they can be drawn but never score.`,
      ids: zero.map((t) => t.id),
    });
  }

  // A band with nothing in it can never be drawn from, which usually means the bands were retuned
  // and nobody wrote the tasks to match.
  const empty = tiers.filter((t) => t.count === 0);
  if (empty.length > 0 && total > 0) {
    findings.push({
      key: 'empty-bands',
      level: 'warn',
      message: `${empty.map((t) => t.label).join(', ')} ${empty.length === 1 ? 'has' : 'have'} no tasks — nothing can be drawn at that difficulty.`,
      ids: [],
    });
  }

  // Thin bands. Stated as the fact it is: this is the most tiles you can ask for without a repeat.
  const thin = tiers.filter((t) => t.count > 0 && t.count < THIN_BAND);
  for (const band of thin) {
    findings.push({
      key: `thin-${band.key}`,
      level: 'info',
      message: `${band.label} holds ${plural(band.count, 'task')} — ask a board for more than ${band.count} and one repeats.`,
      ids: [],
    });
  }

  // A pool leaning hard on one category makes every board feel the same.
  const top = categories[0];
  if (top && total >= 10 && top.count / total > 0.4) {
    findings.push({
      key: 'lopsided',
      level: 'info',
      message: `${Math.round((top.count / total) * 100)}% of the pool is ${top.key} — boards will lean that way.`,
      ids: [],
    });
  }

  const filled = tiers.filter((t) => t.count > 0);
  const thinnest = filled.length
    ? filled.reduce((min, t) => (t.count < min.count ? t : min))
    : null;

  return { total, tiers, categories, kinds, findings, thinnest };
}
