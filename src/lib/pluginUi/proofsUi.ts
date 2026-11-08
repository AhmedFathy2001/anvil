import { type Action, type Node, col, count, gap, muted, nameText, row, text } from './nodes';

// A tile's proofs under its detail in the side panel (the board's tile pane, slot `proofs`): the
// newest PROOFS_STEP, then "Show more" for the next. Pure; lib/tileProofs reads them and
// lib/proofImage signs the picture links.

export const PROOFS_STEP = 6;
export const PROOFS_MAX = 60;
/** The thumbnail as drawn; the site serves it at twice this (proofImage THUMB_W×THUMB_H). */
export const THUMB = { w: 64, h: 40 } as const;

export interface ProofRow {
  id: number;
  who: string | null;
  credit: string | null;
  team: string | null;
  at: string;
  amount: number;
  /** Site paths (lib/proofImage); null without a picture. */
  thumb: string | null;
  full: string | null;
  canDelete: boolean;
}

export interface ProofsOpts {
  /** The proofs view's own args (ev, tile and the board state), for "Show more". */
  args: Record<string, string>;
  n: number;
  more: boolean;
  /** The plugin draws `img` (X-Anvil-Panel-Images); otherwise the picture is a link. */
  images: boolean;
  /** " KC", " gp", "" — after the amount. */
  unit: string;
  /** Every team's proofs (staff): name the team on each. */
  teams: boolean;
}

const DELETE_ASK = 'Delete this proof? It stops counting for the team. Reason (optional):';

/** Delete one: answered with the board's tile detail again (slot `tiles`), so progress redraws too. */
export function deleteAction(args: Record<string, string>, id: number): Action {
  const board = Object.fromEntries(Object.entries(args).filter(([k]) => k !== 'n'));
  return { a: 'post', act: 'proof-delete', args: { ...board, part: 'rows', id: String(id) }, into: 'tiles', ask: DELETE_ASK };
}

function proofRow(p: ProofRow, o: ProofsOpts): Node {
  const view: Action | undefined = p.full ? { a: 'site', path: p.full } : undefined;
  const del = p.canDelete ? deleteAction(o.args, p.id) : undefined;
  const who = p.who ?? 'Someone';
  const lines: Node[] = [
    row(undefined, nameText(who, 'text', p.credit ? { tip: `For ${p.credit}` } : {}), undefined, { gap: 4 }),
    row(text('', 'muted', { at: p.at }), undefined, o.unit ? muted(`${count(p.amount)}${o.unit}`) : p.amount > 1 ? muted(`×${count(p.amount)}`) : undefined, { gap: 4 }),
  ];
  if (o.teams && p.team) lines.push(muted(p.team));
  let picture: Node | undefined;
  if (p.thumb && o.images) picture = { t: 'img', src: p.thumb, w: THUMB.w, h: THUMB.h, tip: 'Open the full screenshot', ...(view ? { on: view } : {}) };
  else if (view) lines.push(text('View screenshot', 'brand', { on: view, tip: 'Open the screenshot in your browser', icon: { t: 'icon', glyph: 'external', w: 10, h: 10, color: 'brand' }, iconAfter: true }));
  else lines.push(muted('No screenshot'));
  const right = del ? ({ t: 'icon', glyph: 'close', w: 10, h: 10, color: 'muted', tip: 'Delete this proof', on: del } as Node) : undefined;
  const menu = [
    ...(view ? [{ label: 'Open screenshot', on: view }] : []),
    ...(del ? [{ label: 'Delete proof…', on: del }] : []),
  ];
  return row(picture, col(lines), right, { gap: 6, bg: 'panel', pad: 4, inset: 4, ...(menu.length ? { menu } : {}) });
}

/** The section: its heading, the rows, and "Show more" while there are older ones. */
export function proofsUi(rows: ProofRow[], o: ProofsOpts, empty: string): Node {
  // `head`: the race page's own card title ("Your proofs"), white and bold like its other cards.
  const parts: Node[] = [o.args.head ? text(o.args.head, 'white', { font: 'bold' }) : text('Proofs', 'brand'), gap(2)];
  if (!rows.length) return col([...parts, muted(empty, { wrap: true })]);
  rows.forEach((p, i) => parts.push(...(i ? [gap(4)] : []), proofRow(p, o)));
  if (o.more && o.n < PROOFS_MAX) {
    parts.push(gap(5), {
      t: 'button',
      label: 'Show more',
      tip: 'Show older proofs',
      on: { a: 'load', v: 'proofs', args: { ...o.args, n: String(Math.min(PROOFS_MAX, o.n + PROOFS_STEP)) }, into: 'proofs' },
    });
  }
  return col(parts);
}
