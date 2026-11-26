// The pre-trip check in the panel (view 'trip', drawn in Lookup's Guides mode). PURE: pluginUi/
// tripView gathers the data. The plugin asks for it when the bank closes in a trip region
// (lib/tripContent) and shows the answer's `warn` on its overlay; the panel has the whole check.
//
//   Pre-trip check                                ↻
//   Trip: ToA · picked from the ToA lobby · change
//   (away from a trip region: "Checking for: Doom (last trip) · change   clear", lib/tripTarget)
//   ┌ 5 problems · 4 in your bank · 2 not owned ──┐
//   │ Checked against your own saved setup · 18:42 │
//   │      [equipment screen, wells coloured]      │   green packed, amber in bank, red not owned
//   │      Legs: your options (a slot clicked)     │   owned items best first, DPS delta
//   │      [28-slot inventory]   Rune pouch […]    │
//   │ ✕ On Standard · setup needs Arceuus          │   what no slot shows
//   │ [Show missing in bank]  Show my setup        │
//   │ List ›                                       │   the same check as words, folded
//   └──────────────────────────────────────────────┘
//   [ Check again ]  [ Save what I'm wearing as my ToA setup ]
//
// A slot's click lists the player's own options for it; a pick re-checks with it (`swap`), "Reset"
// drops the picks and saving keeps them. Without a layout (no setup laid out) the rows are listed as
// before: failing open, the rest folded to "✓ N checks met". No combat cues, ever.

import { button, col, icon, row, text, type Action, type Node } from './nodes';
import { CARD_W, CORAL, FAINT, GOLD, GREEN, SOFT, boxChip, chip, section, small, title } from './sections';
import type { BankLayout, TripCheck, TripRow, TripSource } from '@/lib/tripCheck';
import type { Have, LayoutItem, TripLayout } from '@/lib/tripLayout';
import { SLOT_NAME } from '@/lib/slotNames';

export interface TripPanelData {
  /** The region the plugin sent ('' when none). */
  region: string;
  /** "the ToA lobby" when the region is a trip region. */
  regionName: string | null;
  content: { key: string; name: string; short: string } | null;
  /** The content came from the region (else it was picked by hand). */
  fromRegion: boolean;
  source: TripSource | null;
  /** "the guide's Advanced setup: Ranged · DHCB", "your own setup". */
  sourceLine: string;
  guide: { id: number; title: string } | null;
  check: TripCheck | null;
  /** Why there is no check: sharing off, items too old, signed out, nothing picked, no target known. */
  status: 'ready' | 'off' | 'stale' | 'behind' | 'signed-out' | 'none' | 'no-targets';
  /** "2h ago" for a stale reading. */
  age?: string;
  checkedAt: string | null;
  hasOwn: boolean;
  canSave: boolean;
  /** "Saved as your ToA setup." after a save. */
  note?: string | null;
  options: { key: string; short: string; name: string }[];
  monsters: { key: string; name: string }[];
  /** The next-trip target (lib/tripTarget), checked at any bank: "Doom", "last trip". */
  target?: { key: string; short: string; why: string } | null;
  /** The content shown is the target (else a region's or a hand-picked one). */
  fromTarget?: boolean;
  /** The plugin can filter its bank (X-Anvil-Bank-Filter): missing rows and "Show missing in bank" do. */
  bankFilter?: boolean;
  /** ToA only: the raid level the check scales the bosses by (lib/tripRaidLevel), and the ones offered. */
  raid?: { level: number; levels: readonly number[] } | null;
  /** The setup laid out as the game does (lib/tripLayout): drawn instead of a row per item. */
  layout?: TripLayout | null;
  /** Item names for the layout's tips. */
  names?: Record<number, string>;
  /** The player's picks over the setup, "head:26382,weapon:26219" ('' none): kept on every load. */
  swap?: string;
  /** A slot's owned alternatives, best first (the slot clicked). */
  alts?: { slot: string; rows: { id: number; name: string; here: boolean; current: boolean; delta: string; ammo?: number; ammoName?: string }[]; more: number } | null;
}

const W = CARD_W;
const PICK_KEY = 'trip-pick';
const RAID_KEY = 'trip-raid';
const OK_KEY = 'trip-ok';
const LIST_KEY = 'trip-list';

