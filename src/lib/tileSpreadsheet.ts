// Builds the per-event tile-authoring workbook (.xlsx) that the "Download spreadsheet" button
// on the Tiles tab streams down, and parses it back on upload. The round trip is 1:1: download
// the workbook, upload the same file, and nothing changes — the Tiles sheet serializes via the
// same csvTiles cells the importer reads. For drafting elsewhere, upload it to Google Drive and
// open with Google Sheets; when done, upload the .xlsx (or a CSV export of the Tiles tab) back.
//
// Why .xlsx and not just CSV: the workbook carries what a CSV can't — dropdown validation for
// the tricky columns, a full filterable item-name list, the valid skill/boss keys, worked
// examples, and instructions — all of which survive the Google Sheets import. It needs zero
// Google API setup, so it works for every self-host out of the box.
//
// IMPORTANT: only the **Tiles** sheet maps onto tiles on import; the other sheets are helpers
// and are ignored. So examples live on their own sheet, never appended to Tiles, where extra
// rows would become real tiles on a Leagues board.
import ExcelJS from 'exceljs';
import type { Event, Tile } from '@/lib/types';
import { TILE_CSV_COLUMNS, tileToCsvCells, parseTileGrid, type ParsedTileCsv } from '@/lib/csvTiles';
import { SKILLS, SKILL_LABELS, BOSSES } from '@/lib/constants';
import type { MappingItem } from '@/lib/osrsItems';

const GOLD = 'FFC9A24B';
const HEADER_FILL = 'FF2A2118';

const SHEET_TILES = 'Tiles';
const SHEET_KEYS = 'Stat keys';
const SHEET_ITEMS = 'Item list';
const SHEET_EXAMPLES = 'Examples';
const SHEET_HELP = 'How to use';

// How many rows past the existing tiles to pre-wire with dropdowns, so rows the team adds while
// drafting still get the validation helpers. Generous but bounded (importer caps at 1000 tiles).
const VALIDATION_ROWS = 1000;

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: GOLD } };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle' };
  });
}

