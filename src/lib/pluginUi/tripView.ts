// The data behind the pre-trip check (pluginUi/tripUi): view 'trip' and the actions 'trip-save' and
// 'trip-forget'. The plugin loads the view with args {region, why: 'bank-close' | 'manual'} when the
// bank closes in one of the config's `tripRegions` (lib/tripContent), or when the player asks; the
// answer is the usual {ui} plus `warn` for its overlay:
//
//   warn: { ok, title: "ToA · 2 problems", lines: ["No stab weapon: Kephri (Fang in bank)", …] }
//         { ok: true, title: "✓ Ready for ToA", lines: [] }
//         null — no trip matches here, or nothing to check against (sharing off, items too old)
//
// Everything read here is the token owner's own (lib/playerItems snapshotForViewer and
// tripStateForViewer check the account is theirs); nothing about another player's bank is ever shown.

import { BOSSES } from '@/lib/constants';
import slayerMonsters from '@/data/slayerMonsters.json';
import { effectiveGearIndex } from '@/lib/dps/store';
import type { Monster } from '@/lib/dps/engine';
import type { GearIndex } from '@/lib/dps/summary';
import { monsterKey } from '@/lib/dps/summary';
import { publicGuideBySlug } from '@/lib/guides';
import { loadGuideView, type SetupView } from '@/lib/guideView';
import { setupTargets, TIERS, type GearSetup, type InvItem } from '@/lib/guideTiers';
import { equivalentsFor } from '@/lib/itemFamilies';
import { baseItem } from '@/lib/itemFamilies';
import { getItemMapping, type MappingItem } from '@/lib/osrsItems';
import { tripStateForViewer } from '@/lib/playerItems';
import { rateLimit } from '@/lib/rate-limit';
import { checkTrip, setupFromHeld, tripWarn, type TripCheck, type TripSource } from '@/lib/tripCheck';
import { contentForRegion, contentFromKey, TRIP_CONTENT, TRIP_REGIONS, type TripContent } from '@/lib/tripContent';
import { forgetOwnTripSetup, ownTripSetup, saveOwnTripSetup } from '@/lib/tripSetups';
import { targetWhy, type Target } from '@/lib/tripTarget';
import { clearTarget, currentTarget, ownTripKeys, pickTarget } from '@/lib/tripTargetStore';
import type { GuideViewer } from '@/lib/guideViewer';
import { verifyPluginTokenUser } from '@/lib/auth';
import { accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { message, type View } from './nodes';
import { pluginClanId, pluginViewer } from './guidesView';
import { tripPanelUi, type TripPanelData } from './tripUi';

type Args = Record<string, string>;

/** Items read longer ago than this aren't checked: the trip has moved on. */
const STALE_MS = 30 * 60_000;
/**
 * A plugin that filters its bank (X-Anvil-Bank-Filter) also pushes what is worn and carried just before
 * every trip check, so items older than this mean that push hasn't landed: never claim Ready off them.
 */
const BEHIND_MS = 20_000;
const freshPush = (request: Request) => request.headers.get('X-Anvil-Bank-Filter') === '1';

const regionOf = (args: Args): number | null => {
  const r = Number(args.region);
  return Number.isInteger(r) && r > 0 && r < 1 << 16 ? r : null;
};

let names: { from: MappingItem[]; byId: Map<number, string>; pouches: Set<number> } | null = null;
async function itemNames(): Promise<{ byId: Map<number, string>; pouches: Set<number> }> {
  const mapping = await getItemMapping().catch(() => [] as MappingItem[]);
  if (names?.from !== mapping) {
    names = { from: mapping, byId: new Map(mapping.map((m) => [m.id, m.gameName ?? m.name])), pouches: new Set(mapping.filter((m) => /^(divine )?rune pouch\b/i.test(m.gameName ?? m.name)).map((m) => m.id)) };
  }
  return names;
}

/** The monsters a player can pick by hand: the bosses and each slayer task's first monster we have stats for. */
let pickable: { key: string; name: string }[] | null = null;
function monsterOptions(idx: GearIndex): { key: string; name: string }[] {
  if (pickable) return pickable;
  const out = new Map<string, string>();
  const add = (n: string) => {
    const m = idx.monster(n);
    if (m && !m.hid && !out.has(monsterKey(m))) out.set(monsterKey(m), m.n);
  };
  for (const b of BOSSES) add(b.label);
  for (const c of (slayerMonsters as { categories: { label: string; monsters: { name: string }[] }[] }).categories) for (const m of c.monsters.slice(0, 2)) add(m.name);
  pickable = [...out.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
  return pickable;
}

const ago = (ms: number) => (ms >= 86_400_000 ? `${Math.floor(ms / 86_400_000)}d` : ms >= 3_600_000 ? `${Math.floor(ms / 3_600_000)}h` : `${Math.max(1, Math.floor(ms / 60_000))}m`);

/**
 * The guide's setup for this player: the highest level whose default setup fits them and that they
 * own every slot of (fallbacks count); else the level the guide opens on for them.
 */
function guidePick(setups: SetupView[], defaults: Record<string, number>, openTier: string | null): SetupView | null {
  const main = setups.filter((s) => !s.community);
  for (const t of [...TIERS].reverse()) {
    const d = defaults[t.key];
    const s = d >= 0 ? setups[d] : undefined;
    if (s && s.fit.ok && (s.resolved?.missing.length ?? 0) === 0) return s;
  }
  const open = openTier ? defaults[openTier] : -1;
  return (open != null && open >= 0 ? setups[open] : null) ?? main.find((s) => s.fit.ok) ?? main[0] ?? null;
}

interface Built {
  data: TripPanelData;
  warn: { ok: boolean; title: string; lines: string[] } | null;
  /** A next-trip target is set (lib/tripTarget): the plugin then asks on bank close at any bank. */
  armed: boolean;
}

/** A saved setup's chip: "m:Doom of Mokhaiotl#Normal" → "Doom of Mokh…". */
const optionOf = (key: string): { key: string; short: string; name: string } | null => {
  const c = contentFromKey(key);
  return c ? { key: c.key, short: c.short, name: `${c.name} (your setup)` } : null;
};

/**
 * The target, after the view's own `target` arg: a trip key or saved setup picked in the panel (or
 * "Going here next" on a guide), or 'clear'. Null when signed out or not on a character of theirs.
 */
async function targetFor(viewer: GuideViewer, args: Args): Promise<{ target: Target | null; ownKeys: string[] } | null> {
  if (!viewer.userId || !viewer.accountId) return null;
  if (args.target === 'clear') await clearTarget(viewer.accountId);
  else if (args.target) await pickTarget(viewer.userId, viewer.accountId, args.target, await ownTripKeys(viewer.accountId));
  const now = await currentTarget(viewer.userId, viewer.accountId);
  return { target: now.target, ownKeys: now.ownKeys };
}

async function build(request: Request, args: Args, viewer: GuideViewer, note: string | null): Promise<Built> {
  const region = regionOf(args);
  const regionName = region != null ? TRIP_REGIONS[region]?.name ?? null : null;
  const base: TripPanelData = {
    region: region != null ? String(region) : '',
    regionName,
    content: null,
    fromRegion: false,
    source: null,
    sourceLine: '',
    guide: null,
    check: null,
    status: 'none',
    checkedAt: null,
    hasOwn: false,
    canSave: false,
    note,
    options: TRIP_CONTENT.map((c) => ({ key: c.key, short: c.short, name: c.name })),
    monsters: [],
    bankFilter: freshPush(request),
  };
  if (!viewer.userId) return { data: { ...base, status: 'signed-out' }, warn: null, armed: false };
  const [idx, tgt] = await Promise.all([effectiveGearIndex(), targetFor(viewer, args)]);
  base.monsters = monsterOptions(idx);
  const target = tgt?.target ?? null;
  const armed = !!target;
  // The player's own setups are targets too: a chip each, beside the trips Anvil knows.
  base.options = [...base.options, ...(tgt?.ownKeys ?? []).filter((k) => !TRIP_CONTENT.some((c) => c.key === k)).map(optionOf).filter((o): o is NonNullable<typeof o> => !!o)];
  const snap = viewer.snapshot;
  const worn: InvItem[] = snap?.equipment?.items ?? [];
  const inventory: InvItem[] = snap?.inventory?.items ?? [];
  // A trip region picks its own trip exactly as before; anywhere else (or a shared bank that picks
  // nothing) the next-trip target is checked.
  const picked = contentFromKey(args.target && args.target !== 'clear' ? args.target : args.content);
  const fromRegion = !picked && region != null ? contentForRegion(region, new Set([...worn, ...inventory].map((i) => i.id))) : null;
  const content: TripContent | null = picked ?? fromRegion ?? contentFromKey(target?.key);
  const isTarget = !!content && !!target && content.key === target.key && !fromRegion;
  const withContent: TripPanelData = {
    ...base,
    content: content ? { key: content.key, name: content.name, short: content.short } : null,
    fromRegion: !!fromRegion,
    target: target ? { key: target.key, short: contentFromKey(target.key)?.short ?? target.key, why: targetWhy(target) } : null,
    fromTarget: isTarget,
  };
  if (!viewer.accountId || (!snap?.equipment && !snap?.inventory)) return { data: { ...withContent, status: 'off' }, warn: null, armed };
  const readAt = [snap.equipment?.readAt, snap.inventory?.readAt].filter((x): x is string => !!x).sort().pop() ?? '';
  const age = Date.now() - Date.parse(readAt);
  if (!Number.isFinite(age) || age > STALE_MS) return { data: { ...withContent, status: 'stale', age: Number.isFinite(age) ? ago(age) : undefined }, warn: null, armed };
  // After a save or forget (`note`) no push came first: the items are what the action used.
  if (content && !note && freshPush(request) && age > BEHIND_MS) return { data: { ...withContent, status: 'behind', checkedAt: readAt.slice(11, 16) }, warn: null, armed };
  if (!content) return { data: { ...withContent, canSave: false }, warn: null, armed };

  const [state, own, nm] = await Promise.all([tripStateForViewer(viewer.userId, viewer.accountId), ownTripSetup(viewer.userId, viewer.accountId, content.key), itemNames()]);
  let setup: GearSetup | null = own;
  let source: TripSource = own ? 'own' : 'calc';
  let sourceLine = own ? 'Checked against your own saved setup' : '';
  let targets = content.targets;
  let guide: TripPanelData['guide'] = null;
  if (content.guide) {
    const clanId = await pluginClanId(request, args);
    const g = (await publicGuideBySlug(clanId, content.guide).catch(() => null))?.guide;
    if (g && g.status === 'published') {
      guide = { id: g.id, title: g.title.split(' — ')[0] };
      if (!own) {
        const view = await loadGuideView(g, viewer);
        const s = view.block ? guidePick(view.setups, view.defaults, view.openTier) : null;
        if (s && view.block) {
          setup = s.setup;
          source = 'guide';
          targets = setupTargets(s.setup, view.block);
          sourceLine = `Checked against the guide's ${TIERS.find((t) => t.key === s.setup.tier)?.label ?? ''} setup: ${s.setup.name}`;
        }
      }
    }
  }
  if (source === 'calc') sourceLine = `No setup saved for ${content.name}: compared with the best your bank can make`;
  const monsters = targets.map((t) => idx.monster(t)).filter((m): m is Monster => !!m);
  if (!monsters.length && source === 'calc') return { data: { ...withContent, status: 'no-targets', guide, hasOwn: !!own, canSave: true }, warn: null, armed };

  const bank = snap.bank?.items ?? [];
  const lootingBag = snap.lootingBag?.items;
  const heldIds = [...worn, ...inventory, ...bank, ...(lootingBag ?? [])].map((i) => i.id);
  const setupIds = setup ? [...Object.values(setup.gear), ...Object.values(setup.alts ?? {}).flat(), ...(setup.inventory ?? []).filter((x): x is InvItem => !!x).map((x) => x.id)].filter((x): x is number => typeof x === 'number') : [];
  const needs = equivalentsFor([...heldIds, ...setupIds], 'needs');
  const holds = equivalentsFor(heldIds, 'holds');
  const nameOf = (id: number) => nm.byId.get(id) ?? idx.item(id)?.n ?? baseItem(id)?.name ?? `Item ${id}`;
  const check: TripCheck = checkTrip({
    content,
    setup,
    source,
    monsters,
    worn,
    inventory,
    bank,
    lootingBag,
    state,
    levels: viewer.levels,
    idx,
    needs,
    holds,
    nameOf,
    isRunePouch: (id) => nm.pouches.has(id),
    prefs: viewer.prefs ? { skipped: new Set(viewer.prefs.skipped.keys()) } : {},
  });
  const data: TripPanelData = {
    ...withContent,
    source,
    sourceLine,
    guide,
    check,
    status: 'ready',
    checkedAt: readAt ? readAt.slice(11, 16) : null,
    hasOwn: !!own,
    canSave: worn.length + inventory.length > 0,
  };
  return { data, warn: tripWarn(content.short, check), armed };
}

/**
 * The token owner as the trip's player: only the character being played, and only when it is theirs
 * (the guides' viewer falls back to the main, whose items say nothing about this trip).
 */
async function tripViewer(request: Request): Promise<GuideViewer | 'not-yours'> {
  const character = playedCharacter(request);
  const login = character ? await verifyPluginTokenUser(request).catch(() => null) : null;
  if (character && login && (await accountStanding(login.userId, character)) !== 'yours') return 'not-yours';
  return pluginViewer(request);
}

/** View 'trip': the check for the trip this region (or the player's pick) starts. */
export async function tripView(request: Request, args: Args, note: string | null = null): Promise<View> {
  const viewer = await tripViewer(request);
  if (viewer === 'not-yours') return { ...message('This character isn’t one of yours on Anvil, so there is nothing of yours to check.'), warn: null, armed: false };
  const { data, warn, armed } = await build(request, args, viewer, note);
  return { ui: tripPanelUi(data), warn, armed };
}

/** 'trip-save' (what they wear and carry becomes their setup for the trip) and 'trip-forget'. */
export async function tripAct(request: Request, act: string, args: Args): Promise<View | null> {
  if (act !== 'trip-save' && act !== 'trip-forget') return null;
  const viewer = await tripViewer(request);
  if (viewer === 'not-yours' || !viewer.userId || !viewer.accountId) return message('Sign in with the plugin, on your own character, to save a setup.');
  const rl = await rateLimit(request, `plugin-trip-setups:${viewer.userId}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return message('That’s a lot of changes — give it a minute.');
  const content = contentFromKey(args.content);
  if (!content) return tripView(request, args);
  // Back to the check as it was asked for: the region's own trip stays "picked from" the region.
  const region = regionOf(args);
  const again: Args = { ...(region != null ? { region: String(region) } : {}), why: 'manual', ...(region != null && TRIP_REGIONS[region]?.content === content.key ? {} : { content: content.key }) };
  if (act === 'trip-forget') {
    await forgetOwnTripSetup(viewer.userId, viewer.accountId, content.key);
    return tripView(request, again, `Forgot your ${content.short} setup.`);
  }
  const snap = viewer.snapshot;
  const worn = snap?.equipment?.items ?? [];
  const inventory = snap?.inventory?.items ?? [];
  if (!worn.length && !inventory.length) return tripView(request, again, 'Nothing worn or packed to save yet.');
  const [idx, state, nm] = await Promise.all([effectiveGearIndex(), tripStateForViewer(viewer.userId, viewer.accountId), itemNames()]);
  const holds = equivalentsFor([...worn, ...inventory].map((i) => i.id), 'holds');
  const setup = setupFromHeld(`My ${content.short} setup`, worn, inventory, state, idx, holds, viewer.levels, (id) => nm.pouches.has(id));
  await saveOwnTripSetup(viewer.userId, viewer.accountId, content.key, setup);
  return tripView(request, again, `Saved as your ${content.short} setup.`);
}