const regionArgs = (d: TripPanelData, extra: Record<string, string> = {}): Record<string, string> => ({ ...(d.region ? { region: d.region } : {}), ...extra });
/** The card again: the same trip and the player's picks, with `extra` (a slot opened, a pick taken). */
const view = (d: TripPanelData, extra: Record<string, string> = {}, swap = d.swap ?? ''): Action => ({
  a: 'load',
  v: 'trip',
  args: regionArgs(d, { why: 'manual', ...(d.content && !d.fromRegion && !d.fromTarget ? { content: d.content.key } : {}), ...(swap ? { swap } : {}), ...extra }),
});
const again = (d: TripPanelData): Action => view(d);
/** The picks with `slot` set to `id`. */
const withPick = (swap: string | undefined, slot: string, id: number): string => [...(swap ?? '').split(',').filter((p) => p && !p.startsWith(`${slot}:`)), `${slot}:${id}`].join(',');
/** Make it the next-trip target: checked at whichever bank the player gears up at. */
const aim = (d: TripPanelData, key: string): Action => ({ a: 'load', v: 'trip', args: regionArgs(d, { why: 'manual', target: key }) });
const clearAim = (d: TripPanelData): Action => ({ a: 'load', v: 'trip', args: regionArgs(d, { why: 'manual', target: 'clear' }) });
/** The plugin's bank shows only these ids (display only: nothing is moved). */
const bankAction = (ids: number[], layout?: BankLayout): Action => ({ a: 'bank', ids: ids.join(','), ...(layout ? { layout: layout.layout.join(',') } : {}) });

function head(d: TripPanelData): Node {
  return row(title('Pre-trip check'), undefined, text('↻', GOLD, { on: again(d), tip: 'Check again with what you carry now' }), { gap: 6 });
}

/** "Trip: ToA · picked from the ToA lobby · change" (or "Checking for: Doom (last trip) · change"), opening the picker. */
function tripLine(d: TripPanelData): Node {
  const where = d.content ? (d.fromRegion && d.regionName ? `picked from ${d.regionName}` : 'picked by you') : null;
  const t = d.fromTarget && d.target ? d.target : null;
  const line = (open: boolean): Node =>
    text('', SOFT, {
      font: 'small',
      wrap: t ? W - 20 : W + 20,
      runs: [
        ...(t && d.content
          ? [{ s: 'Checking for: ', color: FAINT }, { s: d.content.short, color: 'white' as const }, { s: ` (${t.why}) · `, color: FAINT }]
          : d.content
            ? [{ s: 'Trip: ', color: FAINT }, { s: d.content.short, color: 'white' as const }, { s: ` · ${where} · `, color: FAINT }]
            : [{ s: `No trip picked${d.regionName ? ` at ${d.regionName}` : ''} · `, color: FAINT }]),
        { s: open ? 'close' : d.content ? 'change' : 'pick', color: GOLD },
      ],
      on: { a: 'flip', key: PICK_KEY },
      tip: open ? 'Close the list' : 'Pick the trip you go on next: it is checked at whichever bank you gear up at',
    });
  // The target named, with a way to drop it: on its own line when the trip shown is another one.
  const clear = d.target ? small('clear', GOLD, { on: clearAim(d), tip: 'Stop checking your next trip until your next kill' }) : undefined;
  const lineRow = (open: boolean): Node => (t ? row(undefined, line(open), clear, { gap: 6 }) : line(open));
  const next: Node | null =
    d.target && !t
      ? row(undefined, small(`Next trip: ${d.target.short} (${d.target.why})`, FAINT, { wrap: W - 20, tip: 'Checked when you close a bank away from a trip region' }), clear, { gap: 6 })
      : null;
  const chips: Node = {
    t: 'grid',
    cols: 3,
    gap: 4,
    vgap: 4,
    c: d.options.map((o) => boxChip(o.short, o.key === d.content?.key, aim(d, o.key), `${o.name}: check it at whichever bank you gear up at`)),
  };
  const any: Node = {
    t: 'filter',
    hint: 'Any monster: a slayer task, a boss…',
    box: true,
    // No `none`: the plugin would show it under the empty box before anything is typed.
    max: 12,
    more: 'Keep typing to narrow it.',
    // Search-only rows: the plugin builds a row only when it matches what's typed. Thousands of eager
    // rows took ~30 s to draw, and a col with a gap isn't searched at all (its spacers aren't rows).
    c: [],
    x: d.monsters.map((m) => [m.name, m.key]),
    xt: row(undefined, text('{0}', 'white', { font: 'small', wrap: W - 20 }), icon({ glyph: 'chevron-right', w: 9, h: 9, color: FAINT }), { bg: 'raised', pad: 3, inset: 6, on: aim(d, 'm:{1}'), tip: 'Your next trip: {0}. Anvil works a setup out from your bank' }),
  };
  const picker = section([small('Pick your next trip', FAINT), chips, any], { gap: 6 });
  // Nothing picked: the list is open to start with.
  const open = col([lineRow(true), picker], { gap: 6 });
  const shut = lineRow(false);
  const toggle: Node = d.content ? { t: 'toggle', key: PICK_KEY, off: shut, lit: open } : { t: 'toggle', key: PICK_KEY, off: open, lit: shut };
  return next ? col([toggle, next], { gap: 4 }) : toggle;
}

