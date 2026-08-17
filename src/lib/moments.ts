import npcDrops from '@/data/npcDrops.json';
import skillPets from '@/data/skillPets.json';
import { BOSSES } from '@/lib/constants';
import { clogPageItems, clogPageNames } from '@/lib/clogDataset';

/**
 * What counts as a moment, and which week or board it belongs to.
 *
 * THE PLUGIN DOESN'T DECIDE ANY OF THIS. It reports what it saw — an item, a source, a killer, a
 * price — and everything below runs here, for the same reason the notify route picks the Discord
 * channel and the clog route owns the item catalogue: a clan changing what it considers notable
 * shouldn't have to wait on a plugin release, and 200 clients each holding their own copy of the
 * drop tables would drift apart within a month.
 *
 * NOTHING HERE SCORES. Every input is client-reported and no hiscores read can confirm a drop, so
 * standings stay on the sweep's numbers. This decides what the clan gets to look at.
 *
 * Deliberately importable without a database — the datasets are files — so the rules can be tested
 * directly (tests/moments.test.ts).
 */

/** What we store. 'loot' is a haul that was notable for its price rather than its rarity. */
export type MomentKind = 'pet' | 'unique' | 'death' | 'loot';

/** What the plugin says it saw. Everything except `occurredAt`/`dedupKey` is best-effort. */
export interface Observation {
  kind: 'pet' | 'drop' | 'death';
  itemId?: number | null;
  itemName?: string | null;
  quantity?: number | null;
  valueGp?: number | null;
  /** The NPC/chest it came from, or what killed them. */
  source?: string | null;
  sourceKind?: string | null;
  kc?: number | null;
  occurredAt: string;
  /** Client-side idempotency key — a pet fires three chat lines and a kill fires two loot events. */
  dedupKey: string;
}

export interface WeeklyScope {
  id: number;
  type: 'skill' | 'boss' | 'efficiency';
  metric: string;
}

export interface EventScope {
  id: number;
  /** Sources the board names — tile source/target NPCs and timed activities. */
  sources: string[];
  /** Item ids any tile tracks. A tracked item that credited nothing is still the story of the kill. */
  itemIds: number[];
  /** Hauls worth at least this much are kept whatever they came from. */
  minLootGp: number;
}

export interface PlannedMoment {
  kind: MomentKind;
  weeklyCompetitionId: number | null;
  eventId: number | null;
  itemId: number | null;
  itemName: string | null;
  quantity: number;
  valueGp: number | null;
  source: string | null;
  sourceKind: string | null;
  kc: number | null;
  rarityDenominator: number | null;
  occurredAt: string;
  /** The client's key, suffixed with the scope — one observation can legitimately land on two boards. */
  dedupKey: string;
}

/**
 * Rarer than this isn't a unique, it's a Tuesday. Same floor the luck boards use, on purpose: a
 * clan that has learned what "1 in 100" means there shouldn't find a different meaning here.
 */
export const MIN_RARITY_DENOMINATOR = 100;

/** Default price floor for a bingo haul that nothing else makes interesting. */
export const DEFAULT_MIN_LOOT_GP = 1_000_000;

/** Collapse a name to something two spellings of it agree on ("Vet'ion" / "vetion"). */
function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Raid rooms, for attributing a DEATH.
 *
 * A drop from a raid arrives under the raid's name (the chest is the source), but nobody dies to
 * "Chambers of Xeric" — they die to Olm, or to Verzik, or to a Nylocas. Without this a raid week's
 * death feed would be permanently empty, which is the opposite of the truth.
 *
 * Only rooms that can actually kill you are listed; the boss's own label and aliases come from
 * BOSSES, so nothing is repeated here.
 */
