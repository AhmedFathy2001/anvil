// The pre-trip check in the panel (view 'trip', drawn in Lookup's Guides mode). PURE: pluginUi/
// tripView gathers the data. The plugin asks for it when the bank closes in a trip region
// (lib/tripContent) and shows the answer's `warn` on its overlay; the panel has the whole check.
//
//   Pre-trip check                                ↻      (Check again)
//   Trip: ToA (from the ToA lobby)  change  🔓            the padlock locks it; locked: "Trip: Yama 🔒 unlock"
//   (at another trip's bank while locked: "At ToB's bank, still checking Yama.")
//   Raid level 300 ▾                                      ToA only
//   Setup [Solo shadow ▾]  ↗                              own setups, the clan's, Anvil's loadout, Save current as new…
//   [ Learner | Experienced | Max DPS ]                   only with Anvil's loadout picked
//   Going for a CA? [Perfect Zulrah ▾]                    the undone CAs that change the loadout
//   ┌ Take 27 from your bank ─────────────────────┐       the next move: missing / take / fix / ready
//   │ Checked 18:42.                               │
//   │ ★ Perfect Zulrah: 3 food swapped for 2 …     │       what the CA changed
//   │      [equipment screen, wells coloured]      │       green packed, amber in bank, red not owned
//   │      [28-slot inventory, the same width]     │
//   │ 8 switches, 4 food, 4 free. Have  In bank    │       counted, with the legend, one quiet line
//   └──────────────────────────────────────────────┘
//   [ Show the 27 in my bank ]                            only when something is in the bank to take
//   [ List ] [ Save ] [ Bank ] [ Guide ↗ ]                Bank: the whole setup in the open bank
//
// A slot's click lists the player's own options for it; a pick re-checks with it (`swap`), "Reset"
// drops the picks and saving keeps them. Without a layout (no setup laid out) the rows are listed as
// before: failing open, the rest folded to "✓ N checks met". No combat cues, ever.

import { button, col, icon, row, text, type Action, type Color, type Node } from './nodes';
import { CARD_W, CORAL, FAINT, GOLD, GREEN, LINE, SOFT, boxChip, chip, section, small, title } from './sections';

/** Take it from the bank: the card's amber. */
const AMBER = '#ffb54d' as const;
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
  /** The loadout engine's plan (lib/tripLoadout), for a trip with a boss profile: the chooser. */
  plan?: { preset: string; presets: readonly { key: string; label: string }[]; blurb: string } | null;
  /** The setup laid out as the game does (lib/tripLayout): drawn instead of a row per item. */
  layout?: TripLayout | null;
  /** Item names for the layout's tips. */
  names?: Record<number, string>;
  /** The player's picks over the setup, "head:26382,weapon:26219" ('' none): kept on every load. */
  swap?: string;
  /** A slot's owned alternatives, best first (the slot clicked). */
  alts?: { slot: string; rows: { id: number; name: string; here: boolean; current: boolean; delta: string; ammo?: number; ammoName?: string }[]; more: number } | null;
  /** The player's saved setups for this trip (lib/tripSetups), by name: the Setup dropdown. */
  setups?: { id: number; name: string }[];
  /** Clanmates' setups shared with the clan ("From your clan"), read-only: the name and the sharer's RSN. */
  clanSetups?: { id: number; name: string; rsn: string }[];
  /** The setup in use: a saved one's id, a clan one's "c:<id>", or 'anvil' (the guide's, the loadout engine's or the calc's). */
  setupSel?: number | 'anvil' | `c:${number}`;
  setupName?: string | null;
  /** The card's short source line: "Your Solo shadow setup", "Anvil’s Experienced loadout from your bank". */
  sourceShort?: string;
  /** What the laid-out inventory holds: "8 switches, 4 food, 6 potions, 4 free slots." */
  summary?: string;
  /** Said in the card only when it isn't what the Setup dropdown shows (picks, items not arrived). */
  sourceNote?: string;
  /** "Going for a CA?" (Anvil's loadout only): the undone tasks that change it, the pick, what it changed. */
  ca?: { options: { id: number; name: string; does: string }[]; sel: number | null; line: string | null } | null;
  /** The trip is locked (lib/tripTarget): `at` names the other trip whose bank this is, if any. */
  lock?: { at: string | null } | null;
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