/** A row's picture: its item, or a cross where the row is about no one item (26px either way). */
function pic(r: TripRow): Node {
  return r.item ? icon({ item: r.item, w: 26, h: 23 }) : text('', 'white', { w: 26, align: 'c', icon: { t: 'icon', glyph: 'close', w: 10, h: 10, color: CORAL } });
}

/** The items to take, as pictures (the calc's swaps): eight at most, the rest counted. */
function swapIcons(ids: number[]): Node {
  const shown = ids.slice(0, 8);
  return { t: 'grid', cols: 4, gap: 3, vgap: 3, c: [...shown.map((id) => icon({ item: id, w: 26, h: 23 })), ...(ids.length > shown.length ? [small(`+${ids.length - shown.length}`, FAINT)] : [])] };
}

function failRow(r: TripRow, bankFilter: boolean): Node {
  // One bank slot for a piece of gear (the exact item, else its first held form); a supply, every dose.
  const filter = bankFilter && r.bank?.length ? (r.group === 'supplies' ? r.bank : [r.item != null && r.bank.includes(r.item) ? r.item : r.bank[0]]) : null;
  return row(
    pic(r),
    col([text(r.line, 'white', { wrap: 122 }), r.detail ? small(r.detail, FAINT, { wrap: 122 }) : null, r.swaps?.length ? swapIcons(r.swaps) : null], { gap: 2 }),
    icon({ glyph: 'close', w: 10, h: 10, color: CORAL }),
    { gap: 6, ...(filter ? { on: bankAction(filter), tip: 'Show it in your open bank' } : {}) },
  );
}

const passRow = (r: TripRow): Node => row(icon({ glyph: 'check', w: 10, h: 10, color: GREEN }), small(r.line, SOFT, { wrap: W - 18, ...(r.detail ? { tip: r.detail } : {}) }), undefined, { gap: 5 });

function checkCard(d: TripPanelData, c: TripCheck): Node {
  const bad = c.rows.filter((r) => !r.ok);
  const good = c.rows.filter((r) => r.ok);
  const short = d.content?.short ?? 'the trip';
  const top = bad.length
    ? text(`${bad.length} problem${bad.length === 1 ? '' : 's'}`, CORAL, { font: 'bold' })
    : text(`✓ Ready for ${short}`, GREEN, { font: 'bold', wrap: W });
  // The one line saying what it was checked against, and when.
  const source = small(`${d.sourceLine}${d.checkedAt ? ` · ${d.checkedAt}` : ''}`, FAINT, { wrap: W });
  // Laid out as a setup: the worn pieces as a paper doll, switches beside, supplies by kind and dose.
  const missing = c.layouts?.missing;
  const setup = c.layouts?.setup;
  const showAll = d.bankFilter && bad.length && c.bank?.length ? button('Show missing in bank', bankAction(missing?.ids.length ? missing.ids : c.bank, missing), 'Your open bank shows only what this check says to take, laid out as the setup') : null;
  const showSetup = d.bankFilter && setup?.ids.length ? row(undefined, small('Show my setup in bank', GOLD, { align: 'c' }), undefined, { pad: 2, on: bankAction(setup.ids, setup), tip: 'Your open bank shows the whole setup, laid out: worn, switches, supplies' }) : null;
  const okFold: Node | null = good.length
    ? {
        t: 'toggle',
        key: OK_KEY,
        off: small(`✓ ${good.length} check${good.length === 1 ? '' : 's'} met  ›`, GREEN, { on: { a: 'flip', key: OK_KEY }, tip: 'Show what passed' }),
        lit: col([small(`✓ ${good.length} check${good.length === 1 ? '' : 's'} met  ▾`, GREEN, { on: { a: 'flip', key: OK_KEY }, tip: 'Fold' }), ...good.map(passRow)], { gap: 3 }),
      }
    : null;
  const unknown = c.unknown.length ? small(`Not checked: ${c.unknown.join(', ')}. The newest plugin reads them; a rune pouch only counts when it is in your inventory.`, FAINT, { wrap: W }) : null;
  return section(
    [top, source, ...bad.map((r) => failRow(r, !!d.bankFilter)), showAll, showSetup, okFold, ...c.info.map((s) => small(s, SOFT, { wrap: W })), unknown],
    { gap: 6, edge: bad.length ? CORAL : GREEN },
  );
}

