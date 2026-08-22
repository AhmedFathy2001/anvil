// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Unique-table "roll" definitions for bosses whose vestige is on a fixed rotation — the DT2 four.
//
// Their unique table doesn't hand out the vestige at random: rolls go non-vestige, non-vestige,
// VESTIGE, so a player who has just seen two uniques knows the next one is theirs. That's worth two
// things this data drives:
//
//   1. The plugin counts rolls per boss and says where you are in the cycle when a unique lands
//      ("roll 2 of 3 — next unique is a vestige"), in the drop post and in game.
//   2. A bingo tile can target a ROLL rather than the vestige itself: a drop tile carrying a boss's
//      whole roll list, counted once per kill, is "get 3 unique rolls from Vardorvis" — a target a
//      team can actually make progress on, unlike a bare 1/500 vestige.
//
// Item ids come from the generated collection-log dataset (src/data/clog.json — `npm run data:clog`),
// not from memory. `rollItemIds` is what the unique table can hand you: the three Virtus pieces, the
// chromium ingot, the boss's signature item and its vestige. Deliberately NOT included, because they
// are their own rolls rather than unique-table ones: the pet, the awakened-only quartz, the tablet
// and the awakener's orb.
//
// `rollsPerVestige` is data, not a constant, so a game update that changes the cadence (or a mistake
// in the item list above) is a server-side edit rather than a plugin release.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface RollTable {
  /** The NPC name exactly as the loot event reports it — the plugin's lookup key. */
  boss: string;
  /** Every item that counts as one roll of the unique table (names for the tile editor's fill). */
  rollItems: { id: number; name: string }[];
  /** The item the cycle is building toward. */
  vestigeItemId: number;
  vestigeName: string;
  /** How many rolls a vestige takes, counting the vestige itself: 1, 2, vestige. */
  rollsPerVestige: number;
}

// Shared across all four bosses' unique tables.
const VIRTUS = [
  { id: 26241, name: 'Virtus mask' },
  { id: 26243, name: 'Virtus robe top' },
  { id: 26245, name: 'Virtus robe bottom' },
];
const CHROMIUM_INGOT = { id: 28276, name: 'Chromium ingot' };

export const ROLL_TABLES: RollTable[] = [
  {
    boss: 'Duke Sucellus',
    rollItems: [
      ...VIRTUS,
      CHROMIUM_INGOT,
      { id: 28281, name: "Magus vestige" },
      { id: 28321, name: "Eye of the duke" },
    ],
    vestigeItemId: 28281,
    vestigeName: 'Magus vestige',
    rollsPerVestige: 3,
  },
  {
    boss: 'The Leviathan',
    rollItems: [
      ...VIRTUS,
      CHROMIUM_INGOT,
      { id: 28283, name: "Venator vestige" },
      { id: 28325, name: "Leviathan's lure" },
    ],
    vestigeItemId: 28283,
    vestigeName: 'Venator vestige',
    rollsPerVestige: 3,
  },
  {
    boss: 'The Whisperer',
    rollItems: [
      ...VIRTUS,
      CHROMIUM_INGOT,
      { id: 28279, name: "Bellator vestige" },
      { id: 28323, name: "Siren's staff" },
    ],
    vestigeItemId: 28279,
    vestigeName: 'Bellator vestige',
    rollsPerVestige: 3,
  },
  {
    boss: 'Vardorvis',
    rollItems: [
      ...VIRTUS,
      CHROMIUM_INGOT,
      { id: 28285, name: "Ultor vestige" },
      { id: 28319, name: "Executioner's axe head" },
    ],
    vestigeItemId: 28285,
    vestigeName: 'Ultor vestige',
    rollsPerVestige: 3,
  },
];

export function rollTableFor(boss: string | null | undefined): RollTable | null {
  if (!boss) return null;
  const key = boss.trim().toLowerCase();
  return ROLL_TABLES.find((t) => t.boss.toLowerCase() === key) ?? null;
}

/** Just the ids — what the plugin matches loot against. */
export function rollItemIds(table: RollTable): number[] {
  return table.rollItems.map((i) => i.id);
}
