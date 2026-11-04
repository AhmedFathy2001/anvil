// The plugin side panel, built here and drawn there (`plugin-ui` capability, GET /api/plugin/ui).
//
// The plugin knows a dozen building blocks and nothing about what a player card or a clan is: the
// site decides every line, colour and click, and the plugin's one renderer (UiRenderer.java) draws
// it. Pictures travel as game ids (item, sprite, skill, boss) the plugin draws with RuneLite's own
// managers — never a URL. The one exception is `img` (capability 'panel-images'): a proof's
// thumbnail, named by a PATH on this site the plugin fetches itself (lib/proofImage). A click is one of a fixed set of actions (Action below); the ones that
// reach the site go to this same route and nowhere else.

/** A colour by role, or "#rrggbb". */
export type Color = 'white' | 'text' | 'muted' | 'brand' | 'done' | 'error' | 'claim' | 'progress' | `#${string}`;

/**
 * What a click does. The plugin knows exactly these and drops anything else.
 * - site: open a page on this site (a path, never a URL)
 * - lookup / clan: open a player's or a clan's card in the Lookup tab
 * - load: fetch view `v` and show it in slot `into` (or in place of the whole view); `open` shows one of
 *   the answer's panes first (a tile on the tiles page), so every tile shares one answer the plugin keeps
 * - pane: show one of slot `into`'s panes, already in hand
 * - flip: switch the `key` toggles between their off and lit faces
 * - post: send `act` with `args` and the view's inputs; the answer is a view, shown like `load`
 * - pin: pin (or unpin) a tile's in-game tracker on this client, then do `then`
 * - switch: point the plugin at another of the member's clans (the panel's clan picker does the same)
 */
export type Action =
  | { a: 'site'; path: string }
  | { a: 'lookup'; rsn: string }
  | { a: 'clan'; slug: string }
  | { a: 'load'; v: string; args?: Record<string, string>; into?: string; open?: { into: string; pane: string } }
  | { a: 'pane'; into: string; pane: string }
  | { a: 'flip'; key: string }
  | {
      a: 'post';
      act: string;
      args?: Record<string, string>;
      into?: string;
      /** Ask first (a one-line prompt); the answer goes as field `note`. Cancelling sends nothing. */
      ask?: string;
      askValue?: string;
    }
  | { a: 'pin'; event: number; /** 0 with `on: false` = every pin on the event. */ tile: number; on: boolean; then?: Action }
  | { a: 'switch'; slug: string }
  /** Open one of the panel's own tabs. Only sent to a plugin that says it knows it (X-Anvil-Tab-Links). */
  | { a: 'tab'; tab: 'feed' };

interface Common {
  /** Tooltip, plain text. */
  tip?: string;
  /** Click; the node lights up under the mouse. */
  on?: Action;
  /** Search text for an enclosing filter (default: the node's own text). */
  k?: string;
  /** Under a filter: shown only while something is typed. */
  q?: boolean;
  /** Right-click menu: an item without `on` is shown greyed out (it says why something can't be done). */
  menu?: { label: string; on?: Action }[];
  /**
   * A count the plugin keeps moving without asking again: a bar's fill, or a text's number in `fmt`.
   * It shows the higher of `cur` and what it knows newer — its own kill the moment it lands, a
   * teammate's from the live push.
   */
  live?: Live;
}