// ── The setup as the game lays it out ─────────────────────────────────────────────────────────

/** The equipment screen's rows (as guidesUi's): quiver above ammo. */
const SLOT_ROWS: (string | null)[][] = [
  [null, 'head', 'quiver'],
  ['cape', 'neck', 'ammo'],
  ['weapon', 'body', 'shield'],
  [null, 'legs', null],
  ['hands', 'feet', 'ring'],
];
/** The game's empty-slot pictures (RuneLite SpriteID.EQUIPMENT_SLOT_*). */
const SLOT_SPRITE: Record<string, number> = { head: 156, cape: 157, neck: 158, weapon: 159, ring: 160, body: 161, shield: 162, legs: 163, hands: 164, feet: 165, ammo: 166 };
const STONE = '#3e3529';
const EMPTY = '#2b241b';
/** A slot's ground: green worn or packed, amber in the bank (take it), red not owned. */
const GROUND: Record<Have, `#${string}`> = { here: '#24401f', bank: '#5a3d0e', none: '#561f1a' };
const HAVE_WORDS: Record<Have, string> = { here: 'you have it', bank: 'in your bank: take it', none: 'not owned' };
const SLOT_PX = 34;
const INV_PX = 32;

const nameIn = (d: TripPanelData, id: number) => d.names?.[id] ?? `Item ${id}`;

function well(d: TripPanelData, it: LayoutItem, px: number, where: string, on?: Action): Node {
  return text('', 'white', {
    ...(on ? { on } : {}),
    chip: GROUND[it.have],
    w: px,
    align: 'c',
    icon: { t: 'icon', item: it.id, ...(it.q ? { qty: it.q } : {}), w: px - 4, h: px - 7, ...(it.have === 'none' ? { dim: true } : {}) },
    tip: `${where}${nameIn(d, it.id)} · ${HAVE_WORDS[it.have]}${on ? ' · click for your other options' : ''}`,
  });
}

/** `node` of `width` px centred in the card. */
const centred = (node: Node, width: number): Node => row(text('', 'muted', { w: Math.max(0, Math.floor((W - width) / 2)) }), row(node, undefined, undefined, { gap: 0 }), undefined, { gap: 0 });

function wornGrid(d: TripPanelData, l: TripLayout): Node {
  const cells: Node[] = [];
  for (const r of SLOT_ROWS)
    for (const slot of r) {
      const it = slot === 'quiver' ? l.quiver : slot ? l.worn[slot] : undefined;
      if (!slot || (slot === 'quiver' && !it)) cells.push(text('', 'muted', { w: SLOT_PX }));
      else if (!it) cells.push(text('', 'muted', { chip: EMPTY, w: SLOT_PX, align: 'c', icon: { t: 'icon', sprite: SLOT_SPRITE[slot] ?? 170 }, tip: `${SLOT_NAME[slot] ?? slot}: empty · click for your options`, ...(slot === 'quiver' ? {} : { on: view(d, { alt: slot }) }) }));
      else cells.push(well(d, it, SLOT_PX, `${SLOT_NAME[slot] ?? slot}: `, slot === 'quiver' ? undefined : view(d, d.alts?.slot === slot ? {} : { alt: slot })));
    }
  return centred(col([{ t: 'grid', cols: 3, gap: 6, vgap: 6, c: cells }], { bg: STONE, edge: '#14100b', inset: 6 }), 3 * SLOT_PX + 12 + 14);
}