/** Build the tile-authoring workbook for an event and return it as a Buffer. */
export async function buildTileSpreadsheet(opts: {
  event: Pick<Event, 'name'>;
  tiles: Tile[];
  items: MappingItem[];
}): Promise<Buffer> {
  const { event, tiles, items } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Anvil';
  wb.created = new Date(0); // deterministic — avoids noisy metadata churn

  // -- Stat keys (dropdown source for trackedStat + a readable reference) --------------------
  const keys = wb.addWorksheet(SHEET_KEYS);
  keys.columns = [
    { header: 'Stat key (paste into trackedStat)', width: 34 },
    { header: 'statType', width: 12 },
    { header: 'Display name', width: 26 },
  ];
  for (const k of SKILLS) keys.addRow([k, 'skill', SKILL_LABELS[k] ?? k]);
  for (const b of BOSSES) keys.addRow([b.key, 'boss', b.label]);
  const keyCount = SKILLS.length + BOSSES.length;
  styleHeaderRow(keys.getRow(1));
  keys.views = [{ state: 'frozen', ySplit: 1 }];
  keys.autoFilter = 'A1:C1';

  // -- Tiles (the only sheet that's imported) -----------------------------------------------
  const ws = wb.addWorksheet(SHEET_TILES);
  ws.columns = TILE_CSV_COLUMNS.map((c) => ({
    header: c,
    width: c === 'label' ? 30 : c === 'description' ? 40 : c === 'items' ? 46 : c === 'targetNpcs' ? 24 : 15,
  }));
  styleHeaderRow(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  // Bake in the event's current tiles (in board order), so the team edits in place.
  for (const t of tiles) ws.addRow(tileToCsvCells(t));

  // Dropdowns on the fiddly columns. Column letters follow TILE_CSV_COLUMNS order:
  //   C=type  F=optional  H=trackedStat  I=statType. exceljs sets validation per-cell, so we
  //   pre-wire a generous row range; lenient (allowBlank, no hard error) so pasting still works.
  const listValidation = (formulae: string[]): ExcelJS.DataValidation => ({
    type: 'list',
    allowBlank: true,
    formulae,
    showErrorMessage: false,
  });
  const lastRow = VALIDATION_ROWS + 1;
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`C${r}`).dataValidation = listValidation(['"standard,drop,kill,gain,timed,deathless,diary,ca,lms,value,valuetotal"']);
    ws.getCell(`F${r}`).dataValidation = listValidation(['"true,false"']);
    ws.getCell(`I${r}`).dataValidation = listValidation(['"skill,boss"']);
    ws.getCell(`H${r}`).dataValidation = listValidation([`'${SHEET_KEYS}'!$A$2:$A$${keyCount + 1}`]);
  }

  // -- Examples (one worked row per tile kind; copy A:N into the Tiles sheet) ----------------
  const ex = wb.addWorksheet(SHEET_EXAMPLES);
  ex.columns = [...TILE_CSV_COLUMNS.map((c) => ({ header: c, width: c === 'items' ? 46 : 16 })), { header: 'What it does', width: 50 }];
  styleHeaderRow(ex.getRow(1));
  ex.views = [{ state: 'frozen', ySplit: 1 }];
  const example = (cells: Partial<Record<(typeof TILE_CSV_COLUMNS)[number], string | number>>, note: string) => {
    const row = TILE_CSV_COLUMNS.map((c) => cells[c] ?? '');
    ex.addRow([...row, note]);
  };
  example({ label: 'Get a fire cape screenshot', type: 'standard', points: 5, category: 'Misc' },
    'Manual tile — staff approve it by hand. No auto-tracking.');
  example({ label: '10M Mining XP', type: 'standard', points: 10, category: 'Skilling', trackedStat: 'mining', statType: 'skill', statGoal: 10000000 },
    'Skill goal: type stays "standard"; trackedStat + statType=skill + statGoal (XP) drive it.');
  example({ label: '50 Zulrah KC', type: 'standard', points: 8, category: 'Zulrah', trackedStat: 'zulrah', statType: 'boss', statGoal: 50 },
    'Boss goal: type stays "standard"; trackedStat + statType=boss + statGoal (kill count).');
  example({ label: 'Any Bandos unique', type: 'drop', points: 15, category: 'GWD', requiredAmount: 3, items: 'Bandos chestplate; Bandos tassets; Bandos boots; Bandos hilt' },
    'Drop POOL: requiredAmount set → any listed item counts toward the total (here, any 3).');
  example({ label: 'Full Bandos set', type: 'drop', points: 25, category: 'GWD', items: 'Bandos chestplate:1; Bandos tassets:1; Bandos boots:1' },
    'COLLECTION: no requiredAmount → each item needs its own count; completes when all are met.');
  example({ label: 'Kill 100 cows', type: 'kill', points: 3, category: 'Skilling', requiredAmount: 100, targetNpcs: 'Cow|Cow calf' },
    'Kill count of NPCs (even non-hiscores). targetNpcs is comma- or pipe-separated; requiredAmount = kills.');
  example({ label: 'Sub-30 Inferno', type: 'timed', points: 50, category: 'Inferno', timedActivity: 'Inferno', timeThresholdSeconds: 1800 },
    'Timed clear: complete the activity under the cap (1800s = 30:00).');
  example({ label: 'Any Master combat task', type: 'ca', points: 20, category: 'PvM', requiredAmount: 1, targetNpcs: 'Any Master' },
    'Combat Achievement: task names or "Any <Tier>" wildcards, PIPE-separated only (names contain commas).');

  // -- Item list (full, filterable; copy exact names into the items cell) --------------------
  const il = wb.addWorksheet(SHEET_ITEMS);
  il.columns = [
    { header: 'Item name (use EXACT spelling)', width: 44 },
    { header: 'ID (optional — pin with Name#id)', width: 30 },
  ];
  styleHeaderRow(il.getRow(1));
  il.views = [{ state: 'frozen', ySplit: 1 }];
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  for (const it of sorted) il.addRow([it.name, it.id]);
  il.autoFilter = `A1:B1`;

  // -- How to use ---------------------------------------------------------------------------
  const help = wb.addWorksheet(SHEET_HELP);
  help.columns = [{ header: 'How to use this spreadsheet', width: 110 }];
  styleHeaderRow(help.getRow(1));
  const lines = [
    `Event: ${event.name}`,
    '',
    'WORKFLOW',
    '  Tip: the site\'s Tiles tab is collaborative (live edits, per-tile locks) — for most drafting you',
    '  can skip this file entirely and build the board together right on the page. This spreadsheet is',
    '  best for seeding a board in bulk or drafting away from the site.',
    '  1. Draft on the "Tiles" tab — either in Excel, or upload to Google Drive and "Open with',
    '     Google Sheets" to work on it together.',
    '  2. When done: Admin → your event → Tiles tab → Upload CSV / Excel — upload this .xlsx directly',
    '     (only the Tiles sheet is read). From Google Sheets, File → Download → .xlsx or a CSV of the',
    '     Tiles tab both work.',
    '  3. Uploading an unchanged file changes nothing — the sheet and the board stay 1:1.',
    '',
    'THE TILES TAB',
    '  • One row per tile. Row order = tile order (row 2 → tile #1, row 3 → tile #2, …).',
    '  • Rows that line up with existing tiles UPDATE them; on Leagues / Tile-race boards, extra rows',
    '    beyond the current count CREATE new tiles (before the event starts, up to 1000).',
    '  • A blank label auto-fills as "Tile N".',
    '  • Only the Tiles tab is imported — the other tabs (Examples, Item list, Stat keys) are helpers.',
    '',
    'COLUMNS',
    '  • type — one of standard / drop / kill / timed / diary / ca (dropdown; advanced boards can also',
    '    use lms / value / valuetotal). SKILL & BOSS goals are NOT a type:',
    '    leave type = standard and fill trackedStat + statType + statGoal instead.',
    '  • points — score weight (Leagues). category — free-text grouping (e.g. Zulrah, GWD, Skilling).',
    '  • optional — true/false; optional tiles don\'t count toward the total.',
    '  • requiredAmount — drop tiles (items needed) OR kill tiles (kills needed). Leave blank otherwise.',
    '  • trackedStat — a skill or boss, by NAME or key (e.g. Mining, Zulrah). statType (skill/boss) is',
    '    auto-detected when left blank, so usually you only need trackedStat + statGoal.',
    '  • statGoal / requiredAmount — plain numbers, or shorthand like 10m, 1.5k, 2b.',
    '  • targetNpcs — kill tiles: NPC name(s), COMMA or pipe separated, e.g. Cow, Cow calf.',
    '    diary tiles: "<Area> <Tier>" selectors ("Any Elite"). ca tiles: Combat Achievement task',
    '    names or "Any <Tier>" wildcards, PIPE-separated ONLY (task names can contain commas).',
    '  • timedActivity / timeThresholdSeconds — timed tiles only; time as mm:ss (30:00), seconds (1800), or 30m.',
    '',
    'THE items CELL (drop / collection tiles)',
    '  • Format: Name:count; Name2:count2  — entries are SEMICOLON-separated, :count is optional (def 1).',
    '  • Use exact in-game item NAMES (resolved to IDs automatically on import — see the "Item list" tab).',
    '    You can also pin an exact id with Name#id (e.g. Pet zilyana#12651) or use a bare id (12651).',
    '  • WITH requiredAmount → a pool (any listed item counts). WITHOUT it → a collection (one of each).',
    '',
    'GOTCHAS',
    '  • Item names must match exactly or the whole import fails (it lists the bad names — just fix them).',
    '  • items uses semicolons; targetNpcs accepts commas or pipes (quote a cell that contains commas).',
    '  • Collection tiles (items WITHOUT requiredAmount) compute their total from the item counts —',
    '    leave requiredAmount blank for them; filling it turns the tile into a pool ("any N of these").',
    '  • Classic N×N bingo grids are a fixed size — extra rows are ignored. Use a Leagues board to grow.',
    '  • Before the event starts you can change everything; after it starts label/type/items lock.',
  ];
  for (const l of lines) help.addRow([l]);
  help.getColumn(1).alignment = { wrapText: false };

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/**
 * Parse an uploaded tile workbook (.xlsx) into the same typed rows the CSV path produces, so
 * the downloaded spreadsheet can be uploaded straight back — no export-to-CSV step. Reads ONLY
 * the "Tiles" sheet (falling back to the first sheet if it was renamed); the helper sheets
 * (Examples, Item list, Stat keys, How to use) are ignored by design.
 */
export async function parseTileWorkbook(data: Buffer): Promise<ParsedTileCsv> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  } catch {
    return { rows: [], labels: [], error: 'Could not read the file as an Excel workbook (.xlsx).' };
  }
  const ws = wb.getWorksheet(SHEET_TILES) ?? wb.worksheets[0];
  if (!ws) {
    return { rows: [], labels: [], error: 'The workbook has no sheets.' };
  }
  const grid: string[][] = [];
  // includeEmpty:false skips blank rows (e.g. the pre-wired validation rows), matching the CSV
  // parser's blank-line handling; cell.text renders numbers/booleans/formula results as strings.
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cell.text != null ? String(cell.text) : '';
    });
    grid.push(Array.from(cells, (c) => c ?? ''));
  });
  return parseTileGrid(grid);
}
