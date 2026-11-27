// The data behind the pre-trip check (pluginUi/tripUi): view 'trip' and the actions 'trip-save',
// 'trip-forget', 'trip-raid' (the ToA raid level, lib/tripRaidLevel) and 'trip-plan' (the loadout
// plan, lib/tripLoadout). The plugin loads the view
// with args {region, why: 'bank-close' | 'manual'} when the bank closes in one of the config's
// `tripRegions` (lib/tripContent), or when the player asks; the answer is the usual {ui} plus `warn` for its overlay:
//
//   warn: { ok, title: "ToA · 2 problems", lines: ["No stab weapon: Kephri (Fang in bank)", …] }
//         { ok: true, title: "✓ Ready for ToA", lines: [] }
//         null — no trip matches here, or nothing to check against (sharing off, items too old)
//
// Everything read here is the token owner's own (lib/playerItems snapshotForViewer and
// tripStateForViewer check the account is theirs); nothing about another player's bank is ever shown.

import { tripEnabled } from '@/lib/serverInfo';
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
import { checkTrip, heldQuiverAmmo, isSpecWeapon, raidScaled, setupFromHeld, supplyKind, tripWarn, usableHeld, type TripCheck, type TripSource } from '@/lib/tripCheck';
import { layoutBanks, tripLayout, type TripLayout } from '@/lib/tripLayout';
import { ownStats, setupResult, withSlot } from '@/lib/gearNow';
import { calcSourceLine, contentForRegion, contentFromKey, TRIP_CONTENT, type TripContent } from '@/lib/tripContent';
import { tripRegions } from '@/lib/guideAreas';
import { clanSharedSetups, createTripSetup, forgetOwnTripSetup, listOwnSetups, saveOwnTripSetup, type ClanSetup, type SavedSetup } from '@/lib/tripSetups';
import { clanPickId, cleanRaidLevel, isClanPick, RAID_LEVELS, raidLevelFor, saveRaidLevel, saveTripCa, saveTripPlan, saveTripSetupPick, tripCaFor, tripPlanFor, tripSetupPickFor, type SetupPick } from '@/lib/tripRaidLevel';
import { casFor, type CaOption } from '@/lib/loadout/caRules';
import { cleanPlan, hasProfile, loadoutFor, PLAN_PRESETS, withPlan, type TripPlan } from '@/lib/tripLoadout';
import type { Preset } from '@/lib/loadout/types';
import { canonicalKey, ownAlias, targetWhy, type Target } from '@/lib/tripTarget';
import { clearTarget, currentTarget, lockTarget, ownTripKeys, pickTarget, unlockTarget } from '@/lib/tripTargetStore';
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