function invGrid(d: TripPanelData, l: TripLayout): Node {
  const cells = l.inventory.map((it) => (it ? well(d, it, INV_PX, '') : text('', 'muted', { w: INV_PX })));
  return centred(col([{ t: 'grid', cols: 4, gap: 3, vgap: 3, c: cells }], { bg: STONE, edge: '#14100b', inset: 6 }), 4 * INV_PX + 9 + 14);
}

/** "Rune pouch" with its runes. */
function pouchStrip(d: TripPanelData, l: TripLayout): Node | null {
  if (!l.pouch.length) return null;
  return row(small(l.pouch.length > 3 ? 'Divine rune pouch' : 'Rune pouch', FAINT, { w: 62, wrap: 62 }), col([{ t: 'grid', cols: l.pouch.length, gap: 3, c: l.pouch.map((p) => well(d, p, 30, 'Rune pouch: ')) }], { bg: STONE, edge: '#14100b', inset: 4 }), undefined, { gap: 6 });
}

/** A clicked slot's options: what the player owns for it, best first, with what each does to DPS. */
function altsList(d: TripPanelData): Node | null {
  const a = d.alts;
  if (!a) return null;
  const label = SLOT_NAME[a.slot] ?? a.slot;
  const rows = a.rows.map((x) =>
    row(
      icon({ item: x.id, w: 26, h: 23 }),
      col([text(x.name, x.current ? GREEN : 'white', { font: 'small', wrap: 112 }), small(x.current ? 'In this setup' : [x.delta, x.here ? 'packed' : 'in your bank'].filter(Boolean).join(' · '), x.current ? FAINT : SOFT), x.ammo ? small(`with ${x.ammoName ?? 'its ammo'}`, FAINT, { wrap: 112 }) : null], { gap: 1 }),
      undefined,
      { gap: 6, bg: 'raised', pad: 2, inset: 4, ...(x.current ? {} : { on: view(d, {}, x.ammo ? withPick(withPick(d.swap, a.slot, x.id), 'ammo', x.ammo) : withPick(d.swap, a.slot, x.id)), tip: `Use ${x.name} for ${label}` }) },
    ),
  );
  return col(
    [
      row(small(`${label}: your options`, SOFT, { font: 'bold' }), undefined, small('close', GOLD, { on: view(d), tip: 'Close the list' }), { gap: 6 }),
      ...(rows.length ? rows : [small(`Nothing you own goes in ${label}.`, FAINT, { wrap: W })]),
      a.more ? small(`+${a.more} more you own`, FAINT) : null,
    ].filter((x): x is Node => !!x),
    { gap: 4 },
  );
}

const legend = (l: TripLayout): Node =>
  row(chip('Have', 'green'), row(l.inBank ? chip('In bank', 'gold') : undefined, l.notOwned ? chip('Not owned', 'coral') : undefined, undefined, { gap: 4 }), undefined, { gap: 4 });

