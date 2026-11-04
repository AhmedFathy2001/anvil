// Who gave a reaction, as a line: "GZ · Mossy, Rikkert and 3 others". Pure (no database), so the
// panel's chip tooltip and the site's hover read the same.
//
// Names are CHARACTER names in the clan (or on the board) the row belongs to — lib/momentReactions
// reactorNames resolves them. A reactor with no character there comes through as null: counted,
// never named (we don't fall back to their Discord / person name, which this feed has never shown).

/** How many names a line lists before "and N others". */
export const WHO_CAP = 10;

/** "Mossy", "Mossy and Rikkert", "Mossy, Rikkert and Zezima", "Mossy, Rikkert and 3 others". */
export function whoList(names: readonly (string | null)[], cap = WHO_CAP): string {
  // One entry per reactor (a person gives each kind once), so the line always adds up to the count.
  const named: string[] = [];
  let unnamed = 0;
  for (const n of names) {
    const v = n?.trim();
    if (v) named.push(v);
    else unnamed++;
  }
  const shown = named.slice(0, Math.max(0, cap));
  const others = named.length - shown.length + unnamed;
  if (shown.length === 0) return others === 0 ? '' : others === 1 ? '1 person' : `${others} people`;
  if (others === 0) return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return `${shown.join(', ')} and ${others} ${others === 1 ? 'other' : 'others'}`;
}

/** The chip's tooltip: "GZ · Mossy and Rikkert". Empty when nobody reacted. */
export function whoText(label: string, names: readonly (string | null)[], cap = WHO_CAP): string {
  const list = whoList(names, cap);
  return list ? `${label} · ${list}` : '';
}