type Names = { byId: Map<number, string>; pouches: Set<number>; byName?: Map<string, number> };
let names: (Names & { from: MappingItem[] }) | null = null;
let namesFetch: Promise<unknown> | null = null;
/** The game's item names. Once known, a check never waits on the mapping's refetch (a second or more). */
async function itemNames(): Promise<Names> {
  const load = () => {
    namesFetch ??= getItemMapping()
      .catch(() => [] as MappingItem[])
      .then((mapping) => {
        if (names?.from !== mapping && (mapping.length || !names)) {
          names = { from: mapping, byId: new Map(mapping.map((m) => [m.id, m.gameName ?? m.name])), byName: new Map([...mapping].reverse().map((m) => [(m.gameName ?? m.name).toLowerCase(), m.id])), pouches: new Set(mapping.filter((m) => /^(divine )?rune pouch\b/i.test(m.gameName ?? m.name)).map((m) => m.id)) };
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
  /** The setup checked, with the player's picks: what 'trip-save' with `swap` keeps. */
  setup?: GearSetup;
}

/** The player's own setups for a trip: saved for it, and saved for its boss picked by hand. */
async function ownSetupsFor(userId: number, accountId: number, key: string, ownKeys: readonly string[]): Promise<SavedSetup[]> {
  const alias = ownAlias(key, ownKeys);
  const [own, aliased] = await Promise.all([listOwnSetups(userId, accountId, key), alias ? listOwnSetups(userId, accountId, alias) : Promise.resolve([])]);
  return [...own, ...aliased];
}

/** The setup the check uses: the dropdown's pick ('anvil': none of them), else the trip's default. */
function pickedSetup(setups: readonly SavedSetup[], pick: SetupPick | null): SavedSetup | null {
  if (pick === 'anvil' || isClanPick(pick)) return null;
  return (pick != null ? setups.find((s) => s.id === pick) : null) ?? setups.find((s) => s.isDefault) ?? setups[0] ?? null;
}

/** "8 switches, 4 food, 6 potions, 4 free slots": what the laid-out inventory holds, counted. */
function packSummary(l: TripLayout | null | undefined, idx: GearIndex, nameOf: (id: number) => string): string {
  if (!l) return '';
  const held = l.inventory.filter((x): x is NonNullable<typeof x> => !!x);
  let switches = 0;
  let food = 0;
  let pots = 0;
  for (const it of held) {
    const g = idx.item(it.id);
    const name = nameOf(it.id);
    if (g && !g.hid && g.s && !/\(\d\)$/.test(name)) switches++;
    else if (supplyKind(name) === 'Food') food++;
    else if (/\(\d\)$/.test(name)) pots++;
  }
  const free = 28 - held.length;
  const n = (k: number, one: string, many: string) => (k ? `${k} ${k === 1 ? one : many}` : '');
  const parts = [n(switches, 'switch', 'switches'), n(food, 'food', 'food'), n(pots, 'potion', 'potions'), `${free} free slot${free === 1 ? '' : 's'}`].filter(Boolean);
  return `${parts.join(', ')}.`;
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
  else if (args.lock === '1' && args.target) await lockTarget(viewer.userId, viewer.accountId, args.target, await ownTripKeys(viewer.accountId));
  else if (args.lock === '0') await unlockTarget(viewer.userId, viewer.accountId);
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
  /** The setup as the game lays it out (lib/tripLayout), and the names its tips use. */
  layout?: TripLayout | null;
  names?: Record<number, string>;
  /** The monsters it was checked against (for an adjusted setup's DPS). */
  monsters?: Monster[];
  /** The loadout engine's plan (a trip with a boss profile, no own or guide setup). */
  plan?: TripPlan;
  /** What the CA picked changed in the engine's loadout, one line (lib/loadout/caRules). */
  caLine?: string | null;
}

/** What a check reads besides the setup, kept so an adjusted setup is checked the same way. */
interface CheckCtx {
  content: TripContent;
  viewer: GuideViewer;
  idx: GearIndex;
  state: TripState | null;
  nm: Names;
  worn: InvItem[];
  inventory: InvItem[];
  bank: InvItem[];
  lootingBag: InvItem[] | undefined;
  /** ToA's raid level (lib/tripRaidLevel); null for any other trip. */
  raidLevel: number | null;
}

/** The check of `setup` (null: the calc) and its layout. */
function runCheck(c: CheckCtx, setup: GearSetup | null, source: TripSource, monsters: Monster[], plan?: TripPlan): Pick<Resolved, 'check' | 'layout' | 'names'> {
  const { content, viewer, idx, state, nm, worn, inventory, bank, lootingBag } = c;
  const heldIds = [...worn, ...inventory, ...bank, ...(lootingBag ?? [])].map((i) => i.id);
  const setupIds = setup ? [...Object.values(setup.gear), ...Object.values(setup.alts ?? {}).flat(), ...(setup.inventory ?? []).filter((x): x is InvItem => !!x).map((x) => x.id)].filter((x): x is number => typeof x === 'number') : [];
  const needs = equivalentsFor([...heldIds, ...setupIds], 'needs');
  const holds = equivalentsFor(heldIds, 'holds');
  const nameOf = (id: number) => nm.byId.get(id) ?? idx.item(id)?.n ?? baseItem(id)?.name ?? `Item ${id}`;
  const isRunePouch = (id: number) => nm.pouches.has(id);
  const input = { content, setup, source, monsters, worn, inventory, bank, lootingBag, state, levels: viewer.levels, idx, needs, holds, nameOf, isRunePouch, raidLevel: c.raidLevel, prefs: viewer.prefs ? { skipped: new Set(viewer.prefs.skipped.keys()) } : {} };
  const checked: TripCheck = checkTrip(input);
  const check = plan ? withPlan(checked, plan) : checked;
  // Holding X counts as X's forms and upgrades (as the check reads it).
  const wide = (list: readonly InvItem[]) => {
    const raw = new Set(list.map((i) => i.id));
    const all = new Set<number>();
    for (const id of raw) for (const x of [id, ...holds(id)]) all.add(x);
    return (id: number) => all.has(id) || needs(id).some((x) => raw.has(x));
  };
  const carries = wide([...worn, ...inventory]);
  const owns = wide([...worn, ...inventory, ...bank, ...(lootingBag ?? [])]);
  const slotOfId = (id: number) => {
    const it = idx.item(id) ?? holds(id).map((x) => idx.item(x)).find(Boolean);
    return it ? (it.s === '2h' ? 'weapon' : it.s) : null;
  };
  const isSpec = (id: number) => isSpecWeapon(idx.item(id)?.n ?? nameOf(id));
  const quiverAmmo = heldQuiverAmmo(input);
  const isQuiver = (id: number) => [nameOf(id), ...holds(id).map((x) => idx.item(x)?.n ?? '')].some((n) => /dizana's quiver/i.test(n));
  const layout = tripLayout({ setup, rows: check.rows, worn, inventory, bank, lootingBag, state, carries, owns, slotOf: slotOfId, nameOf, isRunePouch, isSpec, quiverAmmo });
  // The bank filters off the same layout the card draws, so "Show the N" shows those N.
  const banks = layoutBanks(layout, { bank, holds, needs, nameOf, isRunePouch, isSpec, slotOf: slotOfId, isQuiver });
  check.layouts = { missing: banks.missing, setup: banks.setup };
  check.bank = banks.bank;
  const ids = new Set<number>([...Object.values(layout.worn).map((x) => x.id), ...layout.inventory.filter((x): x is NonNullable<typeof x> => !!x).map((x) => x.id), ...layout.pouch.map((x) => x.id), ...(layout.quiver ? [layout.quiver.id] : [])]);
  return { check, layout, names: Object.fromEntries([...ids].map((id) => [id, nameOf(id)])) };
}

/** "head:26382,weapon:26219" → {head: 26382, weapon: 26219}: the player's own picks over the setup. */
export function parseSwaps(s: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (s ?? '').split(',').slice(0, 14)) {
    const [slot, id] = part.split(':');
    if (/^[a-z]{3,7}$/.test(slot ?? '') && /^\d{1,6}$/.test(id ?? '')) out[slot] = Number(id);
  }
  return out;
}
export const swapsArg = (s: Record<string, number>) => Object.entries(s).map(([k, v]) => `${k}:${v}`).join(',');

/** The setup the check used, as one the player can adjust and save: the calc's from its layout. */
function baseSetup(r: Resolved, content: TripContent, levels: Record<string, number> | null): GearSetup {
  if (r.setup) return r.setup;
  const lv = (k: string) => (typeof levels?.[k] === 'number' ? levels[k] : 80);
  const l = r.layout;
  return {
    tier: 'advanced',
    name: `My ${content.short} setup`,
    style: 0,
    stats: { attack: lv('attack'), strength: lv('strength'), ranged: lv('ranged'), magic: lv('magic') },
    gear: Object.fromEntries(Object.entries(l?.worn ?? {}).map(([k, v]) => [k, v.id])),
    inventory: (l?.inventory ?? []).map((x) => (x ? (x.q ? { id: x.id, q: x.q } : { id: x.id }) : null)),
  };
}

/** The setup with the player's picks in place (a two-hander takes the shield slot with it). */
function adjusted(base: GearSetup, swaps: Record<string, number>, idx: GearIndex): GearSetup {
  let s: GearSetup = { ...base, gear: { ...base.gear } };
  for (const [slot, id] of Object.entries(swaps)) s = withSlot(s, slot, id, idx);
  return s;
}

/** Mean DPS of a setup over the trip's monsters, with the player's own levels. */
function meanDps(s: GearSetup, monsters: Monster[], idx: GearIndex, levels: Record<string, number> | null): number {
  const mine = { ...s, stats: ownStats(s.stats, levels).stats };
  const xs = monsters.map((m) => setupResult(mine, m, idx)?.dps ?? 0);
  return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0;
}

/** Owned items for `slot`, best first by mean DPS against the trip (the current one marked). */
function alternatives(slot: string, setup: GearSetup, monsters: Monster[], c: CheckCtx): NonNullable<TripPanelData['alts']> {
  const { idx, viewer, nm } = c;
  const nameOf = (id: number) => nm.byId.get(id) ?? idx.item(id)?.n ?? `Item ${id}`;
  const carried = new Set([...c.worn, ...c.inventory].map((i) => i.id));
  const pool = [...new Set([...c.worn, ...c.inventory, ...c.bank, ...(c.lootingBag ?? [])].map((i) => i.id))].filter((id) => {
    const it = idx.item(id);
    return !!it && !it.hid && (it.s === '2h' ? 'weapon' : it.s) === slot && usableHeld(it.n);
  });
  const cur = setup.gear[slot] ?? null;
  const base = monsters.length ? meanDps(setup, monsters, idx, viewer.levels) : 0;
  const dpsOf = (x: GearSetup) => (monsters.length ? meanDps(x, monsters, idx, viewer.levels) : 0);
  let rows: { id: number; name: string; dps: number; here: boolean; current: boolean; ammo?: number }[] = [...new Set([...(cur != null ? [cur] : []), ...pool])].map((id) => ({ id, name: nameOf(id), dps: dpsOf(withSlot(setup, slot, id, idx)), here: carried.has(id), current: id === cur }));
  // A weapon is worth what it fires: the likeliest weapons again with each owned ammo (the best kept,
  // and taken with the weapon when picked), so a bow isn't judged on a crossbow's bolts.
  if (slot === 'weapon' && monsters.length) {
    const ammo = [...new Set([...c.worn, ...c.inventory, ...c.bank, ...(c.lootingBag ?? [])].map((i) => i.id))]
      .map((id) => idx.item(id))
      .filter((it): it is NonNullable<typeof it> => !!it && !it.hid && it.s === 'ammo' && usableHeld(it.n))
      .sort((a, b) => b.b[6] - a.b[6]);
    rows.sort((a, b) => b.dps - a.dps);
    rows = rows.map((x, i) => {
      const wi = idx.item(x.id);
      const fits = wi?.c === 'Bow' && !/crystal bow|bow of faerdhinen|craw's bow|webweaver/i.test(wi.n) ? /arrow|brutal/i : wi?.c === 'Crossbow' ? (/ballista/i.test(wi.n) ? /javelin/i : /bolt/i) : null;
      if (i >= 24 || x.current || !fits) return x;
      const w = withSlot(setup, slot, x.id, idx);
      let best = x;
      for (const a of ammo.filter((y) => fits.test(y.n))) {
        const d = dpsOf({ ...w, gear: { ...w.gear, ammo: a.id } });
        if (d > best.dps + 1e-9) best = { ...x, dps: d, ammo: a.id };
      }
      return best;
    });
  }
  rows.sort((a, b) => b.dps - a.dps || a.name.localeCompare(b.name));
  return {
    slot,
    rows: rows.slice(0, 10).map((x) => ({ id: x.id, name: x.name, here: x.here, current: x.current, ...(x.ammo && x.ammo !== setup.gear.ammo ? { ammo: x.ammo, ammoName: nameOf(x.ammo) } : {}), delta: monsters.length && !x.current ? `${x.dps >= base ? '+' : ''}${(x.dps - base).toFixed(1)} DPS` : '' })),
    more: Math.max(0, rows.length - 10),
  };
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
  nm: Names;
  worn: InvItem[];
  inventory: InvItem[];
  bank: InvItem[];
  lootingBag: InvItem[] | undefined;
  raidLevel: number | null;
  /** The loadout plan picked for a trip with a boss profile (lib/tripLoadout). */
  preset: Preset | null;
  /** The Combat Achievement picked for the engine's loadout, or null. */
  ca: number | null;
  t: ReturnType<typeof phases>;
}): Promise<Resolved> {
  const { content, own, viewer, idx, t } = c;
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
  const monsters = targets.map((x) => idx.monster(x)).filter((m): m is Monster => !!m).map((m) => raidScaled(m, c.raidLevel));
  // A trip with a boss profile: the loadout engine's setup for the plan picked, checked like a
  // guide's (the doll its worn loadout, the inventory its switches and supplies).
  let plan: TripPlan | undefined;
  let caLine: string | null = null;
  if (source === 'calc' && hasProfile(content.key)) {
    const holds = equivalentsFor([...c.worn, ...c.inventory, ...c.bank, ...(c.lootingBag ?? [])].map((i) => i.id), 'holds');
    const nameOf = (id: number) => c.nm.byId.get(id) ?? idx.item(id)?.n ?? baseItem(id)?.name ?? `Item ${id}`;
    const got = loadoutFor({ contentKey: content.key, preset: c.preset, idx, worn: c.worn, inventory: c.inventory, bank: c.bank, lootingBag: c.lootingBag, state: c.state, levels: viewer.levels, raidLevel: c.raidLevel, nameOf, holds, isRunePouch: (id) => c.nm.pouches.has(id), idOfName: (n) => c.nm.byName?.get(n.toLowerCase()) ?? null, ca: c.ca });
    if (got) {
      setup = got.setup;
      plan = got.plan;
      caLine = got.caLine;
      sourceLine = got.sourceLine;
      t.mark('loadout');
    }
  }
  if (!monsters.length && source === 'calc' && !setup) return { source, sourceLine, guide, setup, check: null, monsters };
  const out = runCheck(c, setup, source, monsters, plan);
  t.mark('check');
  return { source, sourceLine, guide, setup, monsters, plan, caLine, ...out };
}

/** The card's short source line: "Your Solo shadow setup", "Anvil's Experienced loadout from your bank". */
function shortSource(source: TripSource, setupName: string | null, preset: string | null, line: string): string {
  if (source === 'own' && setupName) return `Your ${setupName} setup`;
  const plan = preset ? PLAN_PRESETS.find((p) => p.key === preset)?.label : null;
  if (plan) return `Anvil’s ${plan} loadout from your bank`;
  return line;
}

async function build(request: Request, args: Args, viewer: GuideViewer, note: string | null, t = phases()): Promise<Built> {
  const region = regionOf(args);
  const regions = await tripRegions();
  const regionName = region != null ? regions[region]?.name ?? null : null;
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
  const atRegion = !picked && region != null ? contentForRegion(region, new Set([...worn, ...inventory].map((i) => i.id)), regions) : null;
  // A locked trip (lib/tripTarget 'lock') is checked at every bank: another boss's bank doesn't switch it.
  const locked = target?.source === 'lock' ? contentFromKey(target.key) : null;
  const fromRegion = locked ? null : atRegion;
  const content: TripContent | null = picked ?? fromRegion ?? contentFromKey(target?.key);
  const isTarget = !!content && !!target && content.key === target.key && !fromRegion;
  const withContent: TripPanelData = {
    ...base,
    content: content ? { key: content.key, name: content.name, short: content.short } : null,
    fromRegion: !!fromRegion,
    target: target ? { key: target.key, short: contentFromKey(target.key)?.short ?? target.key, why: targetWhy(target) } : null,
    fromTarget: isTarget,
    lock: locked && content?.key === locked.key ? { at: atRegion && atRegion.key !== locked.key ? atRegion.short : null } : null,
  };
  if (!viewer.accountId || (!snap?.equipment && !snap?.inventory)) return { data: { ...withContent, status: 'off' }, warn: null, armed };
  // The newest push of ANY container: the plugin sends worn and inventory only when they change, so a
  // bank push (or the looting bag) proves the worn/inventory rows it didn't resend are still current.
  const readAt = [snap.equipment?.readAt, snap.inventory?.readAt, snap.bank?.readAt, snap.lootingBag?.readAt].filter((x): x is string => !!x).sort().pop() ?? '';
  const age = Date.now() - Date.parse(readAt);
  if (!Number.isFinite(age) || age > STALE_MS) return { data: { ...withContent, status: 'stale', age: Number.isFinite(age) ? ago(age) : undefined }, warn: null, armed };
  // After a save or forget (`note`) no push came first: the items are what the action used.
  // The plugin pushed what is held just before asking (args.held) yet the items are older: that push
  // hasn't landed. Still checked against the last items, said so, and no overlay claim off them. A
  // load the plugin didn't push for (a restored view) is items unchanged since their push: current.
  const behind = !!content && !note && args.held === '1' && age > BEHIND_MS;
  if (!content) return { data: { ...withContent, canSave: false }, warn: null, armed };

  const [state, ownRows, setupPick, nm, raidLevel, planPref, clanRows, caPref] = await Promise.all([
    tripStateForViewer(viewer.userId, viewer.accountId),
    ownSetupsFor(viewer.userId, viewer.accountId, content.key, tgt?.ownKeys ?? []),
    tripSetupPickFor(viewer.accountId, content.key),
    itemNames(),
    // ToA's bosses scale with the raid level the player set (lib/tripRaidLevel).
    content.key === 'toa' ? raidLevelFor(viewer.accountId) : Promise.resolve(null),
    // The loadout plan picked for a trip the engine has a profile for (lib/tripLoadout).
    hasProfile(content.key) ? tripPlanFor(viewer.accountId, content.key) : Promise.resolve(null),
    // Clanmates' setups shared with the clan: the clan is the played character's own member seat.
    clanSharedSetups(viewer.userId, viewer.accountId, [content.key]),
    hasProfile(content.key) ? tripCaFor(viewer.accountId, content.key) : Promise.resolve(null),
  ]);
  const preset = hasProfile(content.key) ? cleanPlan(planPref) : null;
  const clanRow: ClanSetup | null = isClanPick(setupPick) ? (clanRows.find((r) => r.id === clanPickId(setupPick)) ?? null) : null;
  // A clan pick that is no longer shared falls back to the trip's default.
  const ownRow = clanRow ? null : pickedSetup(ownRows, isClanPick(setupPick) ? null : setupPick);
  const own = clanRow?.setup ?? ownRow?.setup ?? null;
  // "Going for a CA?": the player's undone loadout-changing tasks, with Anvil's loadout only.
  const caOptions: CaOption[] = hasProfile(content.key) && !own ? casFor(content.key, viewer.cas) : [];
  const ca = caPref != null && caOptions.some((o) => o.id === caPref) ? caPref : null;
  // The Setup dropdown: the saved setups by name, the clan's, the one in use (or Anvil's loadout).
  const setupList: Pick<TripPanelData, 'setups' | 'clanSetups' | 'setupSel' | 'setupName'> = {
    setups: ownRows.map((r) => ({ id: r.id, name: r.name || r.setup.name })),
    clanSetups: clanRows.map((r) => ({ id: r.id, name: r.name, rsn: r.rsn })),
    setupSel: clanRow ? `c:${clanRow.id}` : ownRow ? ownRow.id : 'anvil',
    setupName: clanRow ? clanRow.name : ownRow ? ownRow.name || ownRow.setup.name : null,
  };
  t.mark('reads');
  const clanId = content.guide ? await pluginClanId(request, args) : null;
  // Everything the setup and the check read, hashed: the same items, setup and state give the same
  // answer, so a bank-close ask after a warm (warmTrip, on the items push) or a repeat is instant.
  // Each container's readAt too: a reload after any push is worked out from that push (its items are
  // the key already; the stamps make it so even when a push resent the same items).
  const key = checkKey([viewer.userId, viewer.accountId, content.key, clanId, own, worn, inventory, snap.bank?.items ?? [], snap.lootingBag?.items ?? null, state, viewer.levels, viewer.prefs ? [...viewer.prefs.skipped.keys()].sort() : null, gearStamp(idx), raidLevel, preset, ca, [snap.equipment?.readAt, snap.inventory?.readAt, snap.bank?.readAt, snap.lootingBag?.readAt]]);
  const hit = CHECKS.get(key);
  const fresh = hit && Date.now() - hit.at < CHECK_TTL ? hit : null;
  if (!fresh) {
    const p = resolveCheck({ request, content, own, clanId, viewer, idx, state, nm, worn, inventory, bank: snap.bank?.items ?? [], lootingBag: snap.lootingBag?.items, raidLevel, preset, ca, t });
    remember(key, p);
    p.catch(() => CHECKS.delete(key));
  }
  const got = await (fresh ?? CHECKS.get(key)!).p;
  if (fresh) t.mark('cached');
  const { source, guide } = got;
  let { sourceLine, check, layout, names } = got;
  if (clanRow) sourceLine = `Checked against ${clanRow.name}, shared by ${clanRow.rsn} in your clan`;
  if (!check) return { data: { ...withContent, ...setupList, status: 'no-targets', guide, hasOwn: !!own, canSave: true }, warn: null, armed };
  // The player's own picks (a slot clicked, an alternative taken): the same check of the setup with them.
  const ctx: CheckCtx = { content, viewer, idx, state, nm, worn, inventory, bank: snap.bank?.items ?? [], lootingBag: snap.lootingBag?.items, raidLevel };
  const swaps = parseSwaps(args.swap);
  const hasPicks = Object.keys(swaps).length > 0;
  const from = baseSetup(got, content, viewer.levels);
  const setup = hasPicks ? adjusted(from, swaps, idx) : from;
  if (hasPicks) {
    ({ check, layout, names } = runCheck(ctx, setup, source === 'own' ? 'own' : 'guide', got.monsters ?? [], got.plan));
    sourceLine = `Your picks over ${source === 'own' ? 'your saved setup' : source === 'guide' ? "the guide's setup" : got.plan ? 'the plan worked out from your bank' : 'the setup worked out from your bank'}`;
    t.mark('adjusted');
  }
  const alts = args.alt && /^[a-z]{3,7}$/.test(args.alt) ? alternatives(args.alt, setup, got.monsters ?? [], ctx) : null;
  const data: TripPanelData = {
    raid: raidLevel != null ? { level: raidLevel, levels: RAID_LEVELS } : null,
    plan: got.plan ? { preset: got.plan.preset, presets: got.plan.presets, blurb: got.plan.blurb } : null,
    ca: got.plan && caOptions.length ? { options: caOptions.map((o) => ({ id: o.id, name: o.name, does: o.does })), sel: ca, line: got.caLine ?? null } : null,
    ...withContent,
    ...setupList,
    source,
    sourceLine,
    sourceShort: clanRow ? `${clanRow.name}, ${clanRow.rsn}’s clan setup` : shortSource(source, setupList.setupName ?? null, got.plan?.preset ?? null, sourceLine),
    summary: packSummary(layout, idx, (id) => names?.[id] ?? nm.byId.get(id) ?? idx.item(id)?.n ?? ''),
    guide,
    check: check!,
    layout,
    names,
    swap: swapsArg(swaps),
    alts,
    status: 'ready',
    checkedAt: readAt ? readAt.slice(11, 16) : null,
    hasOwn: !!own,
    canSave: worn.length + inventory.length > 0,
  };
  const refused = args.held ? HELD_WHY[args.held] : undefined;
  if (refused) data.sourceLine = data.sourceShort = data.sourceNote = `${refused}: this is from what Anvil last saw`;
  else if (behind) data.sourceLine = data.sourceShort = data.sourceNote = `${data.sourceShort}. Your newest items haven't arrived: this is from what Anvil last saw`;
  else if (hasPicks) data.sourceShort = data.sourceNote = sourceLine;
  // Adjusting in the panel is not a bank-close answer: the overlay is left out of it.
  const quiet = behind || !!refused || hasPicks || !!alts;
  return { data, warn: quiet ? null : { ...tripWarn(content.short, check!), ...fightOf(content) }, armed, setup };
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
  if (!tripEnabled()) return { ...message('The pre-trip check is coming soon.'), warn: null, armed: false };
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

/** What the player wears and carries now, as a setup to save (null: nothing held). */
async function heldSetup(viewer: GuideViewer & { userId: number; accountId: number }, name: string): Promise<GearSetup | null> {
  const snap = viewer.snapshot;
  const worn = snap?.equipment?.items ?? [];
  const inventory = snap?.inventory?.items ?? [];
  if (!worn.length && !inventory.length) return null;
  const [idx, state, nm] = await Promise.all([effectiveGearIndex(), tripStateForViewer(viewer.userId, viewer.accountId), itemNames()]);
  const holds = equivalentsFor([...worn, ...inventory].map((i) => i.id), 'holds');
  return setupFromHeld(name, worn, inventory, state, idx, holds, viewer.levels, (id) => nm.pouches.has(id));
}

/**
 * The card's actions: 'trip-setup' (the Setup dropdown: a saved setup, 'anvil' for Anvil's loadout,
 * 'new' to save what is worn and carried as a new setup), 'trip-save' (the selected setup gets what
 * is worn and carried, or the card's setup with the player's picks; with Anvil's loadout shown, that
 * loadout becomes a new setup), 'trip-forget', 'trip-raid' and 'trip-plan'.
 */
export async function tripAct(request: Request, act: string, args: Args, fields: Args = {}): Promise<View | null> {
  if (act !== 'trip-save' && act !== 'trip-setup' && act !== 'trip-forget' && act !== 'trip-raid' && act !== 'trip-plan' && act !== 'trip-ca') return null;
  if (!tripEnabled()) return message('The pre-trip check is coming soon.');
  const viewer = await tripViewer(request);
  if (viewer === 'not-yours' || !viewer.userId || !viewer.accountId) return message('Sign in with the plugin, on your own character, to save a setup.');
  const me = viewer as GuideViewer & { userId: number; accountId: number };
  const rl = await rateLimit(request, `plugin-trip-setups:${viewer.userId}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return message('That’s a lot of changes, give it a minute.');
  const content = contentFromKey(args.content);
  if (!content) return tripView(request, args);
  // Back to the check as it was asked for: the region's own trip stays "picked from" the region.
  const region = regionOf(args);
  const again: Args = { ...(region != null ? { region: String(region) } : {}), why: 'manual', ...(region != null && (await tripRegions())[region]?.content === content.key ? {} : { content: content.key }) };
  if (act === 'trip-raid') {
    // The ToA raid level the check assumes, remembered for this character.
    const level = cleanRaidLevel(args.rl);
    if (level != null) await saveRaidLevel(viewer.accountId, level);
    // The player's picks over the setup stay.
    return tripView(request, { ...again, ...(args.swap ? { swap: args.swap } : {}) });
  }
  if (act === 'trip-plan') {
    // The loadout plan (Learner / Experienced / Max DPS), remembered per character and trip. Picks
    // over the old plan's setup don't carry over: the plan is a new setup.
    const plan = cleanPlan(args.plan);
    if (plan && hasProfile(content.key)) await saveTripPlan(viewer.accountId, content.key, plan);
    return tripView(request, again);
  }
  if (act === 'trip-ca') {
    // "Going for a CA?": the task picked, remembered per character and trip; 'none' clears it. Only a
    // task the rules know for this boss (fields come from the panel's select, args from chips).
    const v = fields.ca ?? args.ca ?? '';
    const id = Number(v);
    if (v === 'none' || v === '') await saveTripCa(viewer.accountId, content.key, null);
    else if (Number.isInteger(id) && hasProfile(content.key) && casFor(content.key, null).some((o) => o.id === id)) await saveTripCa(viewer.accountId, content.key, id);
    return tripView(request, again);
  }
  const ownKeys = await ownTripKeys(viewer.accountId);
  const mine = await ownSetupsFor(viewer.userId, viewer.accountId, content.key, ownKeys);
  if (act === 'trip-forget') {
    const sid = Number(args.sid);
    const row = mine.find((r) => r.id === sid) ?? pickedSetup(mine, null);
    if (row) await forgetOwnTripSetup(viewer.userId, viewer.accountId, row.content, row.id);
    return tripView(request, again, row ? `Forgot your ${row.name} setup.` : null);
  }
  /** A new setup from `setup`, picked in the dropdown. */
  const asNew = async (setup: GearSetup, said: string): Promise<View> => {
    const made = await createTripSetup(me.userId, me.accountId, content.key, content.short, setup);
    if (!made) return tripView(request, again, `You have ${mine.length} ${content.short} setups, the most one trip keeps. Delete one on the site first.`);
    await saveTripSetupPick(me.accountId, content.key, made.id);
    return tripView(request, again, `${said} as ${made.name}. Rename it on the site.`);
  };
  if (act === 'trip-setup') {
    const v = fields.setup ?? args.setup ?? '';
    if (v === 'anvil') {
      await saveTripSetupPick(viewer.accountId, content.key, 'anvil');
      return tripView(request, again);
    }
    if (v === 'clan-head') return tripView(request, again);
    if (isClanPick(v)) {
      // A clanmate's shared setup, read-only: checked against, never written to. Re-read through the clan.
      const [row] = await clanSharedSetups(me.userId, me.accountId, [content.key], clanPickId(v));
      if (row) await saveTripSetupPick(me.accountId, content.key, v);
      return tripView(request, again, row ? null : 'That setup isn’t shared with your clan any more.');
    }
    if (v === 'new') {
      // With a clanmate's setup picked, "Save current as new" copies it into your own.
      const prev = await tripSetupPickFor(me.accountId, content.key);
      if (isClanPick(prev)) {
        const [row] = await clanSharedSetups(me.userId, me.accountId, [content.key], clanPickId(prev));
        if (row) return asNew({ ...row.setup, tier: 'advanced' }, `Copied ${row.name} from ${row.rsn}`);
      }
      const held = await heldSetup(me, `My ${content.short} setup`);
      return held ? asNew(held, 'Saved what you wear and carry') : tripView(request, again, 'Nothing worn or packed to save yet.');
    }
    const row = mine.find((r) => r.id === Number(v));
    if (row) await saveTripSetupPick(viewer.accountId, content.key, row.id);
    return tripView(request, again);
  }
  // 'trip-save'. The selected saved setup (sid), else Anvil's loadout was shown.
  const sid = Number(args.sid);
  const into = Number.isInteger(sid) && sid > 0 ? mine.find((r) => r.id === sid) ?? null : null;
  if (!into || args.swap) {
    // The card's setup (with the player's picks): Anvil's loadout becomes a new setup, picks go into the selected one.
    const built = await build(request, { ...again, ...(args.swap ? { swap: args.swap } : {}) }, viewer, null);
    if (built.setup) {
      const setup: GearSetup = { ...built.setup, tier: 'advanced' };
      if (!into) return asNew(setup, args.swap ? 'Saved this setup with your picks' : isClanPick(await tripSetupPickFor(me.accountId, content.key)) ? 'Copied the clan setup' : 'Saved Anvil’s loadout');
      await saveOwnTripSetup(viewer.userId, viewer.accountId, into.content, setup, into.id);
      return tripView(request, again, `Saved your picks into ${into.name}.`);
    }
    if (!into) return tripView(request, again, 'Nothing to save yet.');
  }
  const held = await heldSetup(me, into.name);
  if (!held) return tripView(request, again, 'Nothing worn or packed to save yet.');
  await saveOwnTripSetup(viewer.userId, viewer.accountId, into.content, held, into.id);
  return tripView(request, again, `Saved what you wear and carry into ${into.name}.`);
}