const RAID_ROOMS: Record<string, string[]> = {
  chambersOfXeric: [
    'Great Olm', 'Tekton', 'Vasa Nistirio', 'Vespula', 'Muttadile', 'Ice demon',
    'Skeletal Mystic', 'Lizardman shaman', 'Guardian', 'Vanguard', 'Abyssal portal',
  ],
  theatreOfBlood: [
    'The Maiden of Sugadinti', 'Pestilent Bloat', 'Nylocas Vasilias', 'Sotetseg', 'Xarpus',
    'Verzik Vitur',
  ],
  tombsOfAmascut: [
    'Akkha', 'Ba-Ba', 'Kephri', 'Zebak', 'Tumeken\'s Warden', 'Elidinis\' Warden', 'Obelisk',
  ],
  gauntlet: ['Crystalline Hunllef'],
  corruptedGauntlet: ['Corrupted Hunllef'],
  barrows: [
    'Ahrim the Blighted', 'Dharok the Wretched', 'Guthan the Infested', 'Karil the Tainted',
    'Torag the Corrupted', 'Verac the Defiled',
  ],
};

// The harder modes share their rooms with the base version — the boss that killed you is the same
// creature whether or not the raid was invocation-boosted.
RAID_ROOMS.chambersOfXericChallengeMode = RAID_ROOMS.chambersOfXeric;
RAID_ROOMS.theatreOfBloodHardMode = RAID_ROOMS.theatreOfBlood;
RAID_ROOMS.tombsOfAmascutExpertMode = RAID_ROOMS.tombsOfAmascut;

const bossNameCache = new Map<string, Set<string>>();

/**
 * Every name a boss legitimately answers to: its label, the nicknames BOSSES already carries, and
 * its raid rooms. Built once per metric.
 */
export function bossSourceNames(metric: string): Set<string> {
  const cached = bossNameCache.get(metric);
  if (cached) return cached;
  const boss = BOSSES.find((b) => b.key === metric);
  const names = new Set<string>();
  if (boss) {
    names.add(norm(boss.label));
    // "raids" is an alias on every raid so the tile pickers can find them by typing it — as a SOURCE
    // name it would make every raid match every other, so short generic aliases are dropped.
    for (const alias of boss.aliases ?? []) {
      if (alias.length >= 4 && alias !== 'raids') names.add(norm(alias));
    }
  }
  for (const room of RAID_ROOMS[metric] ?? []) names.add(norm(room));
  bossNameCache.set(metric, names);
  return names;
}

/** Does a client-reported source name refer to this competition's boss? */
export function matchesBoss(source: string | null | undefined, metric: string): boolean {
  if (!source) return false;
  return bossSourceNames(metric).has(norm(source));
}

const pageCache = new Map<string, string | null>();

/**
 * The collection-log page for a boss — which is the game's own list of what counts as a unique
 * from it, maintained by Jagex rather than by us.
 */
export function bossClogPage(metric: string): string | null {
  if (pageCache.has(metric)) return pageCache.get(metric)!;
  const boss = BOSSES.find((b) => b.key === metric);
  let found: string | null = null;
  if (boss) {
    const target = norm(boss.label);
    found = clogPageNames().find((page) => norm(page) === target) ?? null;
  }
  pageCache.set(metric, found);
  return found;
}

const uniqueCache = new Map<string, Set<number>>();

/** Item ids the game itself files under this boss. Empty for a boss with no log page. */
export function bossUniqueIds(metric: string): Set<number> {
  const cached = uniqueCache.get(metric);
  if (cached) return cached;
  const page = bossClogPage(metric);
  const ids = new Set(page ? clogPageItems(page).map((i) => i.id) : []);
  uniqueCache.set(metric, ids);
  return ids;
}

const drops = npcDrops as unknown as Record<string, { i: number; d: number; q?: number }[]>;
const dropIndexCache = new Map<string, Map<number, { denominator: number; stack: number }>>();

export interface DropInfo {
  /** 1-in-N for this roll. */
  denominator: number;
  /** How many of the item the roll gives. A drop table lists each stack size as its own row. */
  stack: number;
}

/** What the wiki dataset says about an item from a source. Null when we can't place it. */
export function dropInfo(source: string | null | undefined, itemId: number | null | undefined): DropInfo | null {
  if (!source || itemId == null) return null;
  let index = dropIndexCache.get(source);
  if (!index) {
    // The dataset is keyed by the NPC's own name, which is what the client reports — but a client
    // that reports a different casing shouldn't lose its rate, so fall back to a normalized scan.
    const table = drops[source] ?? drops[Object.keys(drops).find((k) => norm(k) === norm(source)) ?? ''];
    index = new Map(
      (table ?? [])
        .filter((d) => Number.isFinite(d.d))
        // Several rows can list the same item at different stack sizes; the RAREST is the one worth
        // pricing a moment against, and it's also the one whose stack size is the big one.
        .sort((a, b) => a.d - b.d)
        .map((d) => [d.i, { denominator: d.d, stack: d.q && d.q > 0 ? d.q : 1 }] as const),
    );
    dropIndexCache.set(source, index);
  }
  return index.get(itemId) ?? null;
}