/** The check drawn as the setup: worn, inventory, pouch; what isn't an item (spellbook, runes, prayers) as short lines. */
function layoutCard(d: TripPanelData, c: TripCheck, l: TripLayout): Node {
  const bad = c.rows.filter((r) => !r.ok);
  const short = d.content?.short ?? 'the trip';
  const words = [`${bad.length} problem${bad.length === 1 ? '' : 's'}`, l.inBank ? `${l.inBank} in your bank` : '', l.notOwned ? `${l.notOwned} not owned` : ''].filter(Boolean).join(' · ');
  const top = bad.length ? text(words, CORAL, { font: 'bold', wrap: W }) : text(`✓ Ready for ${short}`, GREEN, { font: 'bold', wrap: W });
  const source = small(`${d.sourceLine}${d.checkedAt ? ` · ${d.checkedAt}` : ''}`, FAINT, { wrap: W });
  // What no slot shows: the spellbook, the runes, the prayers, a supply short by kind.
  const other = bad.filter((r) => r.group === 'book' || r.group === 'pouch' || r.group === 'prayer' || (r.group === 'supplies' && r.item == null));
  const otherLines = other.map((r) => row(icon({ glyph: 'close', w: 9, h: 9, color: CORAL }), small(r.line, SOFT, { wrap: W - 16, ...(r.detail ? { tip: r.detail } : {}) }), undefined, { gap: 5 }));
  const missing = c.layouts?.missing;
  const setup = c.layouts?.setup;
  const showAll = d.bankFilter && bad.length && c.bank?.length ? button('Show missing in bank', bankAction(missing?.ids.length ? missing.ids : c.bank, missing), 'Your open bank shows only what this check says to take, laid out as the setup') : null;
  const showSetup = d.bankFilter && setup?.ids.length ? row(undefined, small('Show my setup in bank', GOLD, { align: 'c' }), undefined, { pad: 2, on: bankAction(setup.ids, setup), tip: 'Your open bank shows the whole setup, laid out: worn, switches, supplies' }) : null;
  // The same check as words, folded: for reading it out, or a slot hard to make out.
  const list: Node = {
    t: 'toggle',
    key: LIST_KEY,
    off: small('List  ›', GOLD, { on: { a: 'flip', key: LIST_KEY }, tip: 'The check as a list' }),
    lit: col([small('List  ▾', GOLD, { on: { a: 'flip', key: LIST_KEY }, tip: 'Fold' }), ...c.rows.map((r) => row(icon({ glyph: r.ok ? 'check' : 'close', w: 9, h: 9, color: r.ok ? GREEN : CORAL }), small(r.line, r.ok ? SOFT : 'white', { wrap: W - 16, ...(r.detail ? { tip: r.detail } : {}) }), undefined, { gap: 5 }))], { gap: 3 }),
  };
  const unknown = c.unknown.length ? small(`Not checked: ${c.unknown.join(', ')}.`, FAINT, { wrap: W }) : null;
  return section(
    [top, source, wornGrid(d, l), altsList(d), d.swap ? row(undefined, small('Reset to the setup', GOLD, { align: 'c' }), undefined, { pad: 2, on: view(d, {}, ''), tip: 'Drop your picks' }) : null, !d.alts && !d.swap ? small('Click a slot for your other options.', FAINT) : null, l.inventory.some(Boolean) ? invGrid(d, l) : null, pouchStrip(d, l), legend(l), ...otherLines, showAll, showSetup, ...c.info.map((s) => small(s, FAINT, { wrap: W })), unknown, list],
    { gap: 7, edge: bad.length ? CORAL : GREEN },
  );
}

function why(d: TripPanelData): Node {
  switch (d.status) {
    case 'signed-out':
      return section([text('Sign in with the plugin to check your trips.', 'white', { wrap: W })]);
    case 'off':
      return section([text('Turn on Share my bank to check your trips', 'white', { font: 'bold', wrap: W }), small('It is in the Anvil plugin’s settings. Your bank stays private to you: nobody else, clan staff included, ever sees it.', FAINT, { wrap: W })]);
    case 'behind':
      return section([text('Checking what you carry…', 'white', { wrap: W }), small(`Anvil last saw your items at ${d.checkedAt ?? 'an earlier bank'}. Check again in a moment.`, FAINT, { wrap: W })]);
    case 'stale':
      return section([text(`Your items were read ${d.age ?? 'a while'} ago`, 'white', { wrap: W }), small('Open your bank and close it again, then check.', FAINT, { wrap: W })]);
    case 'no-targets':
      return section([text(`Anvil can't check ${d.content?.name ?? 'this trip'} yet`, 'white', { wrap: W }), small('It has no stats for its monsters. Pick another trip above.', FAINT, { wrap: W })]);
    default:
      return section([text('Nothing to check here', 'white', { wrap: W }), small('Pick the trip above to check what you carry for it.', FAINT, { wrap: W })]);
  }
}

/**
 * "Raid level 300 ▾": the ToA raid level the calc scales the bosses by, opening to a chip per level.
 * Remembered per character ('trip-raid' saves it and checks again).
 */
