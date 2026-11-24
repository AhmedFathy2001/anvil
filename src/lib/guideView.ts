// Everything a guide page (and the plugin's guide view, and the export hook) needs about one guide
// for one reader, gathered once on the server: its setups with keys, fit and the reader's own
// version (fallbacks, skips, budget), DPS, prices, item names, community setups and tips, credits.

import { getItemPrices } from '@/lib/itemPrices';
import { getItemMapping } from '@/lib/osrsItems';
import { effectiveGearIndex } from '@/lib/dps/store';
import { bestStyle, type Monster } from '@/lib/dps/engine';
import { setupLoadout, type GearIndex } from '@/lib/dps/summary';
import { firstGearBlock, splitSegments, TIERS, type GearBlock, type GearSetup, type TierKey } from '@/lib/guideTiers';
import { defaultSetup, setupFit, setupKey, viewerTier, type Viewer } from '@/lib/guideSetups';
import { personalSetup, resolveSetup, type Resolved } from '@/lib/gearOwnership';
import { blockItemIds, equivalentsFor, kcKeyOf, type GuideViewer } from '@/lib/guideViewer';
import { communitySetups, guideCredits, libraryIdOf, tipsFor, type CommunitySetup, type GuideCredits, type TipView } from '@/lib/guideCommunity';
import { bankTagString, inventorySetupJson } from '@/lib/runeliteExport';
import { groundMarkersJson } from '@/lib/groundMarkers';
import { parseRouteBlock, type RouteBlock } from '@/lib/guideRoutes';
import type { Guide } from '@/db/schema';

export interface SetupView {
  key: string;
  index: number;
  setup: GearSetup;
  fit: { ok: boolean; reason: string | null };
  /** The reader's own version (null when nothing is known about what they own). */
  resolved: Resolved | null;
  dps: number | null;
  /** Seconds per kill. */
  ttk: number | null;
  /** DPS with the reader's version. */
  myDps: number | null;
  community: boolean;
}

export interface GuideViewData {
  block: GearBlock | null;
  route: RouteBlock | null;
  setups: SetupView[];
  /** The tier the reader opens on, and the default pill per tier. */
  openTier: TierKey | null;
  defaults: Record<TierKey, number>;
  prices: Record<number, number>;
  names: Record<number, string>;
  /** Item id → its wiki image file name (from the gear data), for icons. */
  equivalents: Record<number, number[]>;
  community: CommunitySetup[];
  tips: TipView[];
  credits: GuideCredits;
  kcKey: string | null;
  libraryId: number;
}

const viewerFilters = (v: GuideViewer, over: { account?: string | null; build?: string | null } = {}): Viewer => ({
  account: (over.account as Viewer['account']) ?? v.account,
  build: (over.build as Viewer['build']) ?? v.build,
  levels: v.levels,
  quests: v.quests,
});

function numbers(s: GearSetup, block: GearBlock, idx: GearIndex): { dps: number | null; ttk: number | null } {
  const m = idx.monster(block.monsters?.[0] ?? block.monster) as Monster | null;
  if (!m) return { dps: null, ttk: null };
  const r = bestStyle(setupLoadout(s), m, idx.item, idx.rules)?.result ?? null;
  return { dps: r?.dps ?? null, ttk: r && Number.isFinite(r.ttk) ? r.ttk : null };
}

export async function loadGuideView(guide: Guide, viewer: GuideViewer, over: { account?: string | null; build?: string | null } = {}): Promise<GuideViewData> {
  const block = firstGearBlock(guide.body);
  const routeSeg = splitSegments(guide.body).find((s) => s.kind === 'route');
  const route = routeSeg ? parseRouteBlock(routeSeg.text) : null;
  const [idx, community, tips, credits] = await Promise.all([
    effectiveGearIndex(),
    communitySetups(guide, viewer.userId),
    tipsFor(guide, viewer.userId),
    guideCredits(guide),
  ]);
  const ids = [...blockItemIds(block), ...blockItemIds(block ? { ...block, setups: community.map((c) => c.setup) } : null)];
  const [priceMap, mapping] = await Promise.all([getItemPrices().catch(() => new Map<number, number>()), getItemMapping().catch(() => [])]);
  const idSet = new Set(ids);
  const prices: Record<number, number> = {};
  for (const id of idSet) {
    const p = priceMap.get(id);
    if (p != null) prices[id] = p;
  }
  const names: Record<number, string> = {};
  for (const m of mapping) if (idSet.has(m.id)) names[m.id] = m.name;
  const eq = equivalentsFor(ids);
  const equivalents: Record<number, number[]> = {};
  for (const id of idSet) {
    const e = eq(id).filter((x) => x !== id);
    if (e.length) equivalents[id] = e;
  }
  const filters = viewerFilters(viewer, over);
  const prefs = viewer.prefs ? { skipped: new Set(viewer.prefs.skipped.keys()), budgetCap: viewer.prefs.budgetCap, prices } : {};
  const setups: SetupView[] = [];
  const all: { s: GearSetup; community: boolean }[] = [...(block?.setups ?? []).map((s) => ({ s, community: false })), ...community.filter((c) => c.status !== 'promoted').map((c) => ({ s: c.setup, community: true }))];
  all.forEach(({ s, community: isCommunity }, i) => {
    const key = isCommunity ? (s.id ?? `c${s.communityId}`) : setupKey(s, i);
    const resolved = viewer.snapshot ? resolveSetup(s, viewer.snapshot, eq, prefs) : null;
    const n = block ? numbers(s, block, idx) : { dps: null, ttk: null };
    const mine = resolved && block ? numbers(personalSetup(s, resolved), block, idx) : null;
    setups.push({ key, index: i, setup: s, fit: setupFit(s, filters), resolved, dps: n.dps, ttk: n.ttk, myDps: mine?.dps ?? null, community: isCommunity });
  });
  const main = setups.filter((x) => !x.community);
  const defaults = Object.fromEntries(
    TIERS.map((t) => {
      const list = main.filter((x) => x.setup.tier === t.key);
      const d = defaultSetup(list.map((x) => x.setup), filters);
      return [t.key, d >= 0 ? list[d].index : -1];
    }),
  ) as Record<TierKey, number>;
  return {
    block,
    route,
    setups,
    openTier: viewerTier(main.map((x) => x.setup), viewer.levels),
    defaults,
    prices,
    names,
    equivalents,
    community,
    tips,
    credits,
    kcKey: kcKeyOf(block),
    libraryId: libraryIdOf(guide),
  };
}

export type ExportKind = 'banktag' | 'setup' | 'markers';

/** The text a copy button puts on the clipboard: the guide's version, or the reader's own. */
export function exportText(guide: Pick<Guide, 'title'>, view: SetupView, block: GearBlock | null, kind: ExportKind, mine: boolean): string {
  const s = mine && view.resolved ? personalSetup(view.setup, view.resolved) : view.setup;
  const tier = TIERS.find((t) => t.key === s.tier)?.label ?? '';
  const name = `${guide.title.split(' — ')[0]} ${tier} ${s.name}`.replace(/\s+/g, ' ').trim();
  const ex = { name, gear: s.gear, inventory: s.inventory, runePouch: s.runePouch, spellbook: s.spellbook, notes: s.note, quiver: s.quiver };
  if (kind === 'banktag') return bankTagString(ex);
  if (kind === 'setup') return inventorySetupJson(ex);
  return groundMarkersJson(s.markers?.length ? s.markers : block?.markers?.[s.tier] ?? []);
}
