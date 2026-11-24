// The plugin's Guides views, built from the node types the plugin already draws (lib/pluginUi/
// nodes): the Lookup tab's Guides search, a guide (Setup | How to | Upgrades), a slot's
// Alternatives, and the You tab's "Next up" route card. PURE: the data comes in prepared
// (pluginUi/views guideView / guidesView / guideNextView). Text only — no HTML, no timers, no
// live fight cues (RuneLite's rules).
//
// PHASE 2 HOOKS (the plugin implements these; the site already sends them only to a plugin at or
// past GUIDES_PANEL_MIN_PLUGIN, load.ts):
//   COPY      { a: 'copy', path } — new action: GET `path` (/api/plugin/guide-export?…) and put its
//             `text` on the clipboard. Older plugins get a 'site' link to copy on the site instead.
//   SWITCH    { a: 'tab', tab: 'lookup', args: { mode: 'players' } } — the Lookup tab's Players |
//             Guides switch (the Guides half is view 'guides'). Older plugins get no switch.
//   REGION    the plugin sends args.region (the map region id it stands in) when it loads 'guides',
//             so the view can say "You're at Vorkath · open guide?" (GUIDE_REGIONS below).
//   QUILL     icon glyphs 'quill-bronze' | 'quill-silver' | 'quill-gold' | 'quill-star' on the byline;
//             older plugins get a text rank instead.
//   ITEMS     POST /api/plugin/items (bank / inventory / equipment / lootingBag) — once the plugin
//             sends it, "Missing", "Your version" and the Before-you-go supply ticks fill themselves.

import { button, card, col, gap, header, icon, muted, row, text, type Action, type GuideQuillGlyph, type Node } from './nodes';

export interface GuideRowData {
  id: number;
  title: string;
  category: string;
  icon: number | null;
  meta: string;
  by: string;
}

export interface GuidesSearchData {
  rows: GuideRowData[];
  recent: GuideRowData[];
  sections: { label: string; rows: GuideRowData[] }[];
  filters: { level: string; account: string; build: string };
  here: { id: number; title: string; where: string; icon: number | null } | null;
  phase2: boolean;
  /** The map region the plugin said it stands in, carried on the filter post so "You're at" stays. */
  region?: string;
}

const LEVELS = [
  { v: '', label: 'Level: yours' },
  { v: 'beginner', label: 'Beginner' },
  { v: 'intermediate', label: 'Intermediate' },
  { v: 'advanced', label: 'Advanced' },
];
const ACCOUNTS = [
  { v: '', label: 'Any account' },
  { v: 'main', label: 'Main' },
  { v: 'ironman', label: 'Ironman' },
  { v: 'hcim', label: 'HCIM' },
  { v: 'uim', label: 'UIM' },
  { v: 'gim', label: 'GIM' },
];
const BUILDS = [
  { v: 'any', label: 'Any build' },
  { v: 'pure', label: 'Pure 1 def' },
  { v: 'zerker', label: 'Zerker' },
  { v: 'med', label: 'Med' },
  { v: 'main', label: 'Main build' },
];

/** Region id → library guide slug, for "You're at …" (phase 2: the plugin sends `region`). */
export const GUIDE_REGIONS: Record<number, string> = {
  9023: 'vorkath-guide',
};

const openGuide = (id: number, extra: Record<string, string> = {}): Action => ({ a: 'load', v: 'guide', args: { id: String(id), ...extra } });

function guideRow(r: GuideRowData): Node {
  return row(
    r.icon ? icon({ item: r.icon, w: 30, h: 26 }) : icon({ glyph: 'chevron-right', w: 10, h: 10, color: 'muted' }),
    col([text(r.title, 'white'), muted(`${r.meta}${r.by ? ` · ${r.by}` : ''}`, { font: 'small' })], { gap: 1 }),
    undefined,
    { bg: 'raised', gap: 7, on: openGuide(r.id), k: `${r.title}|${r.category}` },
  );
}