/** `of`: "1,234 / 5K" · `raw`: "1234 / 5000" · `pct`: "24%" · `near`: `pct` from a goal of 100K up, else `raw`. */
export interface Live {
  tile: number;
  cur: number;
  goal: number;
  fmt?: 'of' | 'raw' | 'pct' | 'near';
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
      /** The icon after the text (a link's ↗), not before it. */
      iconAfter?: boolean;
      cell?: boolean;
      /** At least this wide (a rank column). */
      w?: number;
      /** Gradient stops drawn across the text (Supporter flair); `color` is the fallback. */
      grad?: `#${string}`[];
      /** The gradient slides along the text (Patron). */
      move?: boolean;
      /** A player's name: the route gives it their Supporter flair, then drops this. Never sent. */
      who?: string;
    })
  | (Common & {
      t: 'icon';
      item?: number;
      qty?: number;
      sprite?: number;
      skill?: string;
      /** A boss, minigame or clue by name or hiscores key: the game's own picture. */
      boss?: string;
      glyph?: 'check' | 'chevron-right' | 'chevron-left' | 'external' | 'close' | 'swatch' | 'star';
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
  /**
   * A picture from this site (capability 'panel-images', sent only to a plugin that says
   * X-Anvil-Panel-Images): `src` is a PATH here, never a URL, drawn fitted inside w×h with a
   * placeholder until it arrives. Only the proof thumbnails use it (lib/proofImage).
   */
  | (Common & { t: 'img'; src: string; w: number; h: number })
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
  /** Draws nothing: fetches `on` (a load) ahead of the click that will want it, so the click is instant. */
  | (Common & { t: 'warm'; on: Action })
  | (Common & {
      t: 'input';
      name: string;
      /** A search fires `on` as the member pauses typing; a select fires it on change. */
      kind: 'select' | 'number' | 'check' | 'search';
      options?: { v: string; label: string }[];
      value?: string;
      min?: number;
      max?: number;
      step?: number;
      label?: string;
    })
  | (Common & { t: 'button'; label: string; /** Shown but can't be pressed. */ off?: boolean })
  | (Common & { t: 'gap'; h: number })
  | (Common & {
      t: 'countdown';
      /** Counts down to this; null = no clock, and `none` shows. */
      at: string | null;
      prefix: string;
      /** Shown once it's due. */
      due: string;
      none: string;
      font?: 'small' | 'regular' | 'bold';
      color?: Color;
    })
  /** A part only the plugin can draw (it reads the game): the starting shot's checks and its button. */
  | (Common & { t: 'native'; name: 'start-proof' })
  /**
   * A live list (capability 'panel-rows'): drawn once with `rows`, then grown by push messages
   * `{t:'rows', feeds:[…], rows:[…]}` naming this `id` — never redrawn per row. One list, one row
   * renderer, so a thousand rows cost what twenty do. With `send` it has a message box under it:
   * the event chat.
   */
  | (Common & {
      t: 'feed';
      /** What push messages address it by: `moments:clan:<id>`, `chat:<event>`, `chat:<event>:team:<t>`. */
      id: string;
      /** Newest first. */
      rows: FeedRow[];
      /** At most this many held; the oldest go. */
      cap?: number;
      /** The list's height in px (it scrolls inside). */
      h?: number;
      /** Shown while there are no rows. */
      empty?: string;
      /** A message box: Enter posts `act` with the text as field `msg`, and nothing is redrawn. */
      send?: { act: string; args?: Record<string, string>; hint?: string; max?: number };
      /** Chat: names whose lines are the viewer's own (per person), for live rows. */
      mine?: string[];
      /** 'paused' / 'closed' grey the box out with this line instead. */
      locked?: string;
    });

/**
 * One row of a feed. Kept flat and small: a thousand of these cross the socket in an hour.
 * `on` runs when the row is clicked, `gz` is the reaction at its right edge. `reacts` are chips there
 * instead (a death's "Sad" / "Sit"), each toggled the same way as `gz`; a plugin from before them
 * ignores the field, so a row carries one or the other, never both.
 */
export interface FeedRow {
  id: string;
  /** A picture at the left: an item, or a glyph. */
  item?: number;
  glyph?: 'check' | 'star' | 'chevron-right';
  glyphColor?: Color;
  /** Bold line. A chat row leaves it out and uses `who` + `text` on one line. */
  title?: string;
  who?: string;
  whoColor?: Color;
  /** Supporter flair on `who`. */
  grad?: `#${string}`[];
  /** The gradient slides along the name (Patron), unless the player turned animation off. */
  move?: boolean;
  text?: string;
  textColor?: Color;
  /** Small prefix tag: MOD, HOST, TEAM. */
  tag?: string;
  tagColor?: Color;
  /** ISO time: drawn as "3m". */
  at: string;
  /** Right-hand figure: "4.1M", "+3". */
  value?: string;
  /** The viewer's own, or their team's: drawn on a lighter ground. */
  mine?: boolean;
  /** `who`: the chip's tooltip, "GZ · Mossy, Rikkert and 3 others" (a plugin from before it ignores it). */
  gz?: { n: number; mine?: boolean; on: Action; who?: string };
  reacts?: { kind: string; label: string; n: number; mine?: boolean; on: Action; who?: string }[];
  on?: Action;
  /** Right-click entries (mods: delete, mute). */
  menu?: { label: string; on: Action }[];
}

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
/** The exact count for a tooltip where the line shows a short one ("1,234,567 / 2,700,000"); none when small. */
export const exact = (current: number, goal: number): string | undefined =>
  goal >= 10_000 || current >= 10_000 ? `${current.toLocaleString('en-US')} / ${goal.toLocaleString('en-US')}` : undefined;

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

// ---- Supporter flair: builders mark names, the route colours them ---------------------------------

/** A player's name. Builders stay pure; `withFlair` later gives Supporters their colours and star. */
export const nameText = (rsn: string, color: Color = 'white', extra: Partial<Extract<Node, { t: 'text' }>> = {}): Node =>
  text(rsn, color, { ...extra, who: rsn });

type TextNode = Extract<Node, { t: 'text' }>;
/** `label` names the tier for the star's tooltip ("Anvil Patron"). */
type Ink = { color: `#${string}`; grad?: `#${string}`[]; move?: boolean; label?: string };

function eachChild(n: Node, f: (c: Node) => void): void {
  const any = n as unknown as Record<string, unknown>;
  for (const key of ['c', 'l', 'r', 'head', 'icon', 'off', 'lit', 'or']) {
    const v = any[key];
    if (Array.isArray(v)) v.forEach((x) => x && typeof x === 'object' && f(x as Node));
    else if (v && typeof v === 'object' && 't' in (v as object)) f(v as Node);
  }
  if (n.t === 'tabs') n.tabs.forEach((t) => f(t.c));
  if (n.t === 'slot' && n.panes) Object.values(n.panes).forEach(f);
}

/** Every name marked with `nameText` in a tree. */
export function namesIn(root: Node): string[] {
  const out = new Set<string>();
  const walk = (n: Node) => {
    if (n.t === 'text' && n.who) out.add(n.who);
    eachChild(n, walk);
  };
  walk(root);
  return [...out];
}

/**
 * Colour each marked name whose owner supports Anvil (`ink(name)` says how) and drop every mark.
 * A name with an icon of its own (a team swatch) keeps it; the rest get the star after the name.
 */
export function applyFlair(root: Node, ink: (name: string) => Ink | null): Node {
  const walk = (n: Node) => {
    if (n.t === 'text' && n.who !== undefined) {
      const t = n as TextNode;
      const found = ink(t.who!);
      delete t.who;
      if (found) {
        t.color = found.color;
        if (found.grad) t.grad = found.grad;
        if (found.move) t.move = true;
        if (!t.icon) {
          t.icon = { t: 'icon', glyph: 'star', w: 10, h: 10, color: '#ffd35c' };
          t.iconAfter = true;
          // Whatever the name already explained stays, after who they are.
          const who = found.label ?? 'Anvil Supporter';
          t.tip = t.tip ? `${who} · ${t.tip}` : who;
        }
      }
    }
    eachChild(n, walk);
  };
  walk(root);
  return root;
}
