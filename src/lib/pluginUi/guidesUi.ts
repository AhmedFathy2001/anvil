// The plugin's Guides views, built from the node types the plugin already draws (lib/pluginUi/
// nodes): the Lookup tab's Guides search, a guide, a slot's Alternatives, and the You tab's guides
// card. PURE: the data comes in prepared (pluginUi/guidesView). Text only — no HTML, no timers, no
// live fight cues (RuneLite's rules).
//
// SIZED FOR THE REAL PANEL. The mockups were drawn ~245px wide; the side panel gives ~205px of
// content, ~185px inside a card (sections CARD_W). So: short level labels (Beginner | Mid |
// Advanced), filters as three short chips that open their options under them, one column where the
// mockup had two, and the equipment grid as three 34px wells.
//
// EVERY GUIDE OPENS. Setups are one part of a guide, not the gate: a raid, skilling or clan guide
// shows its written sections (lib/pluginUi/guideBody), its tips and its requirements; a progression
// route shows its chapters; a guide with setups adds Setup | How to | Upgrades.
//
// PHASE 2 HOOKS (sent only to a plugin at or past GUIDES_PANEL_MIN_PLUGIN, load.ts):
//   COPY      { a: 'copy', path } — the plugin GETs `path` (/api/plugin/guide-export?…) and puts its
//             `text` on the clipboard. Older plugins get a 'site' link to copy on the site instead.
//   REGION    the plugin sends args.region (the map region it stands in) when it loads 'guides', so
//             the view can say "You're at Vorkath · open guide?" (GUIDE_REGIONS below).
//   QUILL     icon glyphs 'quill-bronze' | 'quill-silver' | 'quill-gold' | 'quill-star' on the byline;
//             older plugins get a text rank instead.
//   ITEMS     POST /api/plugin/items — once the plugin sends it, "Missing", "Your version" and the
//             Before-you-go supply ticks fill themselves.
// The Players | Clans | Guides switch is the plugin's own, above the view: none is drawn here.

import { button, card, col, gap, icon, muted, row, text, type Action, type Color, type GuideQuillGlyph, type Node } from './nodes';
import { backHeader } from './playerCardUi';
import { CARD_W, CORAL, FAINT, GOLD, GREEN, PROGRESS, SOFT, boxChip, chip, section, small, title } from './sections';
import type { BodySection } from './guideBody';

/** A row's picture: an item, a boss (hiscores key or name) or a skill. */
export type GuidePic = { item?: number; boss?: string; skill?: string } | null;

export interface GuideRowData {
  id: number;
  title: string;
  category: string;
  pic: GuidePic;
  meta: string;
  by: string;
}

export interface GuidesSearchData {
  recent: GuideRowData[];
  sections: { label: string; rows: GuideRowData[] }[];
  filters: { level: string; account: string; build: string };
  here: { id: number; title: string; where: string; pic: GuidePic } | null;
  /** The map region the plugin said it stands in, carried on every action so "You're at" stays. */
  region?: string;
}

/** Filter options: `label` on the chip (short, fits a third of the panel), `long` in its list. */
const FILTERS: { name: 'level' | 'account' | 'build'; title: string; none: string; options: { v: string; label: string; long?: string }[] }[] = [
  {
    name: 'level',
    title: 'Level',
    none: '',
    options: [
      { v: '', label: 'My level', long: 'Fits my levels' },
      { v: 'beginner', label: 'Beginner' },
      { v: 'intermediate', label: 'Mid', long: 'Intermediate' },
      { v: 'advanced', label: 'Advanced' },
    ],
  },
  {
    name: 'account',
    title: 'Account',
    none: '',
    options: [
      { v: '', label: 'Any acct', long: 'Any account' },
      { v: 'main', label: 'Main' },
      { v: 'ironman', label: 'Ironman' },
      { v: 'hcim', label: 'HCIM' },
      { v: 'uim', label: 'UIM' },
      { v: 'gim', label: 'GIM' },
    ],
  },
  {
    name: 'build',
    title: 'Build',
    none: 'any',
    options: [
      { v: 'any', label: 'Any build' },
      { v: 'pure', label: 'Pure', long: 'Pure (1 def)' },
      { v: 'zerker', label: 'Zerker' },
      { v: 'med', label: 'Med' },
      { v: 'main', label: 'Main build' },
    ],
  },
];

/** Region id → where it is and the library guide for it, for "You're at …" (the plugin sends `region`). */
export const GUIDE_REGIONS: Record<number, { slug: string; where: string }> = {
  9023: { slug: 'vorkath-guide', where: 'Ungael' },
  14131: { slug: 'barrows-beginners', where: 'the Barrows' },
  14231: { slug: 'barrows-beginners', where: 'the Barrows tunnels' },
};

/** Short level names for tabs a third of the panel wide. */
export const LEVEL_SHORT: Record<string, string> = { beginner: 'Beginner', intermediate: 'Mid', advanced: 'Advanced' };

const withRegion = (args: Record<string, string>, region?: string): Record<string, string> => (region ? { ...args, region } : args);
const openGuide = (id: number, region?: string, extra: Record<string, string> = {}): Action => ({ a: 'load', v: 'guide', args: withRegion({ id: String(id), ...extra }, region) });

/** Text wrap widths (pt): in a card, beside a 32px picture in a card, in a step box in a card. */
const W_CARD = CARD_W;
const W_BESIDE = 140;
const W_STEP = 168;

/** The picture in a 32px dark well, as every guide row and card shows it. */
function picWell(p: GuidePic, size = 32): Node {
  const inner = p?.item
    ? { t: 'icon' as const, item: p.item, w: size - 2, h: size - 5 }
    : p?.boss
      ? { t: 'icon' as const, boss: p.boss, w: size - 6, h: size - 6, or: { t: 'icon' as const, glyph: 'star' as const, w: 12, h: 12, color: GOLD } }
      : p?.skill
        ? { t: 'icon' as const, skill: p.skill }
        : { t: 'icon' as const, glyph: 'star' as const, w: 12, h: 12, color: GOLD };
  return text('', 'white', { chip: '#2e2e2e', w: size, align: 'c', icon: inner });
}

