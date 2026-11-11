// A clan's "always post these items" list: prestige drops that post whatever their value or rarity.
//
// ONE list per clan, editable in full. A clan that has never saved one gets the defaults below plus
// anything it had added under the old "extras" setting (always_notify_items), so moving to this
// list changes nothing until an admin edits it. Matching is case-insensitive and partial: "ornament
// kit" matches every kit. Pure, so the settings page shows the same defaults the plugin is sent.

/** The new full-list setting. Absent = never edited (defaults + legacy extras). */
export const ALWAYS_NOTIFY_LIST_KEY = 'always_notify_list';
/** The old setting: extras on top of the built-in list. Read only while the full list is unset. */
export const ALWAYS_NOTIFY_LEGACY_KEY = 'always_notify_items';
/** Stored when an admin empties the list (an empty value deletes the setting, which means "defaults"). */
export const ALWAYS_NOTIFY_NONE = '__none__';

/** What every clan starts with. The same patterns the plugin used to bake in. */
export const DEFAULT_ALWAYS_NOTIFY: readonly string[] = [
  'Infernal cape',
  "Dizana's quiver",
  'Purifying sigil',
  'Ancient blood ornament kit',
  'Sanguine ornament kit',
  'Holy ornament kit',
  'Sanguine dust',
  'Metamorphic dust',
  'Twisted ancestral colour kit',
  'Menaphite ornament kit',
  'Cursed phalanx',
  'Masori crafting kit',
  'Vestige',
  'Quartz',
  "Executioner's axe head",
  'Eye of the duke',
  "Leviathan's lure",
  "Siren's staff",
  'Jar of',
  'Champion scroll',
  "Champion's cape",
  'Enhanced crystal',
  'Blood shard',
  'Fire cape',
];

/** One entry per line, trimmed, blanks and repeats (any case) dropped. */
export function parseItemLines(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of (value ?? '').split('\n')) {
    const s = line.trim();
    const k = s.toLowerCase();
    if (!s || k === ALWAYS_NOTIFY_NONE || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** The clan's list in force: its own if it saved one, else the defaults plus its old extras. */
export function effectiveAlwaysNotify(list: string | null | undefined, legacy: string | null | undefined): string[] {
  if (list != null && list.trim() !== '') return parseItemLines(list);
  return parseItemLines([...DEFAULT_ALWAYS_NOTIFY, ...parseItemLines(legacy)].join('\n'));
}

/** What to store for an edited list: the lines, or the "emptied" marker. */
export function storedAlwaysNotify(lines: string): string {
  const items = parseItemLines(lines);
  return items.length ? items.join('\n') : ALWAYS_NOTIFY_NONE;
}
