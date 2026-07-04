// Shared tile-filtering helpers used by the admin Tiles tab and the public board.
// Two orthogonal facets:
//   • category — the free-text grouping stored on each tile (e.g. "Raids", "Slayer", "Troll").
//   • tier     — a difficulty band derived from the tile's point value. The bands are
//                admin-configurable (DB-backed) and served to every surface (web + plugin) so
//                they can be retuned without a code change. DEFAULT_TIER_BANDS is the fallback.
// Keep the band shape + tier math here so every consumer stays consistent.

export interface TierBand {
  /** Stable identifier used in filter state (slug). */
  key: string;
  /** Human label shown on the filter chip. */
  label: string;
  /** Inclusive lower bound on points. Bands are sorted ascending; the highest matched wins. */
  min: number;
}

// Default bands — the seed/fallback when the clan hasn't customised them in the admin panel.
// Mirrored by the plugin's baked-in fallback for when the server is unreachable.
export const DEFAULT_TIER_BANDS: TierBand[] = [
  { key: 'troll', label: 'Troll', min: 0 },
  { key: 'easy', label: 'Easy', min: 11 },
  { key: 'medium', label: 'Medium', min: 100 },
  { key: 'hard', label: 'Hard', min: 350 },
  { key: 'ultra', label: 'Ultra', min: 700 },
];

/**
 * The band key a point value falls into — the highest band whose `min` it meets. The lowest band
 * is the catch-all floor, the highest is uncapped, so every value maps to exactly one band.
 * Returns null only when `bands` is empty.
 */
export function tileTierKey(points: number | null | undefined, bands: TierBand[] = DEFAULT_TIER_BANDS): string | null {
  if (!bands.length) return null;
  const p = points ?? 1;
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  let key = sorted[0].key;
  for (const b of sorted) {
    if (p >= b.min) key = b.key;
  }
  return key;
}

// Difficulty ramp for tier dot indicators — a band's position in the ascending list maps onto
// a grey → green → yellow → orange → red → purple severity ramp, so it works for any number of
// admin-configured bands (5 defaults hit grey/green/yellow/orange/purple).
const TIER_RAMP = ['#9ca3af', '#4ade80', '#facc15', '#fb923c', '#f87171', '#c084fc'];

/** Indicator colour for the band at `index` of `count` ascending bands. */
export function tierColor(index: number, count: number): string {
  if (count <= 1) return TIER_RAMP[1];
  const t = Math.max(0, Math.min(1, index / (count - 1)));
  return TIER_RAMP[Math.floor(t * (TIER_RAMP.length - 1))];
}

/** Slugify a label into a stable key (lowercase, alnum + dashes). */
function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Validate/normalise raw band input (DB JSON or admin form) into a clean, ascending, de-duplicated
 * list. Drops entries with no label or an invalid `min`; backfills keys from labels; caps sizes.
 * Returns [] for anything unusable so callers fall back to DEFAULT_TIER_BANDS.
 */
export function normalizeTierBands(raw: unknown): TierBand[] {
  if (!Array.isArray(raw)) return [];
  const out: TierBand[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label.trim().slice(0, 24) : '';
    if (!label) continue;
    const min = Number(r.min);
    if (!Number.isFinite(min) || min < 0) continue;
    const base = (typeof r.key === 'string' && r.key.trim() ? slugify(r.key) : slugify(label)) || 'tier';
    let key = base;
    let n = 2;
    while (seen.has(key)) key = `${base}-${n++}`;
    seen.add(key);
    out.push({ key, label, min: Math.floor(min) });
  }
  out.sort((a, b) => a.min - b.min);
  return out;
}

/**
 * Split a tile's `category` field into its comma-separated tags — a tile can carry several
 * (e.g. "Inferno, PvM"). Trimmed, empties dropped, de-duplicated case-insensitively with the
 * first-seen casing kept.
 */
export function splitCategories(value: unknown): string[] {
  const raw = normalizeCategory(value);
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const tag = part.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** True when one of the tile's category tags equals `tag` (case-insensitive). */
export function tileHasCategory(value: unknown, tag: string): boolean {
  const needle = tag.trim().toLowerCase();
  return splitCategories(value).some((c) => c.toLowerCase() === needle);
}

/**
 * Sorted, de-duplicated list of the category tags actually present on a set of tiles.
 * Multi-tag categories contribute each tag individually; casing collisions collapse to the
 * first-seen form.
 */
export function tileCategories(tiles: { category?: string | null }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tiles) {
    for (const tag of splitCategories(t.category)) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Coerce a tile's `category` to a trimmed string. Old/legacy events can store a
 * non-string value (e.g. a number), so we can't rely on optional chaining alone —
 * `value?.trim()` still throws when `value` is a number. Returns '' for absent or
 * non-stringifiable values.
 */
export function normalizeCategory(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}
