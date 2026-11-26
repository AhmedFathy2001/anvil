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

import { createHash } from 'node:crypto';

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
import type { TripState } from '@/lib/tripState';
import { rateLimit } from '@/lib/rate-limit';
import { checkTrip, setupFromHeld, tripWarn, type TripCheck, type TripSource } from '@/lib/tripCheck';
import { calcSourceLine, contentForRegion, contentFromKey, TRIP_CONTENT, TRIP_REGIONS, type TripContent } from '@/lib/tripContent';
import { forgetOwnTripSetup, ownTripSetup, saveOwnTripSetup } from '@/lib/tripSetups';
import { canonicalKey, ownAlias, targetWhy, type Target } from '@/lib/tripTarget';
import { clearTarget, currentTarget, ownTripKeys, pickTarget } from '@/lib/tripTargetStore';
import type { GuideViewer } from '@/lib/guideViewer';
import { verifyPluginTokenUser } from '@/lib/auth';
import { accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { log } from '@/lib/logger';
import { message, type View } from './nodes';
import { pluginClanId, pluginViewer } from './guidesView';
import { tripPanelUi, type TripPanelData } from './tripUi';

type Args = Record<string, string>;

/** Items read longer ago than this aren't checked: the trip has moved on. */
const STALE_MS = 30 * 60_000;
/**
 * A check the plugin pushed what is held for first (args.held = '1') with items older than this: that
 * push hasn't landed, so the overlay claims nothing (the card still shows the last items).
 */
const BEHIND_MS = 20_000;
/** Why the plugin couldn't push what is held before a check (args.held other than '1'), said on the card. */
const HELD_WHY: Record<string, string> = {
  paused: 'Anvil is paused for this account in the plugin (Not my account), so your items weren’t sent',
  'signed-out': 'The plugin isn’t signed in, so your items weren’t sent',
  'no-character': 'The plugin hasn’t seen your character yet, so your items weren’t sent',
  'sharing-off': 'Item sharing is off in the plugin settings, so your items weren’t sent',
  'no-site': 'This site doesn’t take items from the plugin yet',
  failed: 'Couldn’t send your items just now',
};
const freshPush = (request: Request) => request.headers.get('X-Anvil-Bank-Filter') === '1';

const regionOf = (args: Args): number | null => {
  const r = Number(args.region);
  return Number.isInteger(r) && r > 0 && r < 1 << 16 ? r : null;
};

let names: { from: MappingItem[]; byId: Map<number, string>; pouches: Set<number> } | null = null;
let namesFetch: Promise<unknown> | null = null;
/** The game's item names. Once known, a check never waits on the mapping's refetch (a second or more). */
async function itemNames(): Promise<{ byId: Map<number, string>; pouches: Set<number> }> {
  const load = () => {
    namesFetch ??= getItemMapping()
      .catch(() => [] as MappingItem[])
      .then((mapping) => {
        if (names?.from !== mapping && (mapping.length || !names)) {
          names = { from: mapping, byId: new Map(mapping.map((m) => [m.id, m.gameName ?? m.name])), pouches: new Set(mapping.filter((m) => /^(divine )?rune pouch\b/i.test(m.gameName ?? m.name)).map((m) => m.id)) };
        }
      })
      .finally(() => (namesFetch = null));
    return namesFetch;
  };
  if (names) {
    void load();
    return names;
  }
  await load();
  return names ?? { byId: new Map(), pouches: new Set() };
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

/**
 * The check's phases, for the log: one line per check, at info only when it took a while (or with
 * TRIP_TIMING=1, as scripts/bench-trip-view does), else at debug.
 */
function phases() {
  const start = performance.now();
  let last = start;
  const out: Record<string, number> = {};
  return {
    mark(name: string) {
      const now = performance.now();
      out[name] = Math.round(now - last);
      last = now;
    },
    done(meta: Record<string, unknown>) {
      const ms = Math.round(performance.now() - start);
      const rec = { ms, ...out, ...meta };
      if (process.env.TRIP_TIMING === '1' || ms >= SLOW_MS) log.info('trip.view', rec);
      else log.debug('trip.view', rec);
    },
  };
}
/** A check slower than this is logged at info. */
const SLOW_MS = 700;

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
  warn: { ok: boolean; title: string; lines: string[]; fight?: number[]; instance?: true } | null;
  /** A next-trip target is set (lib/tripTarget): the plugin then asks on bank close at any bank. */
  armed: boolean;
}

/** The player's own setup for a trip: saved for it, else saved for its boss picked by hand. */
async function ownSetupFor(userId: number, accountId: number, key: string, ownKeys: readonly string[]): Promise<GearSetup | null> {
  const own = await ownTripSetup(userId, accountId, key);
  const alias = own ? null : ownAlias(key, ownKeys);
  return own ?? (alias ? ownTripSetup(userId, accountId, alias) : null);
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

/** Where the trip has begun (TripContent fightRegions / instance): the plugin takes its warning down there. */
const fightOf = (c: TripContent): { fight?: number[]; instance?: true } => ({ ...(c.fightRegions?.length ? { fight: c.fightRegions } : {}), ...(c.instance ? { instance: true as const } : {}) });

interface Resolved {
  source: TripSource;
  sourceLine: string;
  guide: TripPanelData['guide'];
  /** The setup checked against: the own or guide one, null for the calc. */
  setup: GearSetup | null;
  /** Null: the calc has no monster it knows to work out a setup for. */
  check: TripCheck | null;
}

/** Checks by everything they read (checkKey): a few minutes, a few hundred at most. Owner-only by key. */
const CHECKS = new Map<string, { at: number; p: Promise<Resolved> }>();
const CHECK_TTL = 10 * 60_000;
const CHECK_MAX = 300;
function remember(key: string, p: Promise<Resolved>) {
  CHECKS.delete(key);
  CHECKS.set(key, { at: Date.now(), p });
  for (const k of CHECKS.keys()) {
    if (CHECKS.size <= CHECK_MAX) break;
    CHECKS.delete(k);
  }
}
const checkKey = (parts: unknown[]) => createHash('sha1').update(JSON.stringify(parts)).digest('base64');
/** The gear data a check used: a /staff edit builds a new index, and the old answers stop matching. */
const stamps = new WeakMap<GearIndex, number>();
let stampN = 0;
const gearStamp = (idx: GearIndex) => stamps.get(idx) ?? (stamps.set(idx, ++stampN), stampN);

/** The setup for the trip (own, the guide's best fit, else the calc) and the check against it. */
async function resolveCheck(c: {
  request: Request;
  content: TripContent;
  own: GearSetup | null;
  clanId: number | null;
  viewer: GuideViewer;
  idx: GearIndex;
  state: TripState | null;
  nm: { byId: Map<number, string>; pouches: Set<number> };
  worn: InvItem[];
  inventory: InvItem[];
  bank: InvItem[];
  lootingBag: InvItem[] | undefined;
  t: ReturnType<typeof phases>;
}): Promise<Resolved> {
  const { content, own, viewer, idx, state, nm, worn, inventory, bank, lootingBag, t } = c;
  let setup: GearSetup | null = own;
  let source: TripSource = own ? 'own' : 'calc';
  let sourceLine = own ? 'Checked against your own saved setup' : '';
  let targets = content.targets;
  let guide: TripPanelData['guide'] = null;
  if (content.guide) {
    const g = (await publicGuideBySlug(c.clanId, content.guide).catch(() => null))?.guide;
    if (g && g.status === 'published') {
      guide = { id: g.id, title: g.title.split(' — ')[0] };
      if (!own) {
        const view = await loadGuideView(g, viewer);
        const s = view.block ? guidePick(view.setups, view.defaults, view.openTier) : null;
        if (s && view.block) {
          setup = s.setup;
          source = 'guide';
          targets = setupTargets(s.setup, view.block);
          sourceLine = `Checked against the guide's ${TIERS.find((x) => x.key === s.setup.tier)?.label ?? ''} setup: ${s.setup.name}`;
        }
      }
    }
  }
  if (source === 'calc') sourceLine = calcSourceLine(content);
  t.mark('setup');
  const monsters = targets.map((x) => idx.monster(x)).filter((m): m is Monster => !!m);
  if (!monsters.length && source === 'calc') return { source, sourceLine, guide, setup, check: null };
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
  t.mark('check');
  return { source, sourceLine, guide, setup, check };
}

async function build(request: Request, args: Args, viewer: GuideViewer, note: string | null, t = phases()): Promise<Built> {
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
  t.mark('gear');
  const target = tgt?.target ?? null;
  const armed = !!target;
  // The player's own setups are targets too: a chip each, beside the trips Anvil knows.
  base.options = [...base.options, ...(tgt?.ownKeys ?? []).filter((k) => canonicalKey(k) === k && !TRIP_CONTENT.some((c) => c.key === k)).map(optionOf).filter((o): o is NonNullable<typeof o> => !!o)];
  const snap = viewer.snapshot;
  const worn: InvItem[] = snap?.equipment?.items ?? [];
  const inventory: InvItem[] = snap?.inventory?.items ?? [];
  // A trip region picks its own trip exactly as before; anywhere else (or a shared bank that picks
  // nothing) the next-trip target is checked.
  const asked = args.target && args.target !== 'clear' ? args.target : args.content;
  const picked = contentFromKey(asked ? canonicalKey(asked) : asked);
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
  // The plugin pushed what is held just before asking (args.held) yet the items are older: that push
  // hasn't landed. Still checked against the last items, said so, and no overlay claim off them. A
  // load the plugin didn't push for (a restored view) is items unchanged since their push: current.
  const behind = !!content && !note && args.held === '1' && age > BEHIND_MS;
  if (!content) return { data: { ...withContent, canSave: false }, warn: null, armed };

  const [state, own, nm] = await Promise.all([tripStateForViewer(viewer.userId, viewer.accountId), ownSetupFor(viewer.userId, viewer.accountId, content.key, tgt?.ownKeys ?? []), itemNames()]);
  t.mark('reads');
  const clanId = content.guide ? await pluginClanId(request, args) : null;
  // Everything the setup and the check read, hashed: the same items, setup and state give the same
  // answer, so a bank-close ask after a warm (warmTrip, on the items push) or a repeat is instant.
  const key = checkKey([viewer.userId, viewer.accountId, content.key, clanId, own, worn, inventory, snap.bank?.items ?? [], snap.lootingBag?.items ?? null, state, viewer.levels, viewer.prefs ? [...viewer.prefs.skipped.keys()].sort() : null, gearStamp(idx)]);
  const hit = CHECKS.get(key);
  const fresh = hit && Date.now() - hit.at < CHECK_TTL ? hit : null;
  if (!fresh) {
    const p = resolveCheck({ request, content, own, clanId, viewer, idx, state, nm, worn, inventory, bank: snap.bank?.items ?? [], lootingBag: snap.lootingBag?.items, t });
    remember(key, p);
    p.catch(() => CHECKS.delete(key));
  }
  const { source, sourceLine, guide, check } = await (fresh ?? CHECKS.get(key)!).p;
  if (fresh) t.mark('cached');
  if (!check) return { data: { ...withContent, status: 'no-targets', guide, hasOwn: !!own, canSave: true }, warn: null, armed };
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
  const refused = args.held ? HELD_WHY[args.held] : undefined;
  if (refused) data.sourceLine = `${refused}: this is from what Anvil last saw`;
  else if (behind) data.sourceLine = `${sourceLine}. Your newest items haven't arrived: this is from what Anvil last saw`;
  return { data, warn: behind || refused ? null : { ...tripWarn(content.short, check), ...fightOf(content) }, armed };
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
  const t = phases();
  const viewer = await tripViewer(request);
  t.mark('viewer');
  if (viewer === 'not-yours') return { ...message('This character isn’t one of yours on Anvil, so there is nothing of yours to check.'), warn: null, armed: false };
  const { data, warn, armed } = await build(request, args, viewer, note, t);
  const ui = tripPanelUi(data);
  t.mark('ui');
  t.done({ why: args.why ?? null, content: data.content?.key ?? null, source: data.source, status: data.status, bank: viewer.snapshot?.bank?.items.length ?? 0 });
  return { ui, warn, armed };
}

/** Accounts with a warm running: one at a time each, however fast the pushes come. */
const warming = new Set<number>();

/**
 * An items push with the bank open in a trip region (or with a next-trip target set): work the check
 * out now, so the bank-close ask finds it done (CHECKS) when nothing changed since. Owner-only like
 * the view itself; never shown, never logged beyond the timing. Run after the push has answered.
 */
export async function warmTrip(request: Request, region: number | null): Promise<void> {
  const viewer = await tripViewer(request).catch(() => null);
  if (!viewer || viewer === 'not-yours' || !viewer.userId || !viewer.accountId || warming.has(viewer.accountId)) return;
  warming.add(viewer.accountId);
  try {
    const t = phases();
    const { data } = await build(request, { ...(region != null ? { region: String(region) } : {}), why: 'warm', clan: '1' }, viewer, null, t);
    t.done({ why: 'warm', content: data.content?.key ?? null, status: data.status });
  } catch {
    // A warm that fails costs nothing: the ask works it out itself.
  } finally {
    warming.delete(viewer.accountId);
  }
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
    // The same trip's setup saved for the boss picked by hand goes too.
    const alias = ownAlias(content.key, await ownTripKeys(viewer.accountId));
    if (alias) await forgetOwnTripSetup(viewer.userId, viewer.accountId, alias);
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
