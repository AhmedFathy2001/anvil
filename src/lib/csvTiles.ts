// Single documented CSV format for importing/configuring tiles, shared by the event
// create form and the Tiles tab. One source of truth so the format stays reliable for
// open-source users. Header names are matched case-insensitively; column order is free;
// unknown columns are ignored. Row order maps onto tiles by position (row 1 → tile #1).
//
// Columns:
//   label               tile name (required for a meaningful tile; blank → auto "Tile N")
//   description         free-text shown on the tile
//   type                "standard" | "drop" | "kill" | "pvp" | "gain" | "timed" | "deathless" | "lms" | "value" | "valuetotal" | "diary" | "ca"  (stat tiles use trackedStat/statType instead)
//   points              integer reward weight (Leagues scoring)
//   category            grouping tag(s) for the plugin/board filters, comma-separated for
//                       several (e.g. "Inferno, PvM" — quote the cell)
//   optional            true/false — doesn't count toward the total
//   requiredAmount      integer — drop tiles (item count), kill tiles (kill count), lms tiles (qualifying games),
//                       value tiles (gp threshold one haul must meet; "valuetotal" sums hauls toward it)
//   trackedStat         skill/boss key for a stat-tracked tile (e.g. "mining", "zulrah")
//   statType            "skill" | "boss"
//   statGoal            integer XP/KC goal
//   targetNpcs          kill tiles — NPC name(s) to count, pipe-separated (e.g. "Cow|Cow calf");
//                       diary tiles — "<Area> <Tier>" selectors, "Any" wildcards (e.g. "Any Elite|Wilderness Hard");
//                       ca tiles — Combat Achievement task names or "Any <Tier>" wildcards,
//                       pipe-separated ONLY (task names contain commas: "Nylocas, On the Rocks");
//                       pvp tiles — "any" (any player), "team:other" (any rival team member) or "rsn:<name>" bounties
//   timedActivity       timed tiles — activity to time (e.g. "Inferno")
//   timeThresholdSeconds timed tiles — completion-time cap in seconds (e.g. 1800 for 30:00);
//                       lms tiles — placement cap instead (1 = win, 3 = top-3)
//   revealAt            scheduled reveal time (Showdown boards — events whose rules use the
//                       'scheduled' reveal policy; see lib/eventRules). ISO or any parseable
//                       date-time, e.g. "2026-08-01 19:00" (stored as UTC ISO). Blank = the
//                       tile stays hidden until a time is set. Ignored on classic events.
//   items               drop tiles — tracked item(s), "Name:count" semicolon-separated;
//                       append "@Set" for any-one-set collections ("Dharok's helm:1@Dharok")
//                       (e.g. "Blood moon helm:1; Blue moon helm:1"). Count is optional (def 1).
//                       Each entry can be a NAME (resolved to an item ID on import — covers
//                       untradeables/pets too), a raw ID ("12651:1"), or "Name#id" to pin an
//                       exact id with a readable label ("Pet zilyana#12651:1"). With a
//                       requiredAmount set it's a simple drop pool (any item counts toward the
//                       total); without one it's a collection (each item needs its own count).
export const TILE_CSV_COLUMNS = [
  'label',
  'description',
  'type',
  'points',
  'category',
  'optional',
  'requiredAmount',
  'trackedStat',
  'statType',
  'statGoal',
  'targetNpcs',
  'timedActivity',
  'timeThresholdSeconds',
  'revealAt',
  'items',
] as const;

import type { Tile } from '@/lib/types';
import { SKILLS, SKILL_LABELS, BOSSES } from '@/lib/constants';

export interface TileCsvItem {
  /** Item name to resolve on import. Empty when the entry pinned a raw id with no label. */
  name: string;
  count: number;
  /** Explicit item id ("12651:1" or "Name#12651:1") — bypasses name resolution when set. */
  id?: number;
  /** "Any full set" group ("Name:count@Set") — items sharing a set complete together. */
  group?: string;
}

export interface TileCsvRow {
  label?: string;
  description?: string | null;
  tileType?: string;
  requiredAmount?: number | null;
  points?: number | null;
  category?: string | null;
  optional?: boolean;
  trackedStat?: string | null;
  statType?: string | null;
  statGoal?: number | null;
  targetNpcs?: string[] | null;
  timedActivity?: string | null;
  timeThresholdSeconds?: number | null;
  /** Scheduled reveal time (ISO UTC) for Showdown boards; null = stays hidden. */
  revealAt?: string | null;
  items?: TileCsvItem[] | null;
}