/** Lock the trip shown: every bank close checks it until unlocked or changed. */
const lockOn = (d: TripPanelData): Action => ({ a: 'load', v: 'trip', args: regionArgs(d, { why: 'manual', target: d.content?.key ?? '', lock: '1' }) });
const lockOff = (d: TripPanelData): Action => ({ a: 'load', v: 'trip', args: regionArgs(d, { why: 'manual', lock: '0' }) });

/**
 * "Trip: ToA (from the ToA lobby) change  [Lock]", or locked: "Trip: Yama  Locked  unlock" and, at
 * another trip's bank, "At ToB's bank, still checking Yama." The change link opens the picker.
 */
function tripLine(d: TripPanelData): Node {
  const padlock = (glyph: 'lock' | 'unlock', color: Color, on: Action, tip: string): Node => text('', color, { w: 14, align: 'c', icon: icon({ glyph, w: 10, h: 11, color }), on, tip });
  if (d.lock && d.content) {
    const short = d.content.short;
    const line = row(
      text('', SOFT, { font: 'small', wrap: W - 50, runs: [{ s: 'Trip: ', color: FAINT }, { s: short, color: 'white' as const }] }),
      undefined,
      row(padlock('lock', AMBER, lockOff(d), `Locked: every bank you close checks ${short}. Click to unlock`), small('unlock', GOLD, { on: lockOff(d), tip: 'Stop locking this trip: other bosses’ banks check their own trip again' }), undefined, { gap: 2 }),
      { gap: 4 },
    );
    if (!d.lock.at) return line;
    return col([line, small(`At ${d.lock.at}’s bank, still checking ${short}.`, FAINT, { wrap: W })], { gap: 4 });
  }
  const why = d.content ? (d.fromTarget && d.target ? d.target.why : d.fromRegion && d.regionName ? `from ${d.regionName}` : 'your pick') : null;
  const lock = d.content ? padlock('unlock', FAINT, lockOn(d), `Lock ${d.content.short}: every bank you close checks it, other bosses’ banks don’t switch it, until you unlock it`) : undefined;
  const line = (open: boolean): Node =>
    row(
      text('', SOFT, {
        font: 'small',
        wrap: lock ? W - 18 : W,
        runs: d.content
          ? [{ s: 'Trip: ', color: FAINT }, { s: d.content.short, color: 'white' as const }, { s: ` (${why})  `, color: FAINT }, { s: open ? 'close' : 'change', color: GOLD }]
          : [{ s: `No trip picked${d.regionName ? ` at ${d.regionName}` : ''}  `, color: FAINT }, { s: open ? 'close' : 'pick', color: GOLD }],
        on: { a: 'flip', key: PICK_KEY },
        tip: open ? 'Close the list' : 'Pick the trip you go on next: it is checked at whichever bank you gear up at',
      }),
      undefined,
      lock,
      { gap: 4 },
    );
  // The target named, with a way to drop it, when the trip shown is another one.
  const clear = d.target ? small('clear', GOLD, { on: clearAim(d), tip: 'Stop checking your next trip until your next kill' }) : undefined;
  const next: Node | null =
    d.target && !(d.fromTarget && d.content)
      ? row(undefined, small(`Next trip: ${d.target.short} (${d.target.why})`, FAINT, { wrap: W - 30, tip: 'Checked when you close a bank away from a trip region' }), clear, { gap: 6 })
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
  const picker = section([small('Pick your next trip', FAINT), chips, any, d.target && d.fromTarget ? row(undefined, small(`Stop checking ${d.target.short}`, GOLD), undefined, { on: clearAim(d), tip: 'Stop checking your next trip until your next kill' }) : null], { gap: 6 });
  // Nothing picked: the list is open to start with.
  const open = col([line(true), picker], { gap: 6 });
  const shut = line(false);
  const toggle: Node = d.content ? { t: 'toggle', key: PICK_KEY, off: shut, lit: open } : { t: 'toggle', key: PICK_KEY, off: open, lit: shut };
  return next ? col([toggle, next], { gap: 4 }) : toggle;
}

/**
 * "Setup [Solo shadow ▾]" and "Manage setups ↗": the player's saved setups for the trip by name, then
 * Anvil's loadout (the guide's, the loadout engine's or the calc's) and "Save current as new…".
 * Picking one is remembered per trip ('trip-setup'); the site's My setups page names and tidies them.
 */
