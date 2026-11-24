// RuneLite Ground Markers: the JSON its world-map-orb menu exports and imports. PURE.
//
// Format, from the plugin's own source (runelite-client …/plugins/groundmarkers):
//   GroundMarkerSharingManager reads the clipboard with gson as List<GroundMarkerPoint>;
//   GroundMarkerPoint = { int regionId, int regionX, int regionY, int z, @Nullable Color color,
//   @Nullable String label }. The menu entries are "Export" / "Import" "Ground Markers" on the
//   world map orb (right-click it).
// Colours travel as "#AARRGGBB" (RuneLite's colour adapter); we also take "#RRGGBB" and write the
// alpha form. Static tiles only — Anvil never computes or moves markers.

import type { GroundMarkerPoint } from './guideTiers';

export const MARKERS_MAX = 500;
const LABEL_MAX = 40;
/** The line under the copy button: where the import lives in RuneLite. */
export const MARKERS_IMPORT_HINT = 'Paste in RuneLite: right-click the world map orb → Import Ground Markers';

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

/** A label as plain text: no markup, no control characters, short. */
export function cleanMarkerLabel(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LABEL_MAX);
  return s || null;
}

/** "#AARRGGBB" from "#AARRGGBB" / "#RRGGBB"; anything else → null (the plugin's default colour). */
export function cleanMarkerColor(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v.trim());
  if (!m) return null;
  return `#${m[1].length === 6 ? 'FF' : ''}${m[1]}`.toUpperCase();
}

export type MarkersResult = { ok: true; points: GroundMarkerPoint[] } | { ok: false; error: string };

/** Parse a pasted export. Every point must be whole; one bad point rejects the paste, saying which. */
export function parseGroundMarkers(text: string): MarkersResult {
  const raw = text.trim();
  if (!raw) return { ok: true, points: [] };
  if (raw.length > 100_000) return { ok: false, error: 'That paste is too long for a marker set.' };
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Not a Ground Markers export: paste what "Export Ground Markers" copied.' };
  }
  if (!Array.isArray(j)) return { ok: false, error: 'A Ground Markers export is a list ([ … ]).' };
  if (j.length > MARKERS_MAX) return { ok: false, error: `At most ${MARKERS_MAX} tiles.` };
  const points: GroundMarkerPoint[] = [];
  for (let i = 0; i < j.length; i++) {
    const p = j[i] as Record<string, unknown> | null;
    const regionId = int(p?.regionId, 0, 65_535);
    const regionX = int(p?.regionX, 0, 63);
    const regionY = int(p?.regionY, 0, 63);
    const z = int(p?.z, 0, 3);
    if (!p || typeof p !== 'object' || regionId == null || regionX == null || regionY == null || z == null) {
      return { ok: false, error: `Tile ${i + 1} isn't a ground marker (needs regionId, regionX 0–63, regionY 0–63, z 0–3).` };
    }
    const color = cleanMarkerColor(p.color);
    const label = cleanMarkerLabel(p.label);
    points.push({ regionId, regionX, regionY, z, ...(color ? { color } : {}), ...(label ? { label } : {}) });
  }
  return { ok: true, points };
}

/** Clean stored points again (a block written by hand, or by an older editor). */
export function sanitizeMarkers(v: unknown): GroundMarkerPoint[] {
  if (!Array.isArray(v)) return [];
  const r = parseGroundMarkers(JSON.stringify(v.slice(0, MARKERS_MAX)));
  return r.ok ? r.points : [];
}

/** What the copy button puts on the clipboard: the plugin's own shape. */
export function groundMarkersJson(points: GroundMarkerPoint[]): string {
  return JSON.stringify(sanitizeMarkers(points));
}

export const markerCountLabel = (n: number) => `${n} tile${n === 1 ? '' : 's'}`;