function guideRow(r: GuideRowData, region?: string): Node {
  return row(
    picWell(r.pic),
    col([text(r.title, 'white'), small(r.meta, FAINT), r.by ? small(r.by, '#8c8c8c') : null], { gap: 1 }),
    icon({ glyph: 'chevron-right', w: 9, h: 9, color: FAINT }),
    { bg: 'raised', pad: 5, inset: 6, gap: 7, on: openGuide(r.id, region), k: `${r.title} ${r.category} ${r.meta} ${r.by}`, tip: `Open ${r.title}` },
  );
}

/** A list's section name: muted capitals, the count in gold. Hidden while searching (key ''). */
const listHead = (label: string, count?: string): Node =>
  row(text(label.toUpperCase(), FAINT, { font: 'bold' }), undefined, count ? small(count, PROGRESS) : undefined, { pad: 2, k: '' });

/** Three short chips (Level | Account | Build); each opens its options under the chips. */
function filterChips(d: GuidesSearchData): Node {
  const state = `${d.filters.level}|${d.filters.account}|${d.filters.build}`;
  const act = (over: Record<string, string>): Action => ({ a: 'post', act: 'guides-filter', args: withRegion({ ...d.filters, ...over }, d.region) });
  const chips = FILTERS.map((f) => {
    const v = d.filters[f.name];
    const opt = f.options.find((o) => o.v === v) ?? f.options[0];
    return boxChip(`${opt.label} ▾`, v !== f.none, { a: 'flip', key: `guides-filter:${f.name}:${state}` }, `${f.title}: ${opt.long ?? opt.label}`);
  });
  const lists = FILTERS.map((f) => ({
    t: 'toggle' as const,
    key: `guides-filter:${f.name}:${state}`,
    off: gap(0),
    lit: col([
      gap(6),
      card([
        small(f.title, FAINT),
        { t: 'grid', cols: 2, gap: 4, vgap: 4, c: f.options.map((o) => boxChip(o.long ?? o.label, o.v === d.filters[f.name], act({ [f.name]: o.v }))) },
      ], { inset: 6, gap: 5 }),
    ]),
  }));
  // A col with a gap: the search never filters it (only a list whose rows are its children is searched).
  return col([{ t: 'grid', cols: 3, gap: 4, c: chips }, col(lists), gap(2)], { gap: 2 });
}

/** The Guides search (the Lookup tab's Guides mode): "You're at", the search, filters, the lists. */
export function guidesSearchUi(d: GuidesSearchData): Node {
  const parts: Node[] = [];
  if (d.here) {
    parts.push(
      row(
        picWell(d.here.pic),
        col([text(`You're at ${d.here.title}`, 'white', { font: 'bold' }), small(`${d.here.where} · open guide?`, FAINT)], { gap: 1 }),
        small('Open ›', GOLD),
        { bg: 'card', edge: GOLD, pad: 7, inset: 8, gap: 8, on: openGuide(d.here.id, d.region), tip: `Open the ${d.here.title} guide` },
      ),
    );
  }
  const lists: Node[] = [filterChips(d)];
  const list = (label: string, rows: GuideRowData[], count: boolean): Node => ({
    t: 'grid',
    cols: 1,
    vgap: 4,
    c: [listHead(label, count ? String(rows.length) : undefined), ...rows.map((r) => guideRow(r, d.region)), { ...gap(6), k: '' }],
  });
  if (d.recent.length) lists.push(list('Recent', d.recent, false));
  for (const s of d.sections) lists.push(list(s.label, s.rows, true));
  parts.push({ t: 'filter', hint: 'Search guides, bosses, skills…', box: true, none: 'No guide matches. Try fewer words.', max: 80, more: 'Keep typing to narrow it.', c: lists });
  parts.push(row(undefined, small('Browse all on the site ↗', GOLD, { align: 'c' }), undefined, { pad: 4, on: { a: 'site', path: '/guides' }, tip: 'The guide library on the Anvil website' }));
  return col(parts, { gap: 8 });
}

// ── A guide ────────────────────────────────────────────────────────────────────────────────

export interface PanelSetup {
  key: string;
  name: string;
  sub: string;
  weapon: number | null;
  blocked: string | null;
  /** The curator's pick for its level. */
  pick?: boolean;
}
export interface PanelSlot {
  slot: string;
  id: number | null;
  /** "you'll use X" when the reader's own version uses a fallback here. */
  fallback: string | null;
  missing: boolean;
}
export interface PanelCheck {
  text: string;
  /** true met · false not met · null not known. */
  ok: boolean | null;
  pic: { item?: number; skill?: string; quest?: true } | null;
}
export interface PanelRoute {
  signedIn: boolean;
  following: boolean;
  done: number;
  total: number;
  chapters: { name: string; steps: { title: string; item: number | null; why: string; done: boolean; skipped: boolean }[] }[];
}
export interface GuidePanelData {
  id: number;
  slug: string;
  title: string;
  /** The category's name ("Raids", "Bossing"). */
  kind: string;
  /** The level shown, or null for a guide with no levels. */
  tier: string | null;
  tiers: { key: string; label: string }[];
  byline: string;
  rankGlyph: string | null;
  region?: string;
  /** This level's setups (the guide's, then community ones). Empty: no Setup tab. */
  setups: PanelSetup[];
  current: string | null;
  dps: string;
  usingFallbacks: string | null;
  slots: PanelSlot[];
  inventory: ({ id: number; q?: number } | null)[];
  pouch: { id: number; q: number }[];
  spellbook: string;
  /** 0 standard, 1 ancient, 2 lunar, 3 arceuus. */
  spellbookId: number;
  spells: string[];
  hasMarkers: number;
  missing: { id: number; name: string; price: string }[] | null;
  checkedAt: string | null;
  checklist: PanelCheck[];
  /** The setup's own how-to steps. */
  setupSteps: string[];
  /** The written body for this level: its sections. */
  body: BodySection[];
  tips: { text: string; useful: number }[];
  mistakes: string[];
  upgrades: { id: number; name: string; gain: string; price: string }[];
  community: { key: string; name: string; used: number; weapon: number | null }[];
  phase2: boolean;
  alternatives: PanelAlternatives | null;
  route: PanelRoute | null;
  /** "Your gear now vs this setup": owner only, from the plugin's worn-gear push. Null hides it. */
  gearNow?: PanelGearNow | null;
}
export interface PanelGearNow {
  /** One per target the setup is for: its short name, worn DPS, the setup's DPS. */
  rows: { name: string; you: number; guide: number }[];
  /** A single-target guide: time per kill, yours and the guide's ("1:12"). */
  ttk: { you: string; guide: string } | null;
  /** The guide's item for the slot that raises the worn DPS most, and what is worn there now. */
  gap: { slot: string; guide: string; worn: string | null } | null;
  /** "You" used the character's own combat levels (else the setup's). */
  ownLevels?: boolean;
}
export interface PanelAlternatives {
  slot: string;
  rows: { id: number; name: string; price: string; note: string; owned: boolean; inUse: boolean; skipped: boolean }[];
  skipped: { id: number; name: string }[];
  budget: string;
  signedIn: boolean;
}