function setupLine(d: TripPanelData): Node | null {
  if (!d.content) return null;
  const clan = d.clanSetups ?? [];
  const options = [
    ...(d.setups ?? []).map((x) => ({ v: String(x.id), label: x.name })),
    // No headings in the game's combo box: a line that reads as one (picking it changes nothing).
    ...(clan.length ? [{ v: 'clan-head', label: '— From your clan —' }, ...clan.map((x) => ({ v: `c:${x.id}`, label: `${x.name} (${x.rsn})` }))] : []),
    { v: 'anvil', label: 'Anvil’s loadout' },
    { v: 'new', label: 'Save current as new…' },
  ];
  const combo: Node = { t: 'input', name: 'setup', kind: 'select', options, value: d.setupSel != null ? String(d.setupSel) : 'anvil', on: { a: 'post', act: 'trip-setup', args: regionArgs(d, { content: d.content.key }) }, tip: 'Your saved setups for this trip, your clan’s shared ones, or Anvil’s loadout' };
  const manage = text('', GOLD, { w: 14, align: 'c', icon: icon({ glyph: 'external', w: 9, h: 9, color: GOLD }), on: { a: 'site', path: '/profile/setups' }, tip: 'My setups on the site: rename, delete, share, pick defaults' });
  return row(small('Setup', FAINT, { w: 34 }), combo, manage, { gap: 4 });
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
  const source = small(`${d.sourceLine}${d.checkedAt ? `, checked at ${d.checkedAt}` : ''}`, FAINT, { wrap: W });
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
const SLOT_PX = 35;
const INV_PX = 32;
/** The inventory's 4 × 32 px plus its 3 px gaps: the doll's 3 slots spread to the same width. */
const FRAME_IN = 4 * INV_PX + 3 * 3;
const DOLL_GAP = (FRAME_IN - 3 * SLOT_PX) / 2;
/** Both frames' inner padding, and the whole card's one spacing step. */
const PAD = 6;
const GAP = 8;

const nameIn = (d: TripPanelData, id: number) => d.names?.[id] ?? `Item ${id}`;

function well(d: TripPanelData, it: LayoutItem, px: number, where: string, on?: Action): Node {
  return text('', 'white', {
    ...(on ? { on } : {}),
    chip: GROUND[it.have],
    w: px,
    align: 'c',
    icon: { t: 'icon', item: it.id, ...(it.q ? { qty: it.q } : {}), w: px - 4, h: px - 7, ...(it.have === 'none' ? { dim: true } : {}) },
    tip: `${where}${nameIn(d, it.id)}, ${HAVE_WORDS[it.have]}${on ? '. Click for your other options' : ''}`,
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
      else if (!it) cells.push(text('', 'muted', { chip: EMPTY, w: SLOT_PX, align: 'c', icon: { t: 'icon', sprite: SLOT_SPRITE[slot] ?? 170 }, tip: `${SLOT_NAME[slot] ?? slot}: empty. Click for your options`, ...(slot === 'quiver' ? {} : { on: view(d, { alt: slot }) }) }));
      else cells.push(well(d, it, SLOT_PX, `${SLOT_NAME[slot] ?? slot}: `, slot === 'quiver' ? undefined : view(d, d.alts?.slot === slot ? {} : { alt: slot })));
    }
  return centred(col([{ t: 'grid', cols: 3, gap: DOLL_GAP, vgap: PAD, c: cells }], { bg: STONE, edge: '#14100b', inset: PAD }), FRAME_IN + 2 * PAD + 2);
}

function invGrid(d: TripPanelData, l: TripLayout): Node {
  const cells = l.inventory.map((it) => (it ? well(d, it, INV_PX, '') : text('', 'muted', { w: INV_PX })));
  return centred(col([{ t: 'grid', cols: 4, gap: 3, vgap: 3, c: cells }], { bg: STONE, edge: '#14100b', inset: PAD }), FRAME_IN + 2 * PAD + 2);
}

/** "Rune pouch" with its runes. */
function pouchStrip(d: TripPanelData, l: TripLayout): Node | null {
  if (!l.pouch.length) return null;
  const w = l.pouch.length * INV_PX + (l.pouch.length - 1) * 3;
  const strip = col([{ t: 'grid', cols: l.pouch.length, gap: 3, c: l.pouch.map((p) => well(d, p, INV_PX, 'Rune pouch: ')) }], { bg: STONE, edge: '#14100b', inset: PAD, tip: l.pouch.length > 3 ? 'Divine rune pouch' : 'Rune pouch' });
  return centred(strip, w + 2 * PAD + 2);
}

/** A clicked slot's options: what the player owns for it, best first, with what each does to DPS. */
function altsList(d: TripPanelData): Node | null {
  const a = d.alts;
  if (!a) return null;
  const label = SLOT_NAME[a.slot] ?? a.slot;
  const rows = a.rows.map((x) =>
    row(
      icon({ item: x.id, w: 26, h: 23 }),
      col([text(x.name, x.current ? GREEN : 'white', { font: 'small', wrap: 112 }), small(x.current ? 'In this setup' : [x.delta, x.here ? 'packed' : 'in your bank'].filter(Boolean).join(', '), x.current ? FAINT : SOFT), x.ammo ? small(`with ${x.ammoName ?? 'its ammo'}`, FAINT, { wrap: 112 }) : null], { gap: 1 }),
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

/** "8 switches, 4 food, 4 free slots. Have In bank": the count and the colours' key, one quiet line. */
const footLine = (d: TripPanelData, l: TripLayout): Node =>
  text('', FAINT, {
    font: 'small',
    wrap: W,
    runs: [
      ...(d.summary ? [{ s: `${d.summary}  `, color: FAINT }] : []),
      { s: 'Have', color: GREEN },
      ...(l.inBank ? [{ s: '  In bank', color: AMBER }] : []),
      ...(l.notOwned ? [{ s: '  Not owned', color: CORAL }] : []),
    ],
  });

/** The card's edge and headline colours: red something isn't owned, amber take from the bank, green ready. */
const RED_EDGE = '#a8463d';
const AMBER_EDGE = '#b07a2a';
const GREEN_EDGE = '#3f7a3f';

/** "Missing 1 you don’t own", "Take 27 from your bank", "2 to fix", "Ready for ToA": the next move. */
function headline(d: TripPanelData, c: TripCheck, l: TripLayout): { edge: `#${string}`; head: Node; sub: string } {
  const short = d.content?.short ?? 'the trip';
  const bad = c.rows.filter((r) => !r.ok);
  // The Setup dropdown already names the setup: the card says only when, and anything unusual.
  const when = [d.sourceNote ? `${d.sourceNote}.` : '', d.checkedAt ? `Checked ${d.checkedAt}.` : ''].filter(Boolean).join(' ');
  const glyph = (g: 'check' | 'close', color: Color): Node => icon({ glyph: g, w: 11, h: 11, color });
  const head = (g: Node | undefined, s: string, color: Color): Node => row(g, text(s, color, { font: 'bold', wrap: W - 16 }), undefined, { gap: 5 });
  if (l.notOwned) {
    return {
      edge: RED_EDGE,
      head: head(glyph('close', CORAL), `Missing ${l.notOwned} you don’t own`, CORAL),
      sub: l.inBank ? `And ${l.inBank} to take from your bank. ${when}` : when,
    };
  }
  if (l.inBank) return { edge: AMBER_EDGE, head: head(undefined, `Take ${l.inBank} from your bank`, AMBER), sub: when };
  if (bad.length) return { edge: RED_EDGE, head: head(glyph('close', CORAL), `${bad.length} to fix before ${short}`, CORAL), sub: when };
  return { edge: GREEN_EDGE, head: head(glyph('check', GREEN), `Ready for ${short}`, GREEN), sub: when };
}

/** The check drawn as the setup: worn, inventory, pouch; what isn't an item (spellbook, runes, prayers) as short lines. */
function layoutCard(d: TripPanelData, c: TripCheck, l: TripLayout): Node {
  const bad = c.rows.filter((r) => !r.ok);
  const top = headline(d, c, l);
  // What no slot shows: the spellbook, the runes, the prayers, a supply short by kind.
  const other = bad.filter((r) => r.group === 'book' || r.group === 'pouch' || r.group === 'prayer' || (r.group === 'supplies' && r.item == null));
  const otherLines = other.map((r) => row(icon({ glyph: 'close', w: 9, h: 9, color: CORAL }), small(r.line, SOFT, { wrap: W - 16, ...(r.detail ? { tip: r.detail } : {}) }), undefined, { gap: 5 }));
  const unknown = c.unknown.length ? small(`Not checked: ${c.unknown.join(', ')}.`, FAINT, { wrap: W }) : null;
  const caLine = d.ca?.line && d.setupSel === 'anvil' ? row(icon({ glyph: 'star', w: 10, h: 10, color: GOLD }), small(d.ca.line, SOFT, { wrap: W - 16 }), undefined, { gap: 5 }) : null;
  return section(
    [
      col([top.head, top.sub ? small(top.sub, FAINT, { wrap: W }) : null].filter((x): x is Node => !!x), { gap: 2 }),
      caLine,
      wornGrid(d, l),
      altsList(d),
      d.swap ? row(undefined, small('Reset to the setup', GOLD, { align: 'c' }), undefined, { on: view(d, {}, ''), tip: 'Drop your picks' }) : null,
      l.inventory.some(Boolean) ? invGrid(d, l) : null,
      pouchStrip(d, l),
      footLine(d, l),
      ...otherLines,
      ...c.info.map((s) => small(s, FAINT, { wrap: W })),
      unknown,
    ],
    { gap: GAP, edge: top.edge },
  );
}

/** The one primary button: only when something is in the bank to take. */
function takeButton(d: TripPanelData, c: TripCheck, l: TripLayout): Node | null {
  if (!d.bankFilter || !l.inBank || !c.bank?.length) return null;
  const missing = c.layouts?.missing;
  return button(`Show the ${l.inBank} in my bank`, bankAction(missing?.ids.length ? missing.ids : c.bank, missing), 'Your open bank shows only what to take, laid out as the setup', 'primary');
}

/** A boxed gold word for the compact row (List, Save, Guide ↗). */
const boxed = (label: string, on: Action, tip: string): Node => row(undefined, small(label, GOLD, { align: 'c' }), undefined, { bg: 'card', edge: LINE, pad: 3, on, tip });

/** "List  Save  Guide ↗": the check as words (folded), saving the setup, the written guide. */
function actionRow(d: TripPanelData, c: TripCheck | null, hasLayout: boolean): Node | null {
  if (!d.content) return null;
  const sid = typeof d.setupSel === 'number' ? d.setupSel : null;
  const save =
    d.canSave && (d.status === 'ready' || d.status === 'no-targets')
      ? boxed(
          'Save',
          { a: 'post', act: 'trip-save', args: regionArgs(d, { content: d.content.key, ...(sid ? { sid: String(sid) } : {}), ...(d.swap ? { swap: d.swap } : {}) }) },
          sid ? `Save into ${d.setupName ?? 'this setup'}: ${d.swap ? 'this setup with your picks' : 'what you wear and carry now'}. Only you see it.` : d.swap ? 'Save this setup with your picks as a new setup. Only you see it.' : 'Save Anvil’s loadout as a new setup of yours. Only you see it.',
        )
      : null;
  const guide = d.guide ? boxed('Guide ↗', { a: 'load', v: 'guide', args: regionArgs(d, { id: String(d.guide.id) }) }, `The ${d.guide.title} guide and its setups`) : null;
  // The whole setup in the open bank, when the primary button isn't already showing what to take.
  const setupIds = c?.layouts?.setup;
  const bank = d.bankFilter && hasLayout && setupIds?.ids.length && !(d.layout?.inBank && c?.bank?.length) ? boxed('Bank', bankAction(setupIds.ids, setupIds), 'Your open bank shows the whole setup, laid out: worn, switches, supplies') : null;
  const listRows = c && hasLayout ? c.rows.map((r) => row(icon({ glyph: r.ok ? 'check' : 'close', w: 9, h: 9, color: r.ok ? GREEN : CORAL }), small(r.line, r.ok ? SOFT : 'white', { wrap: W - 16, ...(r.detail ? { tip: r.detail } : {}) }), undefined, { gap: 5 })) : [];
  const grid = (open: boolean): Node | null => {
    const cells = [listRows.length ? boxed(open ? 'List ▴' : 'List', { a: 'flip', key: LIST_KEY }, open ? 'Fold' : 'The check as a list') : null, save, bank, guide].filter((x): x is Node => !!x);
    return cells.length ? { t: 'grid', cols: cells.length, gap: 4, vgap: 4, c: cells } : null;
  };
  const shut = grid(false);
  if (!shut) return null;
  if (!listRows.length) return shut;
  return { t: 'toggle', key: LIST_KEY, off: shut, lit: col([grid(true), ...listRows], { gap: GAP / 2 }) };
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

/**
 * "Anvil’s loadout, for how you play" and "[ Learner | Experienced | Max DPS ]": the plan the loadout
 * engine builds the setup to (switch budget, supplies), shown while Anvil's loadout is picked.
 * Remembered per character and trip ('trip-plan').
 */
function planLine(d: TripPanelData): Node | null {
  if (!d.plan || !d.content || (d.setupSel != null && d.setupSel !== 'anvil')) return null;
  const content = d.content.key;
  return {
    t: 'grid',
    cols: d.plan.presets.length,
    gap: 2,
    // boxChip's look, the small font either way: "Experienced" in bold doesn't fit a third of the card.
    c: d.plan.presets.map((p) => {
      const on = p.key === d.plan!.preset;
      return row(undefined, text(p.label, on ? 'white' : FAINT, { font: 'small', align: 'c' }), undefined, { bg: on ? '#3a3a3a' : 'card', edge: on ? GOLD : LINE, pad: 3, inset: 0, on: { a: 'post', act: 'trip-plan', args: regionArgs(d, { content, plan: p.key }) }, tip: on ? d.plan!.blurb : `Anvil’s loadout for the ${p.label} plan: ${PLAN_TIPS[p.key] ?? ''}` });
    }),
  };
}
const PLAN_TIPS: Record<string, string> = {
  learner: 'one weapon per style, more food for mistakes',
  experienced: 'the weapons, the spec and the pieces that pay for their slot',
  max: 'armour swaps for each style, the fastest kills',
};

/**
 * "Going for a CA?": None and the player's undone Combat Achievements for this boss that change the
 * loadout (lib/loadout/caRules). Chips for a few, the game's combo box past four. A pick re-runs the
 * engine with the task's limits ('trip-ca', remembered per character and trip).
 */
function caLine(d: TripPanelData): Node | null {
  if (!d.ca || !d.content || d.setupSel !== 'anvil' || !d.ca.options.length) return null;
  const content = d.content.key;
  const opts = [{ v: 'none', label: 'None', tip: 'No Combat Achievement: Anvil’s loadout as it is' }, ...d.ca.options.map((o) => ({ v: String(o.id), label: o.name, tip: `${o.name}: ${o.does}` }))];
  const sel = d.ca.sel != null ? String(d.ca.sel) : 'none';
  const label = small('Going for a CA?', FAINT);
  if (opts.length > 4) {
    const combo: Node = { t: 'input', name: 'ca', kind: 'select', options: opts.map((o) => ({ v: o.v, label: o.label })), value: sel, on: { a: 'post', act: 'trip-ca', args: regionArgs(d, { content }) }, tip: 'Your undone Combat Achievements here that change the loadout' };
    return col([label, combo], { gap: 3 });
  }
  return col([label, { t: 'grid', cols: 2, gap: 3, vgap: 3, c: opts.map((o) => boxChip(o.label, o.v === sel, { a: 'post', act: 'trip-ca', args: regionArgs(d, { content, ca: o.v }) }, o.tip)) }], { gap: 3 });
}

export function tripPanelUi(d: TripPanelData): Node {
  const parts: Node[] = [head(d), tripLine(d)];
  const raid = raidLine(d);
  if (raid) parts.push(raid);
  const live = d.status === 'ready' || d.status === 'no-targets';
  const setups = live ? setupLine(d) : null;
  if (setups) parts.push(setups);
  const plan = d.status === 'ready' ? planLine(d) : null;
  if (plan) parts.push(plan);
  const ca = d.status === 'ready' ? caLine(d) : null;
  if (ca) parts.push(ca);
  if (d.note) parts.push(chip(d.note, 'green', { wrap: W }));
  if (d.status === 'ready' && d.check) {
    if (d.layout) {
      parts.push(layoutCard(d, d.check, d.layout));
      const take = takeButton(d, d.check, d.layout);
      if (take) parts.push(take);
    } else parts.push(checkCard(d, d.check));
  } else parts.push(why(d));
  if (d.status === 'behind') parts.push(button('Check again', again(d), 'With what you wear and carry now'));
  const actions = live ? actionRow(d, d.check, !!d.layout) : d.guide ? actionRow({ ...d, canSave: false }, null, false) : null;
  if (actions) parts.push(actions);
  return col(parts, { gap: GAP });
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