/** 1-in-N for an item from a source, for display. Null when we can't price it. */
export function dropRate(source: string | null | undefined, itemId: number | null | undefined): number | null {
  return dropInfo(source, itemId)?.denominator ?? null;
}

/**
 * Rare enough, and actually an ITEM rather than a lucky stack size.
 *
 * A drop table lists every stack size as its own roll, so "500 death runes from Zulrah" is a
 * 1-in-1,594 line in the dataset and sails past any rarity floor — it is a rare AMOUNT of a common
 * drop, which is not a moment. The stack check is what tells the two apart.
 */
function isRareSingle(info: DropInfo | null): boolean {
  return !!info && info.denominator >= MIN_RARITY_DENOMINATOR && info.stack <= 1;
}

const petCache = new Map<string, Set<string>>();

/** The pets a skill can produce. Boss pets are absent by design — they match via the boss's log page. */
export function petsForSkill(skill: string): Set<string> {
  const cached = petCache.get(skill);
  if (cached) return cached;
  const names = ((skillPets as { skills?: Record<string, string[]> }).skills?.[skill] ?? []).map(norm);
  const set = new Set(names);
  petCache.set(skill, set);
  return set;
}

/** Every pet name we have an owning skill for — the guard the dataset test checks against clog.json. */
export function mappedPetNames(): string[] {
  const all = new Set<string>();
  for (const names of Object.values((skillPets as { skills?: Record<string, string[]> }).skills ?? {})) {
    for (const n of names) all.add(n);
  }
  return [...all];
}

/**
 * Decide where one observation belongs — nowhere, one board, or several.
 *
 * A moment can legitimately land twice: a pet during a Runecrafting week that is also mid-bingo is
 * the story of both, and making them compete would delete one of them. Each row carries the scope
 * in its dedup key so re-sending the same observation still collapses onto the same rows.
 */
export function classifyObservation(
  obs: Observation,
  scopes: { weeklies: WeeklyScope[]; event: EventScope | null },
): PlannedMoment[] {
  const planned: PlannedMoment[] = [];
  const base = {
    itemId: obs.itemId ?? null,
    itemName: obs.itemName ?? null,
    quantity: Math.max(1, obs.quantity ?? 1),
    valueGp: obs.valueGp ?? null,
    source: obs.source ?? null,
    sourceKind: obs.sourceKind ?? null,
    kc: obs.kc ?? null,
    occurredAt: obs.occurredAt,
  };
  const info = dropInfo(obs.source, obs.itemId);
  // Displayed rarity is for the item itself, so a lucky stack size never claims to be a 1-in-1,594
  // drop on a feed line that names the item.
  const rate = info && info.stack <= 1 ? info.denominator : null;

  for (const weekly of scopes.weeklies) {
    const kind = weeklyKindFor(obs, weekly);
    if (!kind) continue;
    planned.push({
      ...base,
      kind,
      weeklyCompetitionId: weekly.id,
      eventId: null,
      rarityDenominator: rate ? Math.round(rate) : null,
      dedupKey: `${obs.dedupKey}:w${weekly.id}`,
    });
  }

  if (scopes.event) {
    const kind = eventKindFor(obs, scopes.event, info);
    if (kind) {
      planned.push({
        ...base,
        kind,
        weeklyCompetitionId: null,
        eventId: scopes.event.id,
        rarityDenominator: rate ? Math.round(rate) : null,
        dedupKey: `${obs.dedupKey}:e${scopes.event.id}`,
      });
    }
  }

  return planned;
}

/**
 * What this observation is to a competition week, or null when it's nothing to do with it.
 *
 * An efficiency week is account-wide — every drop and death in the game happens "during" it — so it
 * claims nothing. A feed that keeps everything says as little as one that keeps nothing.
 */
