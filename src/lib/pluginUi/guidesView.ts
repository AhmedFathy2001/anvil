// The data behind the plugin's Guides views (pluginUi/guidesUi): view names 'guides', 'guide',
// 'guide-next', and the actions 'guides-filter', 'guide-pick', 'guide-alt', 'guide-skip',
// 'guide-unskip', 'guide-budget', 'guide-route'. Everything here is the token owner's own: the
// played character when it is theirs, else their main. Clanless players get the Anvil library; a
// clan member pointed at their clan gets the clan's copies where it has them (lib/guides).

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { resolvePluginClan, verifyPluginTokenUser } from '@/lib/auth';
import { BOSSES, SKILLS } from '@/lib/constants';
import { accountForCharacter, accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { getGuide, publicGuideBySlug, publicGuides } from '@/lib/guides';
import { listCategories } from '@/lib/guideCategoryStore';
import { categoryOf, readingMinutes } from '@/lib/guideCategories';
import { firstGearBlock, splitSegments, TIERS, type GearBlock, type GearSetup, type TierKey } from '@/lib/guideTiers';
import { setupFit, viewerTier, type GuideAccount, type GuideBuild } from '@/lib/guideSetups';
import { EMPTY_VIEWER, equivalentsFor, guideViewer, kcKeyOf, routeFacts, type GuideViewer } from '@/lib/guideViewer';
import { ladderFor, loadGuideView, type SetupView } from '@/lib/guideView';
import { bylines, communityCounts, followsOf, libraryIdOf, ranksFor, recentGuides, recordView } from '@/lib/guideCommunity';
import { writtenByLine, byShort } from '@/lib/guideCredit';
import { parseRouteBlock, goalLabel, routeProgress } from '@/lib/guideRoutes';
import { personalSetup, slotOptions, swapNote } from '@/lib/gearOwnership';
import { baseItem } from '@/lib/itemFamilies';
import { formatGp } from '@/lib/itemPrices';
import { fmtDuration } from '@/lib/dps/summary';
import { effectiveGearIndex } from '@/lib/dps/store';
import { gearNow, otherTargets, unreadWorn, wornGear } from '@/lib/gearNow';
import type { DpsResult } from '@/lib/dps/engine';
import { getItemMapping } from '@/lib/osrsItems';
import { spellbookName } from '@/lib/guideSelection';
import { clearSkip, isSkipReason, setBudgetCap, setSkip } from '@/lib/playerItems';
import { rateLimit } from '@/lib/rate-limit';
import { supporterForUsers } from '@/lib/supporter';
import { contentFromKey } from '@/lib/tripContent';
import { guideTargetFor, targetLabel } from '@/lib/tripTargetStore';
import { hasGuidesPanel } from './load';
import { gap, message, type Node, type View } from './nodes';
import { plainLine, sectionsForTier, textTiers } from './guideBody';
import { GUIDE_REGIONS, guideGoneUi, guidePanelUi, guidesSearchUi, nextUpUi, type GuidePic, type GuideRowData, type PanelAlternatives, type PanelCheck, type GearNowStats, type PanelGearNow, type PanelRoute } from './guidesUi';

type Args = Record<string, string>;

/** The token owner as a guide reader: the played character when it is theirs, else their main. */
export async function pluginViewer(request: Request): Promise<GuideViewer> {
  const login = await verifyPluginTokenUser(request).catch(() => null);
  if (!login) return EMPTY_VIEWER;
  const row = await db.query.users.findFirst({ where: eq(users.id, login.userId), columns: { playerId: true } });
  if (!row?.playerId) return EMPTY_VIEWER;
  const character = playedCharacter(request);
  let accountId: number | null = null;
  if (character && (await accountStanding(login.userId, character)) === 'yours') accountId = (await accountForCharacter(character))?.id ?? null;
  return guideViewer({ userId: login.userId, playerId: row.playerId }, { items: true, accountId });
}

/** The clan the plugin is pointed at (its copies first), or null for the library. */
export async function pluginClanId(request: Request, args: Args): Promise<number | null> {
  if (!args.clan) return null;
  return (await resolvePluginClan(request).catch(() => null))?.id ?? null;
}

/** The map region the plugin sent, when it is a real one. */
const regionArg = (args: Args): string | undefined => {
  const r = Number(args.region);
  return Number.isInteger(r) && r > 0 ? String(r) : undefined;
};

const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
/** The boss a title names (its name or a 4+ letter alias, as a whole word), longest name first. */
function bossIn(title: string): string | null {
  const t = words(title);
  let best: { key: string; len: number } | null = null;
  for (const b of BOSSES) {
    for (const name of [b.label, ...(b.aliases ?? []).filter((a) => a.length >= 4 && a !== 'raids')]) {
      const n = words(name);
      if (n.trim() && t.includes(n) && (!best || n.length > best.len)) best = { key: b.key, len: n.length };
    }
  }
  return best?.key ?? null;
}

/** Every guide row gets a picture: its setups' weapon, else the boss or skill it is about, else its category's. */
export function guidePic(g: { title: string; category: string; kind: string }, block: GearBlock | null): GuidePic {
  const weapon = block?.setups.find((s) => s.pick)?.gear.weapon ?? block?.setups[0]?.gear.weapon;
  if (weapon) return { item: weapon };
  const boss = (block && kcKeyOf(block)) || bossIn(g.title);
  if (boss) return { boss };
  const t = words(g.title);
  const skill = SKILLS.find((k) => k !== 'overall' && t.includes(` ${k} `));
  if (skill) return { skill };
  if (/clue/i.test(g.title)) return { item: 2677 };
  if (g.kind === 'route' || g.category === 'quests') return { item: 9813 };
  if (g.category === 'money') return { item: 995 };
  if (g.category === 'skilling') return { skill: 'overall' };
  return null;
}

function rowOf(g: { id: number; title: string; category: string; body: string; kind: string }, community: number, by: string, catLabel: string): GuideRowData {
  const block = firstGearBlock(g.body);
  const levels = new Set([...(block?.setups.map((s) => s.tier) ?? []), ...textTiers(g.body)]).size;
  const parts = g.kind === 'route' ? ['Progression route'] : [levels > 1 ? `${levels} levels` : 'Guide', block ? `${block.setups.length} setup${block.setups.length === 1 ? '' : 's'}` : `${readingMinutes(g.body)} min read`];
  if (community) parts.push(`${community} community`);
  return { id: g.id, title: g.title.split(' — ')[0], category: catLabel, pic: guidePic(g, block), meta: parts.join(' · '), by };
}

export async function guidesSearchView(request: Request, args: Args): Promise<View> {
  const [viewer, clanId] = await Promise.all([pluginViewer(request), pluginClanId(request, args)]);
  const [all, cats] = await Promise.all([publicGuides(clanId), listCategories(clanId)]);
  const filters = { level: args.level ?? '', account: args.account ?? viewer.account ?? '', build: args.build ?? viewer.build ?? 'any' };
  const counts = await communityCounts([...new Set(all.map(({ guide }) => libraryIdOf(guide)))]);
  const by = await bylines(all.map(({ guide }) => guide.id));
  // A guide without setups always fits: the filters are about setups.
  const fits = (body: string) => {
    const block = firstGearBlock(body);
    if (!block?.setups.length) return true;
    const tier = (filters.level || viewerTier(block.setups, viewer.levels) || '') as TierKey | '';
    return block.setups.some((s) => (!tier || s.tier === tier) && setupFit(s, { account: (filters.account || null) as GuideAccount | null, build: filters.build as GuideBuild }).ok);
  };
  const rows = all.filter(({ guide }) => fits(guide.body)).map(({ guide }) => {
    const b = by.get(guide.id);
    return { g: guide, row: rowOf(guide, counts.get(libraryIdOf(guide)) ?? 0, b?.first ? `by ${b.first}${b.count > 1 ? ` +${b.count - 1}` : ''}` : '', categoryOf(guide.category, cats).label) };
  });
  const routes = rows.filter((r) => r.g.kind === 'route');
  const sections = [
    ...(routes.length ? [{ label: 'Progression routes', rows: routes.map((r) => r.row) }] : []),
    ...cats.map((c) => ({ label: c.label, rows: rows.filter((r) => r.g.kind !== 'route' && r.g.category === c.key).map((r) => r.row) })),
  ].filter((s) => s.rows.length);
  const recent = viewer.userId ? (await recentGuides(viewer.userId, 3)).map((g) => rows.find((r) => r.g.id === g.id)?.row).filter((x): x is GuideRowData => !!x) : [];
  // The plugin says where it stands; a region with a guide gets the "You're at" card.
  const region = regionArg(args);
  const spot = region ? GUIDE_REGIONS[Number(region)] : undefined;
  const at = spot ? await publicGuideBySlug(clanId, spot.slug) : null;
  const here = at && spot ? { id: at.guide.id, title: at.guide.title.split(' — ')[0], where: spot.where, pic: guidePic(at.guide, firstGearBlock(at.guide.body)) } : null;
  // The pre-trip check's way in, for a signed-in player on a character of theirs.
  const trip = viewer.userId && viewer.accountId ? await targetLabel(viewer.userId, viewer.accountId).catch(() => null) : undefined;
  return { ui: guidesSearchUi({ recent, sections, filters, here, region, trip }) };
}

const SLOTS = ['head', 'cape', 'neck', 'ammo', 'quiver', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A route's chapters with each step ticked from what Anvil knows of the reader. */
async function routePanel(viewer: GuideViewer, guideId: number, body: string): Promise<PanelRoute | null> {
  const seg = splitSegments(body).find((x) => x.kind === 'route');
  const route = seg ? parseRouteBlock(seg.text) : null;
  if (!route) return null;
  const follow = viewer.userId ? (await followsOf(viewer.userId)).find((f) => f.guideId === guideId) : undefined;
  const ids = route.chapters.flatMap((c) => c.steps.map((s) => (s.goal.kind === 'item' || s.goal.kind === 'clog' ? s.goal.id : 0))).filter(Boolean);
  const facts = routeFacts(viewer, follow?.manualDone ?? [], equivalentsFor(ids));
  const p = routeProgress(route, facts, viewer.account, 3);
  return {
    signedIn: !!viewer.userId,
    following: !!follow,
    done: p.done,
    total: p.total,
    chapters: route.chapters.map((c, ci) => ({
      name: c.name,
      steps: p.steps.filter((x) => x.chapter === ci).map((x) => ({ title: x.step.title, item: x.step.icon ?? null, why: x.line, done: x.done, skipped: x.skipped })),
    })),
  };
}

/** "Ahrim the Blighted" → "Ahrim", "Great Olm (Head)" → "Great Olm": a name for a ~70px column. */
const shortTarget = (name: string) => name.split(' the ')[0].replace(/\s*\(.*\)\s*$/, '').trim() || name;

const statsOf = (r: DpsResult | null): GearNowStats | null => (r ? { maxHit: r.maxHit, accuracy: r.accuracy, speed: r.speed, ttk: Number.isFinite(r.ttk) ? r.ttk : null } : null);

/**
 * "Your gear now vs this setup" from the worn-gear push (owner only: viewer.snapshot is). Null with no
 * equipment reading at all; with one, always a card, "nothing worn" included. `others` are the guide's
 * targets this setup isn't for (Ahrim, beside a magic setup for the other five brothers).
 */
async function gearNowPanel(setup: GearSetup, block: GearBlock, viewer: GuideViewer, others: PanelGearNow['others']): Promise<PanelGearNow | null> {
  const reading = viewer.snapshot?.equipment;
  if (!reading) return null;
  const items = reading.items ?? [];
  if (!items.length) return { empty: true, rows: [] };
  const idx = await effectiveGearIndex();
  const eq = equivalentsFor(items.map((i) => i.id), 'holds');
  const worn = wornGear(items, idx, eq);
  const unread = unreadWorn(items, idx, eq);
  // Names for what the gear data can't place: the item names data (wiki prices + RuneLite's cache).
  const mapping = unread.length ? await getItemMapping().catch(() => []) : [];
  const unknown = unread.map((id) => baseItem(id)?.name ?? mapping.find((m) => m.id === id)?.name ?? `Item ${id}`);
  const now = gearNow(setup, block, worn, idx, eq, viewer.levels);
  if (!now) return { rows: [], unknown, ownLevels: false };
  const named = (id: number | null) => (id == null ? null : { id, name: idx.item(id)?.n ?? baseItem(id)?.name ?? `Item ${id}` });
  return {
    rows: now.rows.map((r) => ({ name: shortTarget(r.monster.n), you: r.you, guide: r.guide, mine: statsOf(r.mine), theirs: statsOf(r.theirs) })),
    others,
    slots: now.slots.map((x) => ({ slot: x.slot, worn: named(x.worn), guide: named(x.guide), pct: x.pct })),
    unknown,
    ownLevels: now.ownLevels,
  };
}

export async function guidePanelView(request: Request, args: Args, extra: { alternatives?: string; setup?: string; note?: string } = {}): Promise<View> {
  const region = regionArg(args);
  const guide = await getGuide(Number(args.id));
  if (!guide || guide.status !== 'published') return { ui: guideGoneUi(region) };
  const viewer = await pluginViewer(request);
  if (viewer.userId) void recordView(viewer.userId, guide.id);
  const [view, cats] = await Promise.all([loadGuideView(guide, viewer, { account: args.account || null, build: args.build || null }), listCategories(guide.clanId).catch(() => [])]);
  const main = view.setups.filter((s) => !s.community);
  // The levels: the setups' when it has any, else the ones its text is written for.
  const setupTiers = new Set(main.map((s) => s.setup.tier as string));
  const bodyTiers = textTiers(guide.body);
  const tiers = TIERS.filter((t) => (setupTiers.size ? setupTiers.has(t.key) : bodyTiers.includes(t.key))).map((t) => ({ key: t.key as string, label: t.label }));
  const tier = (tiers.some((t) => t.key === args.tier) ? args.tier : view.openTier && tiers.some((t) => t.key === view.openTier) ? view.openTier : tiers[0]?.key ?? null) as TierKey | null;
  const pills = main.filter((s) => s.setup.tier === tier);
  const comm = view.setups.filter((s) => s.community && s.setup.tier === tier);
  const want = extra.setup ?? args.setup;
  const current: SetupView | undefined = [...pills, ...comm].find((s) => s.key === want) ?? (tier && view.defaults[tier] >= 0 ? view.setups[view.defaults[tier]] : pills[0]);
  const s = current ? (current.resolved ? personalSetup(current.setup, current.resolved) : current.setup) : null;
  const names = view.names;
  const ladder = current ? await ladderFor(current, view.setups, view.block, view.prices) : [];
  const credits = view.credits.library;
  const ranks = await ranksFor(credits.slice(0, 1).map((c) => c.userId));
  const top = credits[0] ? ranks.get(credits[0].userId)?.rank ?? null : null;
  const supporter = credits[0] ? (await supporterForUsers([credits[0].userId]).catch(() => new Map())).has(credits[0].userId) : false;
  // The pre-trip check's "Going here next", for a guide whose trip it knows (or the player saved a setup for).
  const nextKey = viewer.userId && viewer.accountId ? await guideTargetFor(viewer.accountId, guide.id).catch(() => null) : null;
  const nextTrip = nextKey ? contentFromKey(nextKey) : null;
  const phase2 = hasGuidesPanel(request);
  const slotNote = (slot: string) => current?.resolved?.slots.find((x) => x.slot === slot);
  const checklist: PanelCheck[] = [];
  if (s) {
    for (const q of s.req?.quests ?? []) checklist.push({ text: q, ok: viewer.quests ? viewer.quests.has(q.toLowerCase()) : null, pic: { quest: true } });
    for (const [sk, n] of Object.entries(s.req?.levels ?? {})) checklist.push({ text: `${n} ${cap(sk)}`, ok: viewer.levels ? (viewer.levels[sk] ?? 0) >= n : null, pic: { skill: sk } });
    const supplies = new Map<number, number>();
    for (const it of s.inventory ?? []) if (it) supplies.set(it.id, (supplies.get(it.id) ?? 0) + (it.q ?? 1));
    const missingSupply = new Set(current?.resolved?.missingSupplies.map((m) => m.id) ?? []);
    for (const [id, q] of [...supplies.entries()].slice(0, 6)) checklist.push({ text: `${names[id] ?? 'Item'}${q > 1 ? ` ×${q}` : ''}`, ok: current?.resolved ? !missingSupply.has(id) : null, pic: { item: id } });
  }
  let alternatives: PanelAlternatives | null = null;
  // A slot's alternatives: the 'guide-alt' post's slot, or a load's `alt`.
  const altSlot = extra.alternatives ?? (SLOTS.includes(args.alt ?? '') ? args.alt : undefined);
  if (altSlot && current) {
    const slot = altSlot;
    const options = slotOptions(current.setup, slot as 'head');
    const row = ladder.find((r) => r.slot === slot);
    const base = row?.steps.find((x) => x.id === options[0])?.dps ?? null;
    const eq = equivalentsFor(options);
    const owned = new Set<number>();
    if (viewer.snapshot) for (const c of Object.values(viewer.snapshot)) for (const it of c?.items ?? []) for (const x of eq(it.id)) owned.add(x);
    alternatives = {
      slot,
      rows: options.map((id, i) => {
        const dps = row?.steps.find((x) => x.id === id)?.dps ?? null;
        return {
          id,
          name: names[id] ?? baseItem(id)?.name ?? `Item ${id}`,
          price: view.prices[id] ? formatGp(view.prices[id]) : 'untradeable',
          note: i === 0 ? "guide's pick" : base && dps != null ? `${dps >= base ? '+' : ''}${Math.round(((dps - base) / base) * 100)}% DPS` : `fallback ${i}`,
          owned: eq(id).some((x) => owned.has(x)),
          inUse: (slotNote(slot)?.use ?? options[0]) === id,
          skipped: viewer.prefs?.skipped.has(id) ?? false,
        };
      }),
      skipped: [...(viewer.prefs?.skipped.keys() ?? [])].slice(0, 8).map((id) => ({ id, name: names[id] ?? baseItem(id)?.name ?? `Item ${id}` })),
      budget: viewer.prefs?.budgetCap ? String(Math.round(viewer.prefs.budgetCap / 1e6)) : '',
      signedIn: !!viewer.accountId,
    };
  }
  const tone = top ? (supporter ? 'quill-star' : `quill-${top.quill}`) : null;
  const nowCard = current && view.block ? await gearNowPanel(current.setup, view.block, viewer, otherTargets(current, [...pills, ...comm], view.block).map((o) => ({ ...o, name: shortTarget(o.name) }))) : null;
  const all = [...pills, ...comm];
  return {
    ui: guidePanelUi({
      id: guide.id,
      slug: guide.slug,
      title: guide.title.split(' — ')[0],
      kind: guide.kind === 'route' ? 'Progression route' : categoryOf(guide.category, cats).label,
      tier,
      tiers,
      byline: `${byShort(credits)}${top && !phase2 ? ` · ${top.label}` : ''}` || writtenByLine(credits),
      rankGlyph: phase2 ? tone : null,
      region,
      keep: Object.fromEntries((['account', 'build'] as const).filter((k) => args[k] && args[k] !== 'any').map((k) => [k, args[k]!])),
      setups: all.map((x) => ({
        key: x.key,
        name: x.community ? `${x.setup.name} (community)` : x.setup.name,
        sub: [x.setup.pick ? 'Curator pick' : x.setup.tag ?? '', x.dps != null ? `${x.dps.toFixed(1)} DPS` : ''].filter(Boolean).join(' · '),
        weapon: x.setup.gear.weapon ?? null,
        blocked: x.fit.ok ? null : x.fit.reason,
        pick: !!x.setup.pick,
      })),
      current: current?.key ?? null,
      dps: current ? `${((current.resolved ? current.myDps : current.dps) ?? 0).toFixed(1)} DPS${current.ttk != null ? ` · ~${fmtDuration(current.ttk)}` : ''}` : '',
      usingFallbacks:
        current?.resolved?.slots
          .filter((x) => x.use && (x.kind === 'fallback' || x.kind === 'owned' || x.kind === 'upgrade'))
          .map((x) => (x.kind === 'fallback' ? `${names[x.use!] ?? 'item'} for ${names[x.guide] ?? 'item'}` : `${x.kind === 'upgrade' ? 'upgrade: ' : ''}${swapNote(x, names)}`))
          .join(', ') || null,
      slots: s
        ? SLOTS.map((slot) => {
            const n = slotNote(slot);
            const id = slot === 'quiver' ? s.quiver ?? null : s.gear[slot] ?? null;
            const fallback = n?.kind === 'fallback' ? `you'll use ${names[n.use!] ?? 'a fallback'}` : n && (n.kind === 'owned' || n.kind === 'upgrade') ? `${n.kind === 'upgrade' ? 'upgrade · ' : ''}${swapNote(n, names)}` : null;
            return { slot, id, fallback, missing: n?.kind === 'missing' };
          })
        : [],
      inventory: (s?.inventory ?? []).map((it) => {
        if (!it) return it;
        const sup = current?.resolved?.supplies?.find((x) => x.use === it.id && x.kind !== 'have');
        if (!sup) return it;
        return sup.kind === 'swap' ? { ...it, tip: `Your ${names[sup.use] ?? 'item'} instead of ${names[sup.id] ?? 'the guide\'s'}` } : { ...it, missing: true, tip: `${names[sup.id] ?? 'Item'}: not owned` };
      }),
      pouch: (s?.runePouch ?? []).map((r) => ({ id: r.id, q: r.q ?? 1 })),
      spellbook: spellbookName(s?.spellbook),
      spellbookId: s?.spellbook ?? 0,
      spells: s?.spells ?? [],
      hasMarkers: s && tier ? (s.markers?.length ? s.markers : view.block?.markers?.[tier] ?? []).length : 0,
      // The Missing list names the plain item: a kit or variant of it never needs buying.
      missing: current?.resolved
        ? current.resolved.slots
            .filter((x) => x.kind === 'missing' && x.use)
            .map((x) => ({ id: x.use!, name: baseItem(x.use!)?.name ?? names[x.use!] ?? 'Item', price: view.prices[x.use!] ? formatGp(view.prices[x.use!]) : 'untradeable' }))
        : null,
      checkedAt: viewer.snapshot ? Object.values(viewer.snapshot).map((c) => c?.readAt ?? '').sort().pop()?.slice(0, 16).replace('T', ' ') ?? null : null,
      checklist,
      setupSteps: (s?.steps ?? []).map((x) => plainLine(x.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''))).filter(Boolean),
      body: sectionsForTier(guide.body, tier),
      tips: view.tips.filter((t) => t.kind === 'tip' && (!t.tier || t.tier === tier)).slice(0, 4).map((t) => ({ text: plainLine(t.text), useful: t.useful })),
      mistakes: view.tips.filter((t) => t.kind === 'mistake' && (!t.tier || t.tier === tier)).slice(0, 3).map((t) => plainLine(t.text)),
      upgrades: ladder
        .filter((r) => r.next)
        .sort((a, b) => (b.next!.perMillion ?? -1) - (a.next!.perMillion ?? -1))
        .slice(0, 4)
        .map((r) => ({ id: r.next!.id, name: names[r.next!.id] ?? 'Item', gain: `+${r.next!.gainPct}%`, price: r.next!.price ? formatGp(r.next!.price) : 'untradeable' })),
      community: view.community.filter((c) => c.tier === tier && c.status !== 'promoted').slice(0, 3).map((c) => ({ key: c.key, name: c.setup.name, used: c.voters, weapon: c.setup.gear.weapon ?? null })),
      phase2,
      alternatives,
      route: guide.kind === 'route' ? await routePanel(viewer, guide.id, guide.body) : null,
      gearNow: nowCard,
      goingNext: nextKey && nextTrip ? { key: nextKey, short: nextTrip.short } : null,
    }),
  };
}

/** The You tab's guides card (null: nothing to show), the route followed or the recent guides. */
async function nextUpNode(request: Request, args: Args): Promise<Node | null | 'signed-out'> {
  const viewer = await pluginViewer(request);
  if (!viewer.userId) return 'signed-out';
  const follows = await followsOf(viewer.userId);
  const pick = follows.find((f) => String(f.guideId) === args.route) ?? follows[0];
  const recent = (await recentGuides(viewer.userId, 3))
    .filter((g) => g.kind !== 'route')
    .map((g) => {
      const block = firstGearBlock(g.body);
      const levels = new Set([...(block?.setups.map((s) => s.tier) ?? []), ...textTiers(g.body)]).size;
      return { id: g.id, title: g.title.split(' — ')[0], category: g.category, pic: guidePic(g, block), meta: levels > 1 ? `${levels} levels` : '', by: '' };
    });
  if (!pick) return nextUpUi({ route: null, done: 0, total: 0, lastDone: null, next: [], recent, followed: [] });
  const seg = splitSegments(pick.body).find((x) => x.kind === 'route');
  const route = seg ? parseRouteBlock(seg.text) : null;
  if (!route) return nextUpUi({ route: null, done: 0, total: 0, lastDone: null, next: [], recent, followed: [] });
  const ids = route.chapters.flatMap((c) => c.steps.map((s) => (s.goal.kind === 'item' || s.goal.kind === 'clog' ? s.goal.id : 0))).filter(Boolean);
  const facts = routeFacts(viewer, pick.manualDone, equivalentsFor(ids));
  const p = routeProgress(route, facts, viewer.account, 3);
  return nextUpUi({
    route: { id: pick.guideId, slug: pick.slug, title: pick.title },
    done: p.done,
    total: p.total,
    lastDone: p.lastDone ? { title: p.lastDone.step.title, icon: p.lastDone.step.icon ?? null, source: p.lastDone.source ?? '' } : null,
    next: p.next.map((x) => ({ title: x.step.title, icon: x.step.icon ?? null, line: x.line, reqs: x.reqs.map((r) => ({ text: goalLabel(r.goal, facts), met: r.met })) })),
    recent,
    followed: follows.map((f) => ({ id: f.guideId, title: f.title })),
  });
}

/** The You tab's guides card for the token owner, or null when there's nothing to show. */
export async function guideYouCard(request: Request): Promise<Node | null> {
  const n = await nextUpNode(request, {});
  return n === 'signed-out' ? null : n;
}

/** View 'guide-next' (and the route switch): the You tab's guides card. */
export async function guideNextView(request: Request, args: Args): Promise<View> {
  const n = await nextUpNode(request, args);
  if (n === 'signed-out') return message('Sign in with the plugin to follow a route.');
  return { ui: n ?? { t: 'slot', id: 'guide-next', c: gap(0) } };
}

/** The guide panel's actions. Skips and the budget are the token owner's own character's. */
export async function guideAct(request: Request, act: string, args: Args, fields: Args): Promise<View | null> {
  switch (act) {
    case 'guides-filter':
      // The filter chips send their choice in args; an older view's selects sent it as fields.
      return guidesSearchView(request, { ...args, level: fields.level ?? args.level ?? '', account: fields.account ?? args.account ?? '', build: fields.build ?? args.build ?? 'any' });
    case 'guide-pick':
      return guidePanelView(request, args, { setup: fields.setup || args.setup });
    case 'guide-alt':
      return guidePanelView(request, args, { alternatives: args.slot });
    case 'guide-route':
      return guideNextView(request, { route: fields.route ?? '' });
    case 'guide-skip':
    case 'guide-unskip':
    case 'guide-budget': {
      const viewer = await pluginViewer(request);
      if (!viewer.accountId) return guidePanelView(request, args, { alternatives: args.slot });
      const rl = await rateLimit(request, `plugin-guide-prefs:${viewer.userId}`, { limit: 30, windowMs: 60_000 });
      if (!rl.ok) return message('That’s a lot of changes — give it a minute.');
      const item = Number(args.item);
      if (act === 'guide-skip' && Number.isInteger(item) && item > 0) await setSkip(viewer.accountId, item, isSkipReason(args.reason) ? args.reason : 'dont_want');
      if (act === 'guide-unskip' && Number.isInteger(item) && item > 0) await clearSkip(viewer.accountId, item);
      if (act === 'guide-budget') {
        const m = Number(fields.cap);
        await setBudgetCap(viewer.accountId, Number.isFinite(m) && m > 0 ? m * 1e6 : null);
      }
      return guidePanelView(request, args, { alternatives: args.slot });
    }
    default:
      return null;
  }
}