/** The Guides search (the Lookup tab's Guides half): filters, "You're at", recent, by category. */
export function guidesSearchUi(d: GuidesSearchData): Node {
  const filterAct: Action = { a: 'post', act: 'guides-filter', ...(d.region ? { args: { region: d.region } } : {}) };
  const parts: Node[] = [];
  if (d.phase2) {
    parts.push({ t: 'tabs', key: 'lookup-mode', tabs: [{ label: 'Players', on: { a: 'tab', tab: 'lookup', args: { mode: 'players' } } }, { label: 'Guides', on: { a: 'load', v: 'guides' }, sel: true }] });
  }
  if (d.here) {
    parts.push(
      row(d.here.icon ? icon({ item: d.here.icon, w: 32, h: 28 }) : undefined, col([text(`You're at ${d.here.title}`, 'white', { font: 'bold' }), muted(`${d.here.where} · open guide?`, { font: 'small' })], { gap: 1 }), text('Open ›', 'brand', { font: 'small' }), {
        bg: 'raised',
        edge: 'brand',
        gap: 8,
        on: openGuide(d.here.id),
      }),
    );
  }
  parts.push(
    { t: 'grid', cols: 3, gap: 4, c: [
      { t: 'input', name: 'level', kind: 'select', options: LEVELS, value: d.filters.level, on: filterAct },
      { t: 'input', name: 'account', kind: 'select', options: ACCOUNTS, value: d.filters.account, on: filterAct },
      { t: 'input', name: 'build', kind: 'select', options: BUILDS, value: d.filters.build, on: filterAct },
    ] },
  );
  const body: Node[] = [];
  if (d.recent.length) body.push(header('RECENT'), ...d.recent.map(guideRow), gap(4));
  for (const s of d.sections) body.push(header(s.label.toUpperCase(), String(s.rows.length)), ...s.rows.map(guideRow), gap(4));
  parts.push({ t: 'filter', hint: 'Search guides', box: true, none: 'No guide matches.', max: 40, h: 520, c: [col(body, { gap: 3 })] });
  parts.push(row(undefined, text('Browse all on the site ↗', 'brand', { font: 'small', align: 'c' }), undefined, { on: { a: 'site', path: '/guides' } }));
  return col(parts, { gap: 8 });
}

// ── A guide ────────────────────────────────────────────────────────────────────────────────