// Parse an `items` cell — "Name:count; Name2:count2". Count is optional (defaults to 1) and is
// taken from the LAST colon so item names containing a colon still mostly work. Each entry's
// item part can be a name ("Blood moon helm"), a raw id ("12651"), or "Name#id" ("Pet zilyana#12651").
function parseItemsCell(v: string): TileCsvItem[] {
  return v
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((rawEntry): TileCsvItem | null => {
      // Split a trailing "@Set" off first ("Name:count@Set"), then ":count" (both optional).
      let entry = rawEntry;
      let group: string | undefined;
      const at = entry.lastIndexOf('@');
      if (at > 0) {
        const g = entry.slice(at + 1).trim();
        // Only treat it as a set name when it isn't part of the item name (no digits-only ids follow '@').
        if (g && g.length <= 30 && !g.includes(':')) {
          group = g;
          entry = entry.slice(0, at).trim();
        }
      }
      let itemPart = entry;
      let count = 1;
      const ci = entry.lastIndexOf(':');
      if (ci > 0 && /^\d+$/.test(entry.slice(ci + 1).trim())) {
        const n = parseInt(entry.slice(ci + 1).trim(), 10);
        if (n >= 1) {
          count = n;
          itemPart = entry.slice(0, ci).trim();
        }
      }
      // "Name#id" — explicit id with a label.
      const hashed = itemPart.match(/^(.*)#(\d+)$/);
      if (hashed) {
        return { name: hashed[1].trim(), count, id: parseInt(hashed[2], 10), group };
      }
      // Bare numeric — a raw id, no label.
      if (/^\d+$/.test(itemPart)) {
        return { name: '', count, id: parseInt(itemPart, 10), group };
      }
      // Plain name.
      return itemPart ? { name: itemPart, count, group } : null;
    })
    .filter((it): it is TileCsvItem => it != null && (it.name.length > 0 || it.id != null));
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas/newlines, and "" escapes.
function parseCsvGrid(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

function toBool(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}

function toIntOrNull(v: string): number | null {
  const s = v.trim();
  if (s === '') return null;
  const n = parseInt(s.replace(/[, ]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// Forgiving number: accepts thousands separators/underscores and k/m/b suffixes so a human can
// type "10m", "1.5k", "2,000,000" or "2b" instead of a bare integer. Used for the big-number
// columns (XP goals, item/kill counts).
function toNumberLoose(v: string): number | null {
  const s = v.trim().toLowerCase().replace(/[,_ ]/g, '');
  if (s === '') return null;
  const m = s.match(/^(\d*\.?\d+)([kmb])?$/);
  if (m) {
    const mult = m[2] === 'b' ? 1e9 : m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1;
    const n = Math.round(parseFloat(m[1]) * mult);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Forgiving duration → seconds. Accepts "mm:ss" / "hh:mm:ss", bare seconds ("1800"), or a
// unit suffix ("30m", "30 min", "90s", "1h"). So the tricky "timeThresholdSeconds" column stops
// forcing people to pre-convert minutes to seconds in their head.
function toSecondsLoose(v: string): number | null {
  const s = v.trim().toLowerCase().replace(/[,_]/g, '');
  if (s === '') return null;
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => parseInt(p.trim(), 10));
    if (parts.some((n) => !Number.isFinite(n))) return null;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|m|min|mins|s|sec|secs)?$/);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = m[2] ?? '';
  if (unit.startsWith('h')) return Math.round(val * 3600);
  if (unit === 'm' || unit.startsWith('min')) return Math.round(val * 60);
  return Math.round(val); // 's'/'sec'/none → seconds
}

// Forgiving date-time → ISO UTC. Accepts ISO or anything Date.parse understands ("2026-08-01
// 19:00" is treated as the uploader's local time, same as typing it in the tile editor).
// Unparseable → null (the importer surfaces nothing; the tile just stays unscheduled).
function toIsoOrNull(v: string): string | null {
  const s = v.trim();
  if (s === '') return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// Resolve a tracked-stat cell to its stored key + inferred type, accepting either the bare key
// ("mining", "zulrah") or the human label ("Mining", "Zulrah"). Returns null when it matches
// nothing, in which case the raw value is kept for back-compat.
function normalizeTrackedStat(raw: string): { key: string; type: 'skill' | 'boss' } | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  for (const k of SKILLS) {
    if (k.toLowerCase() === s || (SKILL_LABELS[k] || '').toLowerCase() === s) return { key: k, type: 'skill' };
  }
  for (const b of BOSSES) {
    if (b.key.toLowerCase() === s || b.label.toLowerCase() === s) return { key: b.key, type: 'boss' };
  }
  return null;
}

export interface ParsedTileCsv {
  rows: TileCsvRow[];
  /** Per-row label, auto-filled as "Tile N" when blank. Length === rows.length. */
  labels: string[];
  error?: string;
}

/** Parse a tile CSV (with a header row) into typed rows + labels. */
export function parseTileCsv(text: string): ParsedTileCsv {
  return parseTileGrid(parseCsvGrid(text));
}

/**
 * Parse a raw cell grid (header row + data rows) into typed rows + labels. The grid comes from
 * either CSV text (parseTileCsv) or the Tiles sheet of an uploaded .xlsx workbook (server-side
 * parseTileWorkbook), so both upload paths behave identically.
 */
export function parseTileGrid(grid: string[][]): ParsedTileCsv {
  if (grid.length < 2) {
    return { rows: [], labels: [], error: 'The sheet needs a header row and at least one data row.' };
  }
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const col = {
    label: idx('label'),
    description: idx('description'),
    type: idx('type'),
    points: idx('points'),
    category: idx('category'),
    optional: idx('optional'),
    requiredAmount: idx('requiredamount'),
    trackedStat: idx('trackedstat'),
    statType: idx('stattype'),
    statGoal: idx('statgoal'),
    targetNpcs: idx('targetnpcs'),
    timedActivity: idx('timedactivity'),
    timeThresholdSeconds: idx('timethresholdseconds'),
    revealAt: idx('revealat'),
    items: idx('items'),
  };
  if (col.label === -1 && col.description === -1 && col.points === -1) {
    return {
      rows: [],
      labels: [],
      error: 'No recognized columns found. Expected a header like: ' + TILE_CSV_COLUMNS.join(', '),
    };
  }
  const get = (cells: string[], i: number) => (i >= 0 && i < cells.length ? cells[i] : '');
  const rows: TileCsvRow[] = [];
  const labels: string[] = [];
  grid.slice(1).forEach((cells, i) => {
    const row: TileCsvRow = {};
    if (col.label >= 0) row.label = get(cells, col.label).trim();
    if (col.description >= 0) row.description = get(cells, col.description).trim() || null;
    if (col.type >= 0) row.tileType = get(cells, col.type).trim().toLowerCase() || undefined;
    if (col.points >= 0) row.points = toIntOrNull(get(cells, col.points));
    if (col.category >= 0) row.category = get(cells, col.category).trim() || null;
    if (col.optional >= 0) row.optional = toBool(get(cells, col.optional));
    if (col.requiredAmount >= 0) row.requiredAmount = toNumberLoose(get(cells, col.requiredAmount));
    if (col.statType >= 0) row.statType = get(cells, col.statType).trim() || null;
    if (col.trackedStat >= 0) {
      const rawStat = get(cells, col.trackedStat).trim();
      const resolved = rawStat ? normalizeTrackedStat(rawStat) : null;
      // Accept "Mining"/"Zulrah" labels, not just bare keys; infer skill-vs-boss when the
      // statType column was left blank.
      row.trackedStat = resolved ? resolved.key : rawStat || null;
      if (resolved && !row.statType) row.statType = resolved.type;
    }
    if (col.statGoal >= 0) row.statGoal = toNumberLoose(get(cells, col.statGoal));
    if (col.targetNpcs >= 0) {
      // Comma or pipe separated within the cell (comma works when the cell is quoted). CA rows
      // split on pipes ONLY — task names legitimately contain commas ("Nylocas, On the Rocks").
      const sep = row.tileType === 'ca' ? '|' : /[|,]/;
      const names = get(cells, col.targetNpcs).split(sep).map((s) => s.trim()).filter(Boolean);
      row.targetNpcs = names.length > 0 ? names : null;
    }
    if (col.timedActivity >= 0) row.timedActivity = get(cells, col.timedActivity).trim() || null;
    if (col.timeThresholdSeconds >= 0) row.timeThresholdSeconds = toSecondsLoose(get(cells, col.timeThresholdSeconds));
    if (col.revealAt >= 0) row.revealAt = toIsoOrNull(get(cells, col.revealAt));
    if (col.items >= 0) {
      const parsedItems = parseItemsCell(get(cells, col.items));
      row.items = parsedItems.length > 0 ? parsedItems : null;
    }
    rows.push(row);
    labels.push(row.label && row.label.length > 0 ? row.label : `Tile ${i + 1}`);
  });
  return { rows, labels };
}

// ---------------------------------------------------------------------------
// Serialization (tiles → CSV cell values)
// ---------------------------------------------------------------------------

/** A JSON string-array column ("[\"Cow\",\"Cow calf\"]") → pipe-joined "Cow|Cow calf". */
function jsonNamesToPipes(v: string | null | undefined): string {
  if (!v) return '';
  try {
    const arr = JSON.parse(v) as string[];
    return Array.isArray(arr) ? arr.join('|') : '';
  } catch {
    return '';
  }
}

/** Parse a tile's collection config, or null when it isn't a collection tile. */
function parsedItemRequirements(t: Tile): { itemId: number; name: string; requiredAmount: number; group?: string | null }[] | null {
  if (!t.itemRequirements) return null;
  try {
    const reqs = JSON.parse(t.itemRequirements) as { itemId: number; name: string; requiredAmount: number; group?: string | null }[];
    return Array.isArray(reqs) && reqs.length ? reqs : null;
  } catch {
    return null;
  }
}

/**
 * Build the `items` cell for a tile. Lossless round-trip: collection items emit
 * "Name#id:count" (the id pins it even if the name is an untradeable the importer can't
 * resolve); simple-drop pools emit bare ids.
 */
function tileItemsCell(t: Tile): string {
  const reqs = parsedItemRequirements(t);
  if (reqs) {
    return reqs
      .map((r) => {
        const labelled = r.name && !/^Item #\d+$/.test(r.name) ? `${r.name}#${r.itemId}` : `${r.itemId}`;
        const set = r.group?.trim() ? `@${r.group.trim()}` : '';
        return `${labelled}:${r.requiredAmount}${set}`;
      })
      .join('; ');
  }
  if (t.trackedItemIds) {
    try {
      const ids = JSON.parse(t.trackedItemIds) as number[];
      if (Array.isArray(ids) && ids.length) return ids.map(String).join('; ');
    } catch {
      /* ignore malformed JSON */
    }
  }
  return '';
}

/**
 * Serialize a tile to raw cell values in TILE_CSV_COLUMNS order (NOT CSV-escaped — callers
 * emitting CSV must quote cells with commas/quotes/newlines themselves; the .xlsx generator
 * uses the raw values directly). Shared by the client "Download template CSV" and the
 * server-side spreadsheet generator so a round-trip preserves kill/timed/collection config.
 */
/**
 * A tile as a canonical TileCsvRow — the object form of {@link tileToCsvCells}, keyed by column.
 * This is the shape the task library stores and the importer consumes, so anything that captures a
 * tile for reuse (library harvest, seed-pack export, the library's own editor) goes through here
 * rather than hand-rolling the mapping and drifting from the CSV contract.
 */
export function tileToCsvRow(t: Tile): TileCsvRow {
  const cells = tileToCsvCells(t);
  const row: Record<string, unknown> = {};
  TILE_CSV_COLUMNS.forEach((col, i) => {
    const v = cells[i];
    if (v !== undefined && v !== null && v !== '') row[col] = v;
  });
  return row as TileCsvRow;
}

export function tileToCsvCells(t: Tile): string[] {
  // Collection tiles must NOT emit their stored requiredAmount: it's the derived completion
  // total (recomputed from the items on import), and "items + requiredAmount" is the documented
  // pool syntax — emitting it would silently flip the collection into a pool on re-upload.
  const isCollection = parsedItemRequirements(t) != null;
  return [
    t.label ?? '',
    t.description ?? '',
    t.tileType ?? 'standard',
    String(t.points ?? 1),
    t.category ?? '',
    t.optional ? 'true' : 'false',
    !isCollection && t.requiredAmount != null ? String(t.requiredAmount) : '',
    t.trackedStat ?? '',
    t.statType ?? '',
    t.statGoal != null ? String(t.statGoal) : '',
    jsonNamesToPipes(t.targetNpcs),
    t.timedActivity ?? '',
    t.timeThresholdSeconds != null ? String(t.timeThresholdSeconds) : '',
    t.revealAt ?? '',
    tileItemsCell(t),
  ];
}