const SLOT_ROWS: (string | null)[][] = [
  [null, 'head', 'quiver'],
  ['cape', 'neck', 'ammo'],
  ['weapon', 'body', 'shield'],
  [null, 'legs', null],
  ['hands', 'feet', 'ring'],
];
const SLOT_LABEL: Record<string, string> = { head: 'Head', cape: 'Cape', neck: 'Neck', ammo: 'Ammo', weapon: 'Weapon', body: 'Body', shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet', ring: 'Ring', quiver: 'Quiver' };
/** The game's empty-slot pictures (RuneLite SpriteID.EQUIPMENT_SLOT_*). */
const SLOT_SPRITE: Record<string, number> = { head: 156, cape: 157, neck: 158, weapon: 159, ring: 160, body: 161, shield: 162, legs: 163, hands: 164, feet: 165, ammo: 166 };
/** The spellbook's tab picture (SpriteID TAB_MAGIC and TAB_MAGIC_SPELLBOOK_*). */
const SPELLBOOK_SPRITE = [780, 1583, 1584, 1711];
const QUEST_SPRITE = 776;

/** The equipment screen's wells: owned, an owned fallback, not owned. */
const WELL = { own: '#262626', fallback: '#3a2a14', missing: '#3d1f1c' } as const;
const SLOT_PX = 34;
const SLOT_GAP = 6;
/** The frame's inset; the gear and inventory frames are centred inside the setup card. */
const FRAME_IN = 6;

/** `node` (of `width` px) centred in a card's 185px. */
function centred(node: Node, width: number): Node {
  const pad = Math.max(0, Math.floor((W_CARD - width) / 2));
  return row(text('', 'muted', { w: pad }), row(node, undefined, undefined, { gap: 0 }), undefined, { gap: 0 });
}

const guideBack = (d: Pick<GuidePanelData, 'region'>): Action => ({ a: 'load', v: 'guides', ...(d.region ? { args: { region: d.region } } : {}) });
// Loads, not posts: the plugin asks again for the last view it LOADED (its Refresh, and after a worn-gear
// push), so a picked setup or an open slot stays on screen. The 'guide-pick' and 'guide-alt' posts still answer.
const pickSetup = (d: GuidePanelData, setup: string): Action => openGuide(d.id, d.region, { tier: d.tier ?? '', setup });

/** "‹ Vorkath" over "Bossing · Intermediate ↗", then the byline with the writer's quill. */
function guideHead(d: GuidePanelData, back: Action = guideBack(d)): Node {
  const tierLabel = d.tiers.find((t) => t.key === d.tier)?.label;
  const line = [d.kind, tierLabel].filter(Boolean).join(' · ') || 'Guide';
  return col([
    backHeader(d.title, line, false, back, `/guides/${d.slug}`, W_CARD),
    d.byline
      ? row(undefined, small(d.byline, FAINT, d.rankGlyph ? { icon: { t: 'icon', glyph: d.rankGlyph as GuideQuillGlyph, w: 12, h: 12 } } : {}), undefined, { inset: 16 })
      : null,
  ], { gap: 2 });
}

/** Beginner | Mid | Advanced: outlined buttons, the open one gold. Each reloads the guide at that level. */
function levelChips(d: GuidePanelData): Node | null {
  if (d.tiers.length < 2) return null;
  return {
    t: 'grid',
    cols: d.tiers.length,
    gap: 4,
    c: d.tiers.map((t) => boxChip(LEVEL_SHORT[t.key] ?? t.label, t.key === d.tier, openGuide(d.id, d.region, { tier: t.key }), `${t.label} level`)),
  };
}

/** A copy button: the phase-2 clipboard action, or (older plugins) a link to copy on the site. */
function copyButton(label: string, d: GuidePanelData, kind: 'banktag' | 'setup' | 'markers'): Node {
  const on: Action = d.phase2
    ? { a: 'copy', path: `/api/plugin/guide-export?guide=${d.id}&setup=${encodeURIComponent(d.current ?? '')}&kind=${kind}&mine=1` }
    : { a: 'site', path: `/guides/${d.slug}` };
  return button(d.phase2 ? label : `${label} (on the site)`, on, d.phase2 ? undefined : 'Copying straight from the panel comes in the next plugin update');
}

/** The setup picker: the open setup with "1 of 3 ▾"; a click lists the others to switch to. */
function setupPicker(d: GuidePanelData): Node | null {
  if (d.setups.length < 2) return null;
  const i = Math.max(0, d.setups.findIndex((s) => s.key === d.current));
  const cur = d.setups[i];
  const key = `guide-setups:${d.id}:${d.tier}:${d.current}`;
  const line = (s: PanelSetup, lit: boolean): Node =>
    col([text(s.name, lit ? GOLD : 'white', { font: lit ? 'bold' : 'regular' }), small(s.blocked ? `Not for you: ${s.blocked}` : s.sub || ' ', s.blocked ? CORAL : s.pick ? PROGRESS : FAINT)], { gap: 1 });
  const head = (open: boolean): Node =>
    row(s32(cur.weapon), line(cur, false), small(`${i + 1} of ${d.setups.length} ${open ? '▴' : '▾'}`, FAINT), {
      bg: 'card',
      edge: GOLD,
      pad: 5,
      inset: 6,
      gap: 6,
      on: { a: 'flip', key },
      tip: open ? 'Close the list' : 'Pick another setup',
    });
  const options = d.setups.map((s) =>
    row(s32(s.weapon), line(s, s.key === d.current), undefined, {
      bg: s.key === d.current ? 'raised' : 'card',
      ...(s.key === d.current ? { edge: GOLD } : {}),
      pad: 4,
      inset: 5,
      gap: 6,
      on: pickSetup(d, s.key),
    }),
  );
  return { t: 'toggle', key, off: head(false), lit: col([head(true), card(options, { inset: 3, gap: 2, edge: GOLD })], { gap: 4 }) };
}
/** The dry tone for a lower number (the luck chips' gold ink). */
const DRY = '#ffb54d';
/** The comparison's number columns: You, Guide, the change. */
const NUM_W = [30, 30, 42];

/** "▲ 12%" green (worn gear ahead), "▼ 26%" in the dry tone (behind), "even" within half a percent. */
function deltaMark(you: number, guide: number): Node {
  const w = NUM_W[2];
  if (!(guide > 0)) return text('', 'muted', { w });
  const pct = Math.round(((you - guide) / guide) * 100);
  if (!pct) return small('even', FAINT, { w, align: 'r' });
  const up = pct > 0;
  const ink = up ? GREEN : DRY;
  // Ten times over is still news, but "1250%" doesn't fit the column.
  return small(Math.abs(pct) >= 1000 ? `${Math.round(up ? you / guide : guide / Math.max(you, 0.01))}×` : `${Math.abs(pct)}%`, ink, { w, align: 'r', icon: icon({ glyph: up ? 'up' : 'down', w: 7, h: 7, color: ink, alt: up ? '▲' : '▼' }), tip: `${up ? 'Ahead of' : 'Behind'} the guide by ${Math.abs(pct)}%` });
}

/** One line of the comparison: a name at the left, then You | Guide | change in fixed columns. */
const gearLine = (name: Node, you: Node, guide: Node, change: Node): Node => row(name, undefined, row(you, guide, change, { gap: 4 }), { gap: 4 });

/**
 * "Your gear now vs this setup": per target, the DPS of what the character wears now (at their own
 * levels when known) beside the setup's, the change, and the one slot from the setup that helps most. ↻ loads the guide again.
 */
function gearNowCard(d: GuidePanelData): Node | null {
  const g = d.gearNow;
  if (!g?.rows.length) return null;
  const again: Action = { a: 'load', v: 'guide', args: withRegion({ id: String(d.id), tier: d.tier ?? '', setup: d.current ?? '' }, d.region) };
  const num = (s: string, i: number, color: Color = 'white') => small(s, color, { w: NUM_W[i], align: 'r' });
  const lines: Node[] = [
    gearLine(text('', 'muted'), num('You', 0, FAINT), num('Guide', 1, FAINT), text('↻', GOLD, { w: NUM_W[2], align: 'r', on: again, tip: 'Load it again with the gear you wear now' })),
    ...g.rows.map((r) => gearLine(text(r.name, SOFT), num(r.you.toFixed(1), 0), num(r.guide.toFixed(1), 1, PROGRESS), deltaMark(r.you, r.guide))),
  ];
  if (g.ttk) lines.push(gearLine(small('Per kill', FAINT), num(g.ttk.you, 0, SOFT), num(g.ttk.guide, 1, SOFT), text('', 'muted', { w: NUM_W[2] })));
  return section([
    title('Your gear now vs this setup'),
    col(lines, { gap: 3 }),
    g.gap
      ? text('', 'white', { font: 'small', runs: [{ s: 'Biggest gap: ', color: FAINT }, { s: `${g.gap.slot} (${g.gap.guide} vs ${g.gap.worn ? `your ${g.gap.worn}` : 'an empty slot'})` }], wrap: W_CARD })
      : null,
    small(g.ownLevels ? "Your levels; the guide's prayers and boosts." : "Assumes the guide's prayers, boosts and levels.", FAINT, { wrap: W_CARD }),
  ]);
}

const s32 = (id: number | null): Node => (id ? icon({ item: id, w: 28, h: 25 }) : icon({ glyph: 'star', w: 12, h: 12, color: GOLD }));

/** The equipment screen: three 34px wells a row, as the game lays them out (quiver above ammo). */
function equipmentGrid(d: GuidePanelData): Node {
  const cells: Node[] = [];
  for (const r of SLOT_ROWS)
    for (const slot of r) {
      const s = slot ? d.slots.find((x) => x.slot === slot) : undefined;
      if (!slot || (slot === 'quiver' && !s?.id)) {
        cells.push(text('', 'muted', { w: SLOT_PX }));
        continue;
      }
      if (!s?.id) {
        cells.push(text('', 'muted', { chip: WELL.own, w: SLOT_PX, align: 'c', icon: { t: 'icon', sprite: SLOT_SPRITE[slot] ?? 170 }, tip: `${SLOT_LABEL[slot]}: empty` }));
        continue;
      }
      const state = s.missing ? 'missing' : s.fallback ? 'fallback' : 'own';
      const act: Action = openGuide(d.id, d.region, { tier: d.tier ?? '', setup: d.current ?? '', alt: slot });
      cells.push(
        text('', 'white', {
          chip: WELL[state],
          w: SLOT_PX,
          align: 'c',
          icon: { t: 'icon', item: s.id, w: 30, h: 27 },
          on: act,
          tip: `${SLOT_LABEL[slot]}${s.fallback ? ` · ${s.fallback}` : s.missing ? ' · not owned' : ''} · click for alternatives`,
        }),
      );
    }
  const frame = col([{ t: 'grid', cols: 3, gap: SLOT_GAP, vgap: SLOT_GAP, c: cells }], { bg: 'raised', edge: '#6b5c45', inset: FRAME_IN });
  return centred(frame, 3 * SLOT_PX + 2 * SLOT_GAP + 2 * FRAME_IN + 2);
}

function inventoryGrid(d: GuidePanelData): Node {
  // The game's 28 slots, less the empty rows at the bottom (a short supply list stays short).
  const last = d.inventory.slice(0, 28).reduce((m, it, i) => (it ? i : m), -1);
  const cells = Array.from({ length: Math.max(4, Math.ceil((last + 1) / 4) * 4) }, (_, i) => d.inventory[i]).map((it) =>
    it ? icon({ item: it.id, qty: it.q && it.q > 1 ? it.q : undefined, w: 32, h: 28 }) : text('', 'muted', { w: 32 }),
  );
  const frame = col([{ t: 'grid', cols: 4, gap: 3, vgap: 2, c: cells }], { bg: 'raised', edge: '#6b5c45', inset: FRAME_IN });
  return centred(frame, 4 * 32 + 3 * 3 + 2 * FRAME_IN + 2);
}

function setupTab(d: GuidePanelData): Node {
  const parts: Node[] = [];
  const now = gearNowCard(d);
  if (now) parts.push(now);
  const chips = levelChips(d);
  if (chips) parts.push(chips);
  const picker = setupPicker(d);
  if (picker) parts.push(picker);
  const cur = d.setups.find((s) => s.key === d.current);
  if (!cur) {
    parts.push(section([muted('No setup at this level yet. How to has the written guide.', { wrap: W_CARD })]));
    return col(parts, { gap: 8 });
  }
  const anyMissing = d.slots.some((s) => s.missing);
  const anyFallback = d.slots.some((s) => s.fallback);
  const card1: (Node | null)[] = [
    row(undefined, title(cur.name), small(d.dps, PROGRESS), { gap: 6 }),
    d.usingFallbacks ? small(`↓ Using a fallback: ${d.usingFallbacks}`, SOFT, { wrap: W_CARD }) : null,
    equipmentGrid(d),
    anyMissing || anyFallback
      ? (() => {
          const marks = [anyMissing ? chip('Not owned', 'coral') : null, anyFallback ? chip('Fallback in use', 'gold') : null].filter((x): x is Node => !!x);
          return row(marks[0], marks[1] ? row(marks[1], undefined, undefined) : undefined, undefined, { gap: 4 });
        })()
      : null,
    small('Click a slot for alternatives.', FAINT),
  ];
  if (d.inventory.some(Boolean)) card1.push(text('Inventory', SOFT, { font: 'bold' }), inventoryGrid(d));
  if (d.pouch.length) {
    card1.push(
      col([
        small(d.pouch.length > 3 ? 'Divine rune pouch' : 'Rune pouch', FAINT),
        row(col([{ t: 'grid', cols: d.pouch.length, gap: 3, c: d.pouch.map((r) => icon({ item: r.id, qty: r.q, w: 30, h: 27 })) }], { bg: 'raised', edge: '#6b5c45', inset: 4 }), undefined, undefined),
      ], { gap: 3 }),
    );
  }
  card1.push(
    row(
      icon({ sprite: SPELLBOOK_SPRITE[d.spellbookId] ?? 780, w: 20, h: 20 }),
      col([small(`${d.spellbook} spellbook`, SOFT), d.spells.length ? small(d.spells.join(' · '), FAINT, { wrap: W_BESIDE + 10 }) : null], { gap: 1 }),
      undefined,
      { gap: 6 },
    ),
  );
  parts.push(section(card1, { gap: 8 }));
  parts.push(copyButton('Copy bank tag', d, 'banktag'), copyButton('Copy Inventory Setup', d, 'setup'));
  if (d.hasMarkers) parts.push(copyButton(`Copy tile markers · ${d.hasMarkers} tiles`, d, 'markers'), small('Paste in RuneLite: right-click the world map orb → Import Ground Markers', FAINT, { wrap: 205, align: 'c' }));
  if (d.missing) {
    parts.push(
      section([
        d.missing.length
          ? row(undefined, title('Missing from your bank'), text(String(d.missing.length), PROGRESS, { font: 'bold' }), { gap: 6 })
          : title('You own every item in this setup', GREEN),
        ...d.missing.map((m) => row(icon({ item: m.id, w: 28, h: 25 }), text(m.name, 'white', { wrap: 105 }), small(m.price, m.price === 'untradeable' ? FAINT : PROGRESS), { gap: 6 })),
        small(`Checked bank, inventory and worn gear${d.checkedAt ? ` · ${d.checkedAt}` : ''}. Kits and variants you own count.`, FAINT, { wrap: W_CARD }),
      ]),
    );
  } else if (d.phase2) {
    parts.push(section([small('Open your bank once so Anvil can check what you are missing.', FAINT, { wrap: W_CARD })]));
  }
  if (d.community.length) {
    parts.push(
      col([
        row(text('COMMUNITY PICKS', FAINT, { font: 'bold' }), undefined, undefined, { pad: 2 }),
        ...d.community.map((c) =>
          row(s32(c.weapon), col([text(c.name, 'white'), small(`${c.used} used`, PROGRESS)], { gap: 1 }), icon({ glyph: 'chevron-right', w: 9, h: 9, color: FAINT }), {
            bg: 'raised',
            pad: 5,
            inset: 6,
            gap: 6,
            on: pickSetup(d, c.key),
            tip: 'Show this setup',
          }),
        ),
      ], { gap: 4 }),
    );
  }
  return col(parts, { gap: 8 });
}

/**
 * A titled card that folds: "▾ Title ....... 3/4" (open) or "› Title" (shut), the house accordion.
 * Open by default; the plugin remembers a fold per guide, level and title.
 */
function foldCard(key: string, name: string, right: Node | undefined, body: (Node | null | false | undefined)[]): Node {
  const head = (open: boolean): Node =>
    row(text(open ? '▾' : '›', GOLD, { w: 10 }), title(name), right, { gap: 6, on: { a: 'flip', key }, tip: open ? 'Fold' : 'Open' });
  return { t: 'toggle', key, off: section([head(true), ...body], { gap: 8 }), lit: section([head(false)]) };
}

/** A numbered step in its own box, the number over the words (they wrap under it, never beside). */
const stepBox = (n: number, s: string): Node =>
  col([small(`Step ${n}`, GOLD, { font: 'bold' }), text(s, 'white', { wrap: W_STEP })], { bg: 'panel', inset: 6, gap: 2 });
const bullet = (s: string): Node => text(`•  ${s}`, 'white', { wrap: W_CARD });

/** One written section: its requirement line, then its words, lists, steps and links. */
function bodyCard(d: GuidePanelData, s: BodySection, i: number): Node {
  const name = s.title ?? (i === 0 ? 'About this guide' : 'More');
  const steps = s.blocks.filter((b) => b.k === 'step').length;
  const lines: Node[] = [];
  // The -# line under a heading says what the section asks of you ("Base 75+ combat, 70+ Prayer").
  if (s.note) lines.push(chip(s.note, 'gold', { wrap: W_CARD - 12 }));
  let step = 0;
  for (const b of s.blocks.slice(0, 14)) {
    if (b.k === 'p') lines.push(text(b.s, SOFT, { wrap: W_CARD }));
    else if (b.k === 'li') lines.push(bullet(b.s));
    else if (b.k === 'step') lines.push(stepBox(++step, b.s));
    else if (b.k === 'img') lines.push(small(`Picture${b.alt ? `: ${b.alt}` : ''} · on the site`, GOLD, { wrap: W_CARD, icon: { t: 'icon', glyph: 'external', w: 10, h: 10, color: GOLD }, iconAfter: true, on: { a: 'site', path: `/guides/${d.slug}` } }));
    else if (b.k === 'video') lines.push(small('Watch the video on the site', GOLD, { icon: { t: 'icon', glyph: 'external', w: 10, h: 10, color: GOLD }, iconAfter: true, on: { a: 'site', path: `/guides/${d.slug}` }, tip: 'The guide page plays it' }));
  }
  if (s.blocks.length > 14) lines.push(small(`${s.blocks.length - 14} more on the site`, GOLD, { on: { a: 'site', path: `/guides/${d.slug}` } }));
  return foldCard(`guide-sec:${d.id}:${d.tier}:${name}`, name, steps ? small(`${steps} steps`, FAINT) : undefined, lines);
}

/** Before you go: each requirement with its picture and a tick or a cross at the right. */
function beforeYouGo(d: GuidePanelData): Node | null {
  if (!d.checklist.length) return null;
  const done = d.checklist.filter((c) => c.ok === true).length;
  const known = d.checklist.some((c) => c.ok !== null);
  const rows = d.checklist.map((c) => {
    const pic = c.pic?.item
      ? icon({ item: c.pic.item, w: 26, h: 23 })
      : c.pic?.skill
        ? icon({ skill: c.pic.skill })
        : icon({ sprite: QUEST_SPRITE, w: 20, h: 20, or: icon({ glyph: 'star', w: 12, h: 12, color: GOLD }) });
    const mark = c.ok === true ? icon({ glyph: 'check', w: 12, h: 12, color: GREEN }) : c.ok === false ? icon({ glyph: 'close', w: 11, h: 11, color: CORAL }) : undefined;
    return row(text('', 'muted', { w: 26, align: 'c', icon: pic as Extract<Node, { t: 'icon' }> }), text(c.text, c.ok === false ? 'white' : SOFT, { wrap: 125 }), mark, { gap: 6 });
  });
  return foldCard(`guide-sec:${d.id}:${d.tier}:before`, 'Before you go', known ? small(`${done}/${d.checklist.length}`, PROGRESS) : undefined, [
    ...rows,
    small(known ? 'From your quests, bank and stats' : 'Sign in with the plugin to tick these off', FAINT, { wrap: W_CARD }),
  ]);
}

/** Everything written: requirements, the setup's steps, the body's sections, tips and mistakes. */
function howTo(d: GuidePanelData): Node[] {
  const parts: Node[] = [];
  const b = beforeYouGo(d);
  if (b) parts.push(b);
  if (d.setupSteps.length) {
    parts.push(foldCard(`guide-sec:${d.id}:${d.tier}:steps`, 'How to do it', small(`${d.setupSteps.length} steps`, FAINT), d.setupSteps.map((s, i) => stepBox(i + 1, s))));
  }
  d.body.forEach((s, i) => parts.push(bodyCard(d, s, i)));
  if (d.tips.length) {
    parts.push(
      foldCard(`guide-sec:${d.id}:${d.tier}:tips`, 'Tips', small('community', FAINT), d.tips.map((t) => (t.useful ? text('', 'white', { runs: [{ s: `•  ${t.text}  ` }, { s: `${t.useful} players`, color: PROGRESS }], wrap: W_CARD }) : bullet(t.text)))),
    );
  }
  if (d.mistakes.length) parts.push(foldCard(`guide-sec:${d.id}:${d.tier}:mistakes`, 'Common mistakes', undefined, d.mistakes.map((m) => bullet(m))));
  return parts;
}

function howToTab(d: GuidePanelData): Node {
  const cur = d.setups.find((s) => s.key === d.current);
  const tierLabel = d.tiers.find((t) => t.key === d.tier)?.label;
  const parts: Node[] = [];
  if (cur) parts.push(small(`For ${cur.name}${tierLabel ? ` · ${tierLabel}` : ''}`, FAINT, { wrap: 205 }));
  parts.push(...howTo(d));
  if (parts.length <= 1) parts.push(section([muted('Nothing written for this level yet.', { wrap: W_CARD })]));
  return col(parts, { gap: 8 });
}

function upgradesTab(d: GuidePanelData): Node {
  if (!d.upgrades.length) return section([muted('Nothing in this guide beats what you have for this style.', { wrap: W_CARD })]);
  return section([
    title('Next upgrades'),
    ...d.upgrades.map((u) => row(icon({ item: u.id, w: 28, h: 25 }), text(u.name, 'white', { wrap: 100 }), row(small(u.gain, PROGRESS), undefined, small(u.price, FAINT, { w: 34, align: 'r' }), { gap: 4 }), { gap: 6 })),
    small('Best DPS gain per gp first, for this setup.', FAINT, { wrap: W_CARD }),
  ]);
}

/** A progression route's chapters: each step ticked from what Anvil knows, with why it matters. */
function routeParts(d: GuidePanelData, r: PanelRoute): Node[] {
  const parts: Node[] = [];
  if (r.signedIn) {
    parts.push(
      section([
        small(r.following ? 'Following' : 'Your progress', FAINT),
        row(undefined, { t: 'bar', pct: r.total ? Math.floor((r.done * 100) / r.total) : 0, color: 'brand', h: 6, bg: 'panel' }, small(`${r.done}/${r.total}`, PROGRESS, { font: 'bold' }), { gap: 6 }),
        r.following ? null : small('Follow it on the site and its next steps show on your You tab.', FAINT, { wrap: W_CARD }),
      ]),
    );
  }
  r.chapters.forEach((c, ci) => {
    const got = c.steps.filter((s) => s.done).length;
    parts.push(
      foldCard(
        `guide-route:${d.id}:${ci}`,
        c.name,
        r.signedIn ? small(`${got}/${c.steps.filter((s) => !s.skipped).length}`, got === c.steps.length ? GREEN : PROGRESS) : small(`${c.steps.length} steps`, FAINT),
        c.steps.slice(0, 20).map((s) =>
          row(s.item ? icon({ item: s.item, w: 28, h: 25 }) : icon({ glyph: 'star', w: 12, h: 12, color: GOLD }), col([text(s.title, s.done ? GREEN : s.skipped ? FAINT : 'white', { wrap: 120 }), s.why ? small(s.why, FAINT, { wrap: 120 }) : null], { gap: 1 }), s.done ? icon({ glyph: 'check', w: 12, h: 12, color: GREEN }) : undefined, { gap: 6 }),
        ),
      ),
    );
  });
  return parts;
}

/** A slot's alternatives, a page of their own over the guide (closed until a slot is clicked). */
export function alternativesUi(d: GuidePanelData, a: PanelAlternatives): Node {
  const back = pickSetup(d, d.current ?? '');
  const skipAct = (item: number, reason: string): Action => ({ a: 'post', act: 'guide-skip', args: withRegion({ id: String(d.id), tier: d.tier ?? '', setup: d.current ?? '', slot: a.slot, item: String(item), reason }, d.region) });
  const pick = a.rows[0];
  const cur = a.rows.find((r) => r.inUse) ?? pick;
  const parts: Node[] = [
    row(
      cur ? text('', 'white', { chip: WELL.own, w: SLOT_PX, align: 'c', icon: { t: 'icon', item: cur.id, w: 30, h: 27 } }) : undefined,
      col([title('Alternatives'), small(`${SLOT_LABEL[a.slot] ?? a.slot} slot · best first`, FAINT)], { gap: 1 }),
      text('', 'muted', { icon: { t: 'icon', glyph: 'close', w: 11, h: 11, color: FAINT }, on: back, tip: 'Close' }),
      { gap: 8 },
    ),
  ];
  for (const r of a.rows) {
    const menu = a.signedIn && !r.owned && !r.skipped ? { menu: [{ label: "Skip: can't afford", on: skipAct(r.id, 'cant_afford') }, { label: "Skip: don't want", on: skipAct(r.id, 'dont_want') }] } : {};
    parts.push(
      row(
        icon({ item: r.id, w: 30, h: 27, dim: r.skipped }),
        col([
          text(r.name, r.skipped ? FAINT : 'white', { wrap: 110 }),
          text('', 'muted', { font: 'small', runs: [{ s: r.price, color: r.price === 'untradeable' ? FAINT : PROGRESS }, { s: ` · ${r.note}${r.skipped ? ' · skipped' : ''}`, color: FAINT }], wrap: 110 }),
          r.owned ? small('owned ✓', GREEN, { font: 'bold' }) : null,
        ], { gap: 1 }),
        r.inUse ? chip('In use', 'gold') : undefined,
        { bg: r.inUse ? 'raised' : 'card', ...(r.inUse ? { edge: GOLD } : {}), pad: 5, inset: 6, gap: 6, ...menu },
      ),
    );
  }
  if (a.signedIn && pick && !pick.owned) {
    parts.push(
      col([
        title(`Skip ${pick.name}`, 'white'),
        { t: 'grid', cols: 2, gap: 4, c: [boxChip("Can't afford", false, skipAct(pick.id, 'cant_afford')), boxChip("Don't want", false, skipAct(pick.id, 'dont_want'))] },
        small('Skipped items fall back to your next owned pick in every guide. Right-click any row to skip it.', FAINT, { wrap: W_CARD }),
      ], { gap: 5 }),
    );
  }
  if (a.signedIn) {
    parts.push(
      col([
        row(undefined, title('Budget cap'), small(a.budget ? `${a.budget}m` : 'none', a.budget ? PROGRESS : FAINT), { gap: 6 }),
        row(undefined, { t: 'input', name: 'cap', kind: 'number', value: a.budget, min: 0, max: 2_147, step: 5, label: 'Million gp' }, button('Set', { a: 'post', act: 'guide-budget', args: withRegion({ id: String(d.id), tier: d.tier ?? '', setup: d.current ?? '', slot: a.slot }, d.region) }), { gap: 6 }),
        small(a.budget ? `Items over ${a.budget}m are suggested only as upgrades.` : 'Set a cap and pricier items are suggested only as upgrades.', FAINT, { wrap: W_CARD }),
      ], { gap: 5 }),
    );
    if (a.skipped.length) {
      parts.push(row(undefined, small(`Skipped items (${a.skipped.length})`, FAINT), undefined));
      for (const s of a.skipped) {
        parts.push(row(icon({ item: s.id, w: 26, h: 23 }), text(s.name, 'white', { wrap: 115 }), small('undo', GOLD), { gap: 6, on: { a: 'post', act: 'guide-unskip', args: withRegion({ id: String(d.id), tier: d.tier ?? '', setup: d.current ?? '', slot: a.slot, item: String(s.id) }, d.region) }, tip: 'Use it again' }));
      }
    }
  } else {
    parts.push(small('Sign in to skip items and set a budget.', FAINT, { wrap: W_CARD }));
  }
  return section(parts, { edge: GOLD, gap: 8 });
}

const siteLink = (d: GuidePanelData, label: string): Node =>
  row(undefined, small(label, GOLD, { align: 'c' }), undefined, { pad: 4, on: { a: 'site', path: `/guides/${d.slug}` }, tip: 'The whole guide on the Anvil website' });

/**
 * A guide in the panel. Always a back header. With setups: Setup | How to | Upgrades (level chips
 * and the setup picker on Setup, as the mockup has them). Without: the level chips, then the written
 * guide (or the route's chapters) as cards. A slot's alternatives are a page of their own.
 */
export function guidePanelUi(d: GuidePanelData): Node {
  if (d.alternatives) return col([guideHead(d, pickSetup(d, d.current ?? '')), alternativesUi(d, d.alternatives)], { gap: 8 });
  const parts: Node[] = [guideHead(d)];
  if (d.setups.length) {
    parts.push({ t: 'tabs', key: `guide-sections-${d.id}`, tabs: [{ label: 'Setup', c: setupTab(d) }, { label: 'How to', c: howToTab(d) }, { label: 'Upgrades', c: upgradesTab(d) }] });
    parts.push(siteLink(d, 'Open on the site ↗'));
    return col(parts, { gap: 8 });
  }
  const chips = levelChips(d);
  if (chips) parts.push(chips);
  if (d.route) parts.push(...routeParts(d, d.route));
  const written = howTo(d);
  parts.push(...written);
  if (!written.length && !d.route?.chapters.length) {
    parts.push(section([text('This guide is mostly pictures and long text.', 'white', { wrap: W_CARD }), small('It reads best on the site.', FAINT, { wrap: W_CARD })]));
  }
  parts.push(siteLink(d, 'Open the full guide on the site ↗'));
  return col(parts, { gap: 8 });
}

/** "That guide is not available": still a way back. */
export function guideGoneUi(region?: string): Node {
  return col([
    backHeader('Guides', 'This guide is not available', false, guideBack({ region }), '/guides'),
    section([muted('It may have been unpublished or moved. The library has the rest.', { wrap: W_CARD })]),
  ], { gap: 8 });
}

// ── You tab: the guides card ───────────────────────────────────────────────────────────────────

export interface NextUpData {
  route: { id: number; slug: string; title: string } | null;
  done: number;
  total: number;
  lastDone: { title: string; icon: number | null; source: string } | null;
  next: { title: string; icon: number | null; line: string; reqs: { text: string; met: boolean | null }[] }[];
  recent: GuideRowData[];
  followed: { id: number; title: string }[];
}

const toGuides: Action = { a: 'tab', tab: 'lookup', args: { mode: 'guides' } };

/** A recent guide in the You tab's card: picture, name, its level line. */
const recentRow = (r: GuideRowData): Node =>
  row(picWell(r.pic, 28), text(r.title, 'white'), r.meta ? small(r.meta, FAINT) : icon({ glyph: 'chevron-right', w: 9, h: 9, color: FAINT }), { bg: 'raised', pad: 4, inset: 6, gap: 6, on: openGuide(r.id), tip: `Open ${r.title}` });

/**
 * The You tab's guides card, a section like Goals: the route followed ("Next up") when there is one,
 * else the recent guides with a nudge and a way to Lookup → Guides. Null when there is nothing to show.
 */
export function nextUpUi(d: NextUpData): Node | null {
  const parts: Node[] = [];
  if (d.route) {
    parts.push(row(undefined, title('Next up'), small('See the route ↗', GOLD, { on: { a: 'site', path: `/guides/${d.route.slug}` }, tip: 'The whole route on the Anvil website' }), { gap: 6 }));
    parts.push(
      col([
        small('Following', FAINT),
        text(d.route.title, 'white', { font: 'bold', wrap: W_CARD - 16 }),
        row(undefined, { t: 'bar', pct: d.total ? Math.floor((d.done * 100) / d.total) : 0, color: 'brand', h: 6, bg: 'card' }, small(`${d.done}/${d.total}`, PROGRESS, { font: 'bold' }), { gap: 6 }),
      ], { bg: 'panel', inset: 8, gap: 4 }),
    );
    if (d.lastDone) {
      parts.push(row(d.lastDone.icon ? icon({ item: d.lastDone.icon, w: 28, h: 25 }) : undefined, col([text(d.lastDone.title, SOFT, { wrap: 120 }), small(`Done · ${d.lastDone.source}`, GREEN)], { gap: 1 }), icon({ glyph: 'check', w: 12, h: 12, color: GREEN }), { gap: 6 }));
    }
    d.next.forEach((n, i) =>
      parts.push(
        row(n.icon ? icon({ item: n.icon, w: 28, h: 25 }) : icon({ glyph: 'star', w: 12, h: 12, color: GOLD }), col([text(n.title, 'white', { font: 'bold', wrap: 125 }), n.line ? small(n.line, FAINT, { wrap: 125 }) : null, ...(n.reqs.length ? [small(n.reqs.map((r) => r.text).join(' · '), n.reqs.every((r) => r.met !== false) ? GREEN : PROGRESS, { wrap: 125 })] : [])], { gap: 2 }), undefined, {
          bg: 'raised',
          pad: 5,
          inset: 6,
          gap: 6,
          ...(i === 0 ? { edge: GOLD } : {}),
        }),
      ),
    );
    if (d.followed.length > 1) {
      parts.push(row(small('Switch route', FAINT), { t: 'input', name: 'route', kind: 'select', options: d.followed.map((f) => ({ v: String(f.id), label: f.title })), value: String(d.route.id), on: { a: 'post', act: 'guide-route', into: 'guide-next' } }, undefined, { gap: 6 }));
    }
  } else if (d.recent.length) {
    parts.push(row(undefined, title('Guides'), small('Lookup › Guides', GOLD, { on: toGuides, tip: 'Search every guide' }), { gap: 6 }));
    parts.push(...d.recent.map(recentRow));
    parts.push(small('Follow a progression route on the site and its next steps show here.', FAINT, { wrap: W_CARD }));
  } else return null;
  return { t: 'slot', id: 'guide-next', c: section(parts) };
}