export interface PanelSetup {
  key: string;
  name: string;
  sub: string;
  weapon: number | null;
  blocked: string | null;
}
export interface PanelSlot {
  slot: string;
  id: number | null;
  /** "↓" when the reader's own version uses a fallback here. */
  fallback: string | null;
  missing: boolean;
}
export interface GuidePanelData {
  id: number;
  slug: string;
  title: string;
  tier: string;
  tiers: { key: string; label: string }[];
  byline: string;
  rankGlyph: string | null;
  setups: PanelSetup[];
  current: string;
  dps: string;
  usingFallbacks: string | null;
  slots: PanelSlot[];
  inventory: ({ id: number; q?: number } | null)[];
  pouch: { id: number; q: number }[];
  spellbook: string;
  spells: string[];
  hasMarkers: number;
  missing: { id: number; name: string; price: string }[] | null;
  checkedAt: string | null;
  checklist: { text: string; ok: boolean | null }[];
  steps: string[];
  tips: { text: string; useful: number }[];
  mistakes: string[];
  upgrades: { id: number; name: string; gain: string; price: string }[];
  community: { key: string; name: string; used: number; weapon: number | null }[];
  phase2: boolean;
  alternatives: PanelAlternatives | null;
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

/** A copy button: the phase-2 clipboard action, or (older plugins) a link to copy on the site. */
function copyButton(label: string, d: GuidePanelData, kind: 'banktag' | 'setup' | 'markers'): Node {
  const on: Action = d.phase2
    ? { a: 'copy', path: `/api/plugin/guide-export?guide=${d.id}&setup=${encodeURIComponent(d.current)}&kind=${kind}&mine=1` }
    : { a: 'site', path: `/guides/${d.slug}` };
  return button(d.phase2 ? label : `${label} (on the site)`, on, d.phase2 ? undefined : 'Copying straight from the panel comes in the next plugin update');
}

function equipmentGrid(d: GuidePanelData): Node {
  const cells: Node[] = [];
  for (const r of SLOT_ROWS)
    for (const slot of r) {
      const s = slot ? d.slots.find((x) => x.slot === slot) : undefined;
      if (!slot || (slot === 'quiver' && !s?.id)) {
        cells.push(gap(0));
        continue;
      }
      const act: Action = { a: 'post', act: 'guide-alt', args: { id: String(d.id), tier: d.tier, setup: d.current, slot } };
      cells.push(
        s?.id
          ? icon({ item: s.id, w: 32, h: 30, dim: s.missing, on: act, tip: `${SLOT_LABEL[slot]}${s.fallback ? ` · ${s.fallback}` : s.missing ? ' · not owned' : ''} — click for alternatives` })
          : icon({ alt: '·', w: 32, h: 30, color: 'muted', tip: `${SLOT_LABEL[slot]}: empty` }),
      );
    }
  return { t: 'grid', cols: 3, gap: 8, vgap: 6, c: cells };
}

function setupTab(d: GuidePanelData): Node {
  const parts: Node[] = [
    row(text(d.setups.find((s) => s.key === d.current)?.name ?? '', 'white', { font: 'bold' }), undefined, text(d.dps, 'progress', { font: 'small' })),
  ];
  if (d.usingFallbacks) parts.push(muted(`↓ ${d.usingFallbacks}`, { font: 'small', wrap: true }));
  parts.push(card([equipmentGrid(d)], { bg: 'raised' }));
  parts.push(muted('Inventory', { font: 'small' }));
  parts.push({ t: 'grid', cols: 4, gap: 2, vgap: 1, c: Array.from({ length: 28 }, (_, i) => d.inventory[i]).map((it) => (it ? icon({ item: it.id, qty: it.q, w: 30, h: 26 }) : gap(0))) });
  if (d.pouch.length) parts.push(row(muted(d.pouch.length > 3 ? 'Divine rune pouch' : 'Rune pouch', { font: 'small' }), { t: 'grid', cols: d.pouch.length, gap: 2, c: d.pouch.map((r) => icon({ item: r.id, qty: r.q, w: 28, h: 26 })) }, undefined, { gap: 6 }));
  parts.push(muted(`Spellbook: ${d.spellbook}${d.spells.length ? ` · ${d.spells.join(', ')}` : ''}`, { font: 'small', wrap: true }));
  parts.push(copyButton('Copy bank tag', d, 'banktag'), copyButton('Copy Inventory Setup', d, 'setup'));
  if (d.hasMarkers) parts.push(copyButton(`Copy tile markers · ${d.hasMarkers} tiles`, d, 'markers'), muted('Paste in RuneLite: right-click the world map orb → Import Ground Markers', { font: 'small', wrap: true }));
  if (d.missing) {
    parts.push(
      card([
        text(d.missing.length ? `Missing from your bank (${d.missing.length})` : 'You own every item in this setup', d.missing.length ? 'white' : 'done', { font: 'bold' }),
        ...d.missing.map((m) => row(icon({ item: m.id, w: 26, h: 24 }), text(m.name), text(m.price, 'muted', { font: 'small' }))),
        muted(`Checked bank, inventory and worn gear${d.checkedAt ? ` · ${d.checkedAt}` : ''}`, { font: 'small', wrap: true }),
      ]),
    );
  } else if (d.phase2) {
    parts.push(muted('Open your bank once so Anvil can check what you are missing.', { font: 'small', wrap: true }));
  }
  if (d.community.length) {
    parts.push(muted('Community picks', { font: 'small' }));
    for (const c of d.community) parts.push(row(c.weapon ? icon({ item: c.weapon, w: 28, h: 24 }) : undefined, col([text(c.name), muted(`${c.used} used`, { font: 'small' })], { gap: 1 }), undefined, { bg: 'raised', gap: 6, on: { a: 'post', act: 'guide-pick', args: { id: String(d.id), tier: d.tier, setup: c.key } } }));
  }
  return col(parts, { gap: 6 });
}

function howToTab(d: GuidePanelData): Node {
  const done = d.checklist.filter((c) => c.ok === true).length;
  const parts: Node[] = [];
  if (d.checklist.length) {
    parts.push({
      t: 'fold',
      open: true,
      chev: true,
      head: row(text('Before you go', 'white', { font: 'bold' }), undefined, text(`${done}/${d.checklist.length}`, 'progress', { font: 'small' })),
      c: col(
        d.checklist.map((c) => text(`${c.ok === true ? '✓' : c.ok === false ? '✗' : '·'} ${c.text}`, c.ok === true ? 'done' : c.ok === false ? 'error' : 'text', { wrap: true })),
        { gap: 3 },
      ),
    });
  }
  if (d.steps.length) {
    parts.push({ t: 'fold', open: true, chev: true, head: row(text('How to do it', 'white', { font: 'bold' }), undefined, muted(`${d.steps.length} steps`, { font: 'small' })), c: col(d.steps.map((s, i) => text(`${i + 1}. ${s}`, 'text', { wrap: true })), { gap: 4 }) });
  }
  if (d.tips.length) parts.push({ t: 'fold', open: true, chev: true, head: text('Tips', 'white', { font: 'bold' }), c: col(d.tips.map((t) => text(`• ${t.text}${t.useful ? ` (${t.useful} players)` : ''}`, 'text', { wrap: true })), { gap: 4 }) });
  if (d.mistakes.length) parts.push({ t: 'fold', open: true, chev: true, head: text('Common mistakes', 'white', { font: 'bold' }), c: col(d.mistakes.map((t) => text(`• ${t}`, 'text', { wrap: true })), { gap: 4 }) });
  parts.push(muted('Text only · no timers or overlays', { font: 'small', align: 'c' }));
  return col(parts, { gap: 6 });
}

function upgradesTab(d: GuidePanelData): Node {
  if (!d.upgrades.length) return muted('Nothing in this guide beats what you have for this style.', { wrap: true });
  return col([text('Next upgrades', 'white', { font: 'bold' }), ...d.upgrades.map((u) => row(icon({ item: u.id, w: 28, h: 24 }), col([text(u.name), text(u.gain, 'done', { font: 'small' })], { gap: 1 }), text(u.price, 'muted', { font: 'small' }), { gap: 6 }))], { gap: 5 });
}

export function alternativesUi(d: GuidePanelData, a: PanelAlternatives): Node {
  const back: Action = { a: 'post', act: 'guide-pick', args: { id: String(d.id), tier: d.tier, setup: d.current } };
  const parts: Node[] = [row(text(`Alternatives · ${SLOT_LABEL[a.slot] ?? a.slot}`, 'white', { font: 'bold' }), undefined, text('×', 'muted'), { on: back })];
  for (const r of a.rows) {
    const skipCant: Action = { a: 'post', act: 'guide-skip', args: { id: String(d.id), tier: d.tier, setup: d.current, slot: a.slot, item: String(r.id), reason: 'cant_afford' } };
    const skipDont: Action = { a: 'post', act: 'guide-skip', args: { id: String(d.id), tier: d.tier, setup: d.current, slot: a.slot, item: String(r.id), reason: 'dont_want' } };
    parts.push(
      row(icon({ item: r.id, w: 30, h: 27 }), col([text(r.name), muted(`${r.price} · ${r.note}${r.skipped ? ' · skipped' : ''}`, { font: 'small' }), ...(r.owned ? [text('owned ✓', 'done', { font: 'small' })] : [])], { gap: 1 }), r.inUse ? text('In use', 'muted', { font: 'small' }) : undefined, {
        bg: r.inUse ? 'raised' : 'card',
        gap: 6,
        ...(a.signedIn && !r.skipped ? { menu: [{ label: "Skip: can't afford", on: skipCant }, { label: "Skip: don't want", on: skipDont }] } : {}),
      }),
    );
  }
  if (a.signedIn) {
    parts.push(muted('Right-click an item to skip it; skipped items fall back to your next owned pick in every guide.', { font: 'small', wrap: true }));
    parts.push(row(muted('Budget cap', { font: 'small' }), { t: 'input', name: 'cap', kind: 'number', value: a.budget, min: 0, max: 2_147, step: 5, label: 'm gp' }, button('Set', { a: 'post', act: 'guide-budget', args: { id: String(d.id), tier: d.tier, setup: d.current, slot: a.slot } }), { gap: 6 }));
    if (a.skipped.length) {
      parts.push(muted(`Skipped items (${a.skipped.length})`, { font: 'small' }));
      for (const s of a.skipped) parts.push(row(icon({ item: s.id, w: 24, h: 22 }), text(s.name, 'text', { font: 'small' }), text('undo', 'brand', { font: 'small' }), { on: { a: 'post', act: 'guide-unskip', args: { id: String(d.id), tier: d.tier, setup: d.current, slot: a.slot, item: String(s.id) } } }));
    }
  } else {
    parts.push(muted('Sign in to skip items and set a budget.', { font: 'small', wrap: true }));
  }
  return card(parts, { edge: 'brand' });
}

/** A guide in the panel: back, byline, level tabs, the setup picker, then Setup | How to | Upgrades. */
export function guidePanelUi(d: GuidePanelData): Node {
  const parts: Node[] = [
    row(icon({ glyph: 'chevron-left', w: 9, h: 9, color: 'brand' }), text(d.title, 'white', { font: 'bold' }), muted(d.tiers.find((t) => t.key === d.tier)?.label ?? '', { font: 'small' }), { on: { a: 'load', v: 'guides' }, gap: 6 }),
  ];
  if (d.byline) parts.push(text(d.byline, 'muted', { font: 'small', ...(d.rankGlyph ? { icon: { t: 'icon', glyph: d.rankGlyph as GuideQuillGlyph, w: 12, h: 12 } } : {}) }));
  parts.push({ t: 'tabs', key: `guide-level-${d.id}`, tabs: d.tiers.map((t) => ({ label: t.label.slice(0, 9), on: openGuide(d.id, { tier: t.key }), ...(t.key === d.tier ? { sel: true } : {}) })) });
  if (d.setups.length) {
    parts.push({
      t: 'input',
      name: 'setup',
      kind: 'select',
      value: d.current,
      options: d.setups.map((s) => ({ v: s.key, label: `${s.name}${s.blocked ? ` (${s.blocked})` : s.sub ? ` · ${s.sub}` : ''}` })),
      on: { a: 'post', act: 'guide-pick', args: { id: String(d.id), tier: d.tier } },
    });
  }
  if (d.alternatives) parts.push(alternativesUi(d, d.alternatives));
  parts.push({ t: 'tabs', key: `guide-sections-${d.id}`, tabs: [{ label: 'Setup', c: setupTab(d) }, { label: 'How to', c: howToTab(d) }, { label: 'Upgrades', c: upgradesTab(d) }] });
  parts.push(row(undefined, text('Open on the site ↗', 'brand', { font: 'small', align: 'c' }), undefined, { on: { a: 'site', path: `/guides/${d.slug}` } }));
  return col(parts, { gap: 8 });
}

// ── Next up (You tab) ────────────────────────────────────────────────────────────────────────

export interface NextUpData {
  route: { id: number; slug: string; title: string } | null;
  done: number;
  total: number;
  lastDone: { title: string; icon: number | null; source: string } | null;
  next: { title: string; icon: number | null; line: string; reqs: { text: string; met: boolean | null }[] }[];
  recent: GuideRowData[];
  followed: { id: number; title: string }[];
}

export function nextUpUi(d: NextUpData): Node {
  const parts: Node[] = [];
  if (d.route) {
    parts.push(
      card([
        muted('Following', { font: 'small' }),
        text(d.route.title, 'white', { font: 'bold' }),
        row(undefined, { t: 'bar', pct: d.total ? Math.floor((d.done * 100) / d.total) : 0, color: 'brand', h: 6 }, text(`${d.done}/${d.total}`, 'progress', { font: 'small' }), { gap: 6 }),
      ]),
    );
    if (d.lastDone) parts.push(row(d.lastDone.icon ? icon({ item: d.lastDone.icon, w: 30, h: 27 }) : undefined, col([text(d.lastDone.title, 'muted'), text(`Done · ${d.lastDone.source}`, 'done', { font: 'small' })], { gap: 1 }), icon({ glyph: 'check', w: 14, h: 14, color: 'done' }), { bg: 'raised', gap: 6 }));
    parts.push(header('NEXT UP'));
    d.next.forEach((n, i) =>
      parts.push(
        row(n.icon ? icon({ item: n.icon, w: 30, h: 27 }) : undefined, col([text(n.title, 'white', { font: 'bold' }), muted(n.line, { font: 'small', wrap: true }), ...(n.reqs.length ? [text(n.reqs.map((r) => r.text).join(' · '), n.reqs.every((r) => r.met !== false) ? 'done' : 'progress', { font: 'small', wrap: true })] : [])], { gap: 2 }), undefined, {
          bg: 'raised',
          gap: 6,
          ...(i === 0 ? { edge: 'brand' as const } : {}),
        }),
      ),
    );
    parts.push(row(undefined, text('See the whole route ↗', 'brand', { font: 'small', align: 'c' }), undefined, { on: { a: 'site', path: `/guides/${d.route.slug}` } }));
  } else {
    parts.push(card([muted('Follow a progression route on the site and its next steps show here.', { wrap: true })]));
  }
  if (d.recent.length) parts.push(header('RECENT GUIDES'), ...d.recent.map(guideRow));
  if (d.followed.length > 1) {
    parts.push(row(muted('Switch route', { font: 'small' }), { t: 'input', name: 'route', kind: 'select', options: d.followed.map((f) => ({ v: String(f.id), label: f.title })), value: String(d.route?.id ?? ''), on: { a: 'post', act: 'guide-route' } }, undefined, { gap: 6 }));
  }
  return { t: 'slot', id: 'guide-next', c: col(parts, { gap: 6 }) };
}
