// The pre-trip check in the panel (view 'trip', drawn in Lookup's Guides mode). PURE: pluginUi/
// tripView gathers the data. The plugin asks for it when the bank closes in a trip region
// (lib/tripContent) and shows the answer's `warn` on its overlay; the panel has the whole check.
//
//   Pre-trip check                                ↻
//   Trip: ToA · picked from the ToA lobby · change
//   (away from a trip region: "Checking for: Doom (last trip) · change   clear", lib/tripTarget)
//   ┌ 2 problems ─────────────────────────────────┐
//   │ Checked against the guide's Advanced setup   │
//   │ ▣ No stab weapon: Kephri (Fang in bank)    ✕ │
//   │ ▣ Rune pouch: no Death runes               ✕ │
//   │ ✓ 9 checks met ›                             │
//   │ Switches 5 slots · 19 free for supplies      │
//   └──────────────────────────────────────────────┘
//   [ Check again ]  [ Save what I'm wearing as my ToA setup ]
//
// Only the failing rows are open; the rest fold to "✓ N checks met". No combat cues, ever.

import { button, col, icon, row, text, type Action, type Node } from './nodes';
import { CARD_W, CORAL, FAINT, GOLD, GREEN, SOFT, boxChip, chip, section, small, title } from './sections';
import type { TripCheck, TripRow, TripSource } from '@/lib/tripCheck';

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
}

const W = CARD_W;
const PICK_KEY = 'trip-pick';
const OK_KEY = 'trip-ok';

const regionArgs = (d: TripPanelData, extra: Record<string, string> = {}): Record<string, string> => ({ ...(d.region ? { region: d.region } : {}), ...extra });
const again = (d: TripPanelData): Action => ({ a: 'load', v: 'trip', args: regionArgs(d, { why: 'manual', ...(d.content && !d.fromRegion && !d.fromTarget ? { content: d.content.key } : {}) }) });
/** Look at a trip without making it the target (any monster: the calc). */
const pick = (d: TripPanelData, key: string): Action => ({ a: 'load', v: 'trip', args: regionArgs(d, { why: 'manual', content: key }) });
/** Make it the next-trip target: checked at whichever bank the player gears up at. */
const aim = (d: TripPanelData, key: string): Action => ({ a: 'load', v: 'trip', args: regionArgs(d, { why: 'manual', target: key }) });
const clearAim = (d: TripPanelData): Action => ({ a: 'load', v: 'trip', args: regionArgs(d, { why: 'manual', target: 'clear' }) });
/** The plugin's bank shows only these ids (display only: nothing is moved). */
const bankAction = (ids: number[]): Action => ({ a: 'bank', ids: ids.join(',') });

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
    none: 'No monster matches.',
    max: 12,
    more: 'Keep typing to narrow it.',
    // Search-only rows: the plugin builds a row only when it matches what's typed. Thousands of eager
    // rows took ~30 s to draw, and a col with a gap isn't searched at all (its spacers aren't rows).
    c: [],
    x: d.monsters.map((m) => [m.name, m.key]),
    xt: row(undefined, text('{0}', 'white', { font: 'small', wrap: W - 20 }), icon({ glyph: 'chevron-right', w: 9, h: 9, color: FAINT }), { bg: 'raised', pad: 3, inset: 6, on: pick(d, 'm:{1}'), tip: 'Check a trip to {0}: Anvil works a setup out from your bank' }),
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
  const filter = bankFilter && r.bank?.length ? r.bank : null;
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
  const showAll = d.bankFilter && bad.length && c.bank?.length ? button('Show missing in bank', bankAction(c.bank), 'Your open bank shows only what this check says to take') : null;
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
    [top, source, ...bad.map((r) => failRow(r, !!d.bankFilter)), showAll, okFold, ...c.info.map((s) => small(s, SOFT, { wrap: W })), unknown],
    { gap: 6, edge: bad.length ? CORAL : GREEN },
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

export function tripPanelUi(d: TripPanelData): Node {
  const parts: Node[] = [head(d), tripLine(d)];
  if (d.note) parts.push(chip(d.note, 'green', { wrap: W }));
  if (d.status === 'ready' && d.check) parts.push(checkCard(d, d.check));
  else parts.push(why(d));
  if (d.status === 'ready' || d.status === 'none' || d.status === 'no-targets') {
    if (d.status === 'ready') parts.push(button('Check again', again(d), 'With what you wear and carry now'));
  }
  if (d.status === 'behind') parts.push(button('Check again', again(d), 'With what you wear and carry now'));
  if (d.status === 'ready' || d.status === 'none' || d.status === 'no-targets') {
    if (d.canSave && d.content) {
      parts.push(
        col([
          button(`${d.hasOwn ? 'Replace my' : 'Save as my'} setup`, { a: 'post', act: 'trip-save', args: regionArgs(d, { content: d.content.key }) }, 'Your worn gear and inventory become the setup this check uses for this trip. Only you see it.'),
          small(`What you wear and carry now becomes your ${d.content.name} setup. Only you see it.`, FAINT, { wrap: W + 10, align: 'c' }),
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