function raidLine(d: TripPanelData): Node | null {
  if (!d.raid || !d.content) return null;
  const content = d.content.key;
  const shut = text('', SOFT, { font: 'small', runs: [{ s: 'Raid level ', color: FAINT }, { s: String(d.raid.level), color: 'white' }, { s: ' ▾', color: GOLD }], on: { a: 'flip', key: RAID_KEY }, tip: 'The raid level the bosses are scaled to: more defence and hitpoints as it goes up' });
  const chips: Node = {
    t: 'grid',
    cols: 4,
    gap: 4,
    vgap: 4,
    c: d.raid.levels.map((l) => boxChip(String(l), l === d.raid!.level, { a: 'post', act: 'trip-raid', args: regionArgs(d, { content, rl: String(l), ...(d.swap ? { swap: d.swap } : {}) }) }, `Check for raid level ${l}`)),
  };
  return { t: 'toggle', key: RAID_KEY, off: shut, lit: col([text('', SOFT, { font: 'small', runs: [{ s: 'Raid level ', color: FAINT }, { s: String(d.raid.level), color: 'white' }, { s: ' ▴', color: GOLD }], on: { a: 'flip', key: RAID_KEY }, tip: 'Close' }), chips], { gap: 4 }) };
}

export function tripPanelUi(d: TripPanelData): Node {
  const parts: Node[] = [head(d), tripLine(d)];
  const raid = raidLine(d);
  if (raid) parts.push(raid);
  if (d.note) parts.push(chip(d.note, 'green', { wrap: W }));
  if (d.status === 'ready' && d.check) parts.push(d.layout ? layoutCard(d, d.check, d.layout) : checkCard(d, d.check));
  else parts.push(why(d));
  if (d.status === 'ready' || d.status === 'none' || d.status === 'no-targets') {
    if (d.status === 'ready') parts.push(button('Check again', again(d), 'With what you wear and carry now'));
  }
  if (d.status === 'behind') parts.push(button('Check again', again(d), 'With what you wear and carry now'));
  if (d.status === 'ready' || d.status === 'none' || d.status === 'no-targets') {
    if (d.canSave && d.content) {
      parts.push(
        col([
          button(`${d.hasOwn ? 'Replace my' : 'Save as my'} setup`, { a: 'post', act: 'trip-save', args: regionArgs(d, { content: d.content.key, ...(d.swap ? { swap: d.swap } : {}) }) }, d.swap ? 'This setup, with your picks, becomes the one this check uses for this trip. Only you see it.' : 'Your worn gear and inventory become the setup this check uses for this trip. Only you see it.'),
          small(d.swap ? `This setup with your picks becomes your ${d.content.name} setup. Only you see it.` : `What you wear and carry now becomes your ${d.content.name} setup. Only you see it.`, FAINT, { wrap: W + 10, align: 'c' }),
        ], { gap: 3 }),
      );
    }
    if (d.hasOwn && d.content) {
      parts.push(row(undefined, small(d.guide ? "Use the guide's setup instead" : 'Forget my saved setup', GOLD, { align: 'c' }), undefined, { pad: 2, on: { a: 'post', act: 'trip-forget', args: regionArgs(d, { content: d.content.key }) }, tip: `Forget your saved ${d.content.short} setup` }));
    }
  }
  if (d.guide) parts.push(row(undefined, small(`Open the ${d.guide.title} guide ›`, GOLD, { align: 'c' }), undefined, { pad: 2, on: { a: 'load', v: 'guide', args: regionArgs(d, { id: String(d.guide.id) }) }, tip: 'The written guide and its setups' }));
  return col(parts, { gap: 8 });
}

/**
 * The way in by hand, at the top of Lookup's Guides mode and on the You tab: "Next trip: Doom (last
 * trip) ›" while a target is set, else "Pre-trip check ›". Both open the check (why 'manual').
 */
export function tripEntryUi(target: { short: string; why: string } | null, region?: string): Node {
  const label = target ? `Next trip: ${target.short} (${target.why})` : 'Pre-trip check';
  return row(text(label, 'white', { font: 'bold', wrap: W - 30 }), undefined, small('›', GOLD), {
    bg: 'card',
    edge: GOLD,
    pad: 7,
    inset: 8,
    gap: 8,
    on: { a: 'load', v: 'trip', args: { ...(region ? { region } : {}), why: 'manual' } },
    tip: 'Check what you carry for your next trip',
  });
}
