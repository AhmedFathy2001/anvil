// The plugin side panel, built here and drawn there (`plugin-ui` capability, GET /api/plugin/ui).
//
// The plugin knows a dozen building blocks and nothing about what a player card or a clan is: the
// site decides every line, colour and click, and the plugin's one renderer (UiRenderer.java) draws
// it. Pictures travel as game ids (item, sprite, skill, boss) the plugin draws with RuneLite's own
// managers — never a URL. A click is one of a fixed set of actions (Action below); the ones that
// reach the site go to this same route and nowhere else.

/** A colour by role, or "#rrggbb". */
export type Color = 'white' | 'muted' | 'brand' | 'done' | 'error' | 'claim' | `#${string}`;

/**
 * What a click does. The plugin knows exactly these and drops anything else.
 * - site: open a page on this site (a path, never a URL)
 * - lookup / clan: open a player's or a clan's card in the Lookup tab
 * - load: fetch view `v` and show it in slot `into` (or in place of the whole view)
 * - pane: show one of slot `into`'s panes, already in hand
 * - flip: switch the `key` toggles between their off and lit faces
 * - post: send `act` with `args` and the view's inputs; the answer is a view, shown like `load`
 */
export type Action =
  | { a: 'site'; path: string }
  | { a: 'lookup'; rsn: string }
  | { a: 'clan'; slug: string }
  | { a: 'load'; v: string; args?: Record<string, string>; into?: string }
  | { a: 'pane'; into: string; pane: string }
  | { a: 'flip'; key: string }
  | { a: 'post'; act: string; args?: Record<string, string>; into?: string };

interface Common {
  /** Tooltip, plain text. */
  tip?: string;
  /** Click; the node lights up under the mouse. */
  on?: Action;
  /** Search text for an enclosing filter (default: the node's own text). */
  k?: string;
  /** Under a filter: shown only while something is typed. */
  q?: boolean;
}

export type Node =
  | (Common & { t: 'col'; c: Node[]; gap?: number; card?: boolean; inset?: number; bg?: 'card' | 'panel' })
  | (Common & {
      t: 'row';
      l?: Node;
      c?: Node;
      r?: Node;
      gap?: number;
      bg?: 'card' | 'panel';
      /** Space above and below, and on the right. */
      pad?: number;
      /** Space on the left. */
      inset?: number;
    })
  | (Common & { t: 'grid'; cols: number; c: Node[]; gap?: number; vgap?: number })
  | (Common & {
      t: 'text';
      s?: string;
      color?: Color;
      font?: 'small' | 'regular' | 'bold';
      /** Wrap to the panel instead of clipping. */
      wrap?: boolean;
      align?: 'r' | 'c';
      /** A timestamp: the text is "3d ago", worked out when drawn. */
      at?: string;
      icon?: Node;
      cell?: boolean;
    })
  | (Common & {
      t: 'icon';
      item?: number;
      qty?: number;
      sprite?: number;
      skill?: string;
      /** A boss, minigame or clue by name or hiscores key: the game's own picture. */
      boss?: string;
      glyph?: 'check' | 'chevron-right' | 'chevron-left' | 'external' | 'close';
      color?: Color;
      w?: number;
      h?: number;
      /** Drawn faint: a log slot not yet owned. */
      dim?: boolean;
      /** No picture for it: as the icon of a text, this goes in front of the text instead. */
      alt?: string;
      /** No picture for it: draw this icon instead. */
      or?: Node;
    })
  | (Common & { t: 'bar'; pct: number; color?: Color; h?: number; label?: string; bg?: 'card' | 'panel' })
  | (Common & { t: 'tabs'; key: string; tabs: { label: string; c: Node }[]; open?: string })
  | (Common & { t: 'fold'; head: Node; c: Node; open?: boolean; /** A chevron at the head's right that turns when open. */ chev?: boolean })
  | (Common & {
      t: 'filter';
      hint?: string;
      /** Show the search box (a short list doesn't need one). */
      box?: boolean;
      /** Shown when nothing matches. */
      none?: string;
      /** At most this many matches, then `more`. */
      max?: number;
      more?: string;
      /** The searched rows are the children of these (a grid's cells, a column's rows). */
      c: Node[];
    })
  | (Common & { t: 'slot'; id: string; c: Node; panes?: Record<string, Node>; load?: Action })
  | (Common & { t: 'toggle'; key: string; off: Node; lit: Node })
  | (Common & {
      t: 'input';
      name: string;
      kind: 'select' | 'number' | 'check';
      options?: { v: string; label: string }[];
      value?: string;
      min?: number;
      max?: number;
      step?: number;
      label?: string;
    })
  | (Common & { t: 'button'; label: string })
  | (Common & { t: 'gap'; h: number });