function weeklyKindFor(obs: Observation, weekly: WeeklyScope): MomentKind | null {
  if (weekly.type === 'efficiency') return null;

  if (weekly.type === 'skill') {
    // A skill week has no boss to drop from or die to, so only its pets qualify. Which pets those
    // are is the one thing the collection log can't tell us — see src/data/skillPets.json.
    if (obs.kind !== 'pet' || !obs.itemName) return null;
    return petsForSkill(weekly.metric).has(norm(obs.itemName)) ? 'pet' : null;
  }

  const fromThisBoss = matchesBoss(obs.source, weekly.metric);
  if (obs.kind === 'death') {
    return fromThisBoss ? 'death' : null;
  }
  if (obs.kind === 'pet') {
    // A pet with no source (the chat line arrives alone for skilling pets) still counts when the pet
    // itself is on the boss's log page — that's what makes it this boss's pet.
    const onPage = obs.itemId != null && bossUniqueIds(weekly.metric).has(obs.itemId);
    return fromThisBoss || onPage ? 'pet' : null;
  }
  // A drop counts when it came from the boss being raced AND the game itself considers it notable.
  if (!fromThisBoss) return null;
  if (obs.itemId != null && bossUniqueIds(weekly.metric).has(obs.itemId)) return 'unique';
  // The boss's log page is Jagex's own list of what's special about it, so where one exists it is
  // the answer — second-guessing it with a rarity floor is how 500 death runes became a highlight.
  if (bossClogPage(weekly.metric)) return null;
  // No page (a boss the log doesn't cover): fall back to the drop table's own rarity.
  return isRareSingle(dropInfo(obs.source, obs.itemId)) ? 'unique' : null;
}

/**
 * What this observation is to a running bingo.
 *
 * Wider than a competition week on purpose. A board is a week of people grinding content THEY chose,
 * and the near-misses are half the fun: the tile wanted a hilt and you got a chestplate, or you got
 * something huge from a boss nobody has a tile for. So a drop qualifies when the board named its
 * source, when the board wants the item (even if the tile was already finished, or the source was
 * wrong, or the drop credited nothing), or when it is simply worth a lot of money.
 */
function eventKindFor(obs: Observation, event: EventScope, info: DropInfo | null): MomentKind | null {
  // Every pet and every death during a bingo is a story — no filter, that IS the feed.
  if (obs.kind === 'pet') return 'pet';
  if (obs.kind === 'death') return 'death';

  const onBoardSource = !!obs.source && event.sources.some((s) => norm(s) === norm(obs.source!));
  const onBoardItem = obs.itemId != null && event.itemIds.includes(obs.itemId);
  const richEnough = (obs.valueGp ?? 0) >= event.minLootGp;
  if (!onBoardSource && !onBoardItem && !richEnough) return null;
  // Genuinely rare reads as a unique; anything kept for its price alone is loot.
  return isRareSingle(info) ? 'unique' : 'loot';
}

/** One line of feed copy. Shared by the page and anything that posts a moment onward. */
export function momentSentence(m: {
  kind: string;
  itemName: string | null;
  quantity: number;
  source: string | null;
  valueGp: number | null;
}): string {
  const item = m.itemName ?? 'something';
  const qty = m.quantity > 1 ? `${m.quantity.toLocaleString()} × ` : '';
  switch (m.kind) {
    case 'pet': {
      // A duplicate pet never fires the collection-log line that names it, so the feed says what it
      // honestly knows: that a pet happened.
      const pet = m.itemName ?? 'a pet';
      return m.source ? `got ${pet} from ${m.source}` : `got ${pet}`;
    }
    case 'unique':
      return m.source ? `got ${qty}${item} from ${m.source}` : `got ${qty}${item}`;
    case 'death':
      return m.source ? `died to ${m.source}` : 'died';
    default:
      return m.source ? `looted ${qty}${item} from ${m.source}` : `looted ${qty}${item}`;
  }
}

export const MOMENT_EMOJI: Record<string, string> = {
  pet: '🐾',
  unique: '✨',
  death: '💀',
  loot: '💰',
};
