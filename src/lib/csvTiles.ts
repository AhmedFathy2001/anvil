// Single documented CSV format for importing/configuring tiles, shared by the event
// create form and the Tiles tab. One source of truth so the format stays reliable for
// open-source users. Header names are matched case-insensitively; column order is free;
// unknown columns are ignored. Row order maps onto tiles by position (row 1 → tile #1).
//
// Columns:
//   label          tile name (required for a meaningful tile; blank → auto "Tile N")
//   description    free-text shown on the tile
//   type           "standard" | "drop"  (stat tiles use trackedStat/statType instead)
//   points         integer reward weight (Leagues scoring)
//   category       grouping label for the plugin (e.g. "Zulrah")
//   optional       true/false — doesn't count toward the total
//   requiredAmount integer — for drop tiles
//   trackedStat    skill/boss key for a stat-tracked tile (e.g. "mining", "zulrah")
//   statType       "skill" | "boss"
//   statGoal       integer XP/KC goal
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
] as const;

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

export interface ParsedTileCsv {
  rows: TileCsvRow[];
  /** Per-row label, auto-filled as "Tile N" when blank. Length === rows.length. */
  labels: string[];
  error?: string;
}

/** Parse a tile CSV (with a header row) into typed rows + labels. */
export function parseTileCsv(text: string): ParsedTileCsv {
  const grid = parseCsvGrid(text);
  if (grid.length < 2) {
    return { rows: [], labels: [], error: 'CSV needs a header row and at least one data row.' };
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
    if (col.type >= 0) row.tileType = get(cells, col.type).trim() || undefined;
    if (col.points >= 0) row.points = toIntOrNull(get(cells, col.points));
    if (col.category >= 0) row.category = get(cells, col.category).trim() || null;
    if (col.optional >= 0) row.optional = toBool(get(cells, col.optional));
    if (col.requiredAmount >= 0) row.requiredAmount = toIntOrNull(get(cells, col.requiredAmount));
    if (col.trackedStat >= 0) row.trackedStat = get(cells, col.trackedStat).trim() || null;
    if (col.statType >= 0) row.statType = get(cells, col.statType).trim() || null;
    if (col.statGoal >= 0) row.statGoal = toIntOrNull(get(cells, col.statGoal));
    rows.push(row);
    labels.push(row.label && row.label.length > 0 ? row.label : `Tile ${i + 1}`);
  });
  return { rows, labels };
}