/** A view: the node tree plus whether the plugin may hold it a while (a lookup) or not (your own). */
export interface View {
  ui: Node;
}

// ---- Builders: the shapes every view uses, so they read the same everywhere -------------------

export const text = (s: string, color: Color = 'white', extra: Partial<Extract<Node, { t: 'text' }>> = {}): Node => ({
  t: 'text',
  s,
  color,
  ...extra,
});
export const muted = (s: string, extra: Partial<Extract<Node, { t: 'text' }>> = {}): Node => text(s, 'muted', extra);
export const gap = (h: number): Node => ({ t: 'gap', h });
export const col = (c: (Node | null | false | undefined)[], extra: Partial<Extract<Node, { t: 'col' }>> = {}): Node => ({
  t: 'col',
  c: c.filter((n): n is Node => !!n),
  ...extra,
});
/** The darker card with its 8px inset. */
export const card = (c: (Node | null | false | undefined)[], extra: Partial<Extract<Node, { t: 'col' }>> = {}): Node =>
  col(c, { card: true, ...extra });
export const row = (l: Node | undefined, c: Node | undefined, r: Node | undefined, extra: Partial<Extract<Node, { t: 'row' }>> = {}): Node => ({
  t: 'row',
  ...(l ? { l } : {}),
  ...(c ? { c } : {}),
  ...(r ? { r } : {}),
  ...extra,
});
/** A section's orange name, with an optional white figure at the right. */
export const header = (left: string, right?: string | null): Node => row(text(left, 'brand'), undefined, right ? text(right) : undefined, { gap: 0 });
export const icon = (spec: Omit<Extract<Node, { t: 'icon' }>, 't'>): Node => ({ t: 'icon', ...spec });
/** A "‹ Back to …" line. */
export const backRow = (label: string, on: Action): Node =>
  row(undefined, text(label, 'muted', { icon: icon({ glyph: 'chevron-left', w: 9, h: 9, color: 'muted' }) }), undefined, { on, pad: 4 });
/** A full-width message card: loading, nothing found, couldn't reach. */
export const message = (s: string, extra: Node[] = []): View => ({ ui: card([muted(s, { wrap: true }), ...extra]) });
export const button = (label: string, on: Action, tip?: string): Node => ({ t: 'button', label, on, ...(tip ? { tip } : {}) });

/** Part of a whole as 0..100, rounded down so a goal never reads as reached before it is. */
export function percent(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.max(0, Math.min(100, Math.floor((part * 100) / whole)));
}

/** "9,999", "12K", "4.1M", "4.6B": the game's capital suffixes, rounded down. */
export function count(n: number): string {
  if (n < 10_000) return n.toLocaleString('en-US');
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K`;
  const b = n >= 1_000_000_000;
  const tenths = Math.floor(n / (b ? 100_000_000 : 100_000));
  return `${Math.floor(tenths / 10)}${tenths % 10 === 0 ? '' : `.${tenths % 10}`}${b ? 'B' : 'M'}`;
}

export const fmt = (n: number): string => n.toLocaleString('en-US');

/** A path segment, encoded the way the site's own links encode it. */
export const seg = (s: string): string => encodeURIComponent(s.trim());
