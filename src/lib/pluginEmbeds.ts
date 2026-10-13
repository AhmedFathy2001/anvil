// Discord embeds for the plugin's clan notifications, composed HERE from the facts the plugin saw.
//
// THE CONTRACT. A plugin that sees the `site-embeds` capability POSTs /api/plugin/notify with
//
//   { channel, kind, facts: {...}, seasonal? }          (+ the screenshot as multipart `file`)
//
// instead of a finished `embed`. The plugin keeps every decision about WHETHER to post (toggles,
// channel flags, tier floors, dedup, rarity floors) and anything only the client can know (kill
// counts, varbit totals, the vestige roll line, whether a spoon line is deserved). Everything about
// HOW it reads — titles, emoji, colours, wiki and icon links, field labels, number formatting, the
// sentence templates and the reaction-line pool — lives in this file, so a wording change is a site
// deploy instead of a plugin-hub release. The Java side of the contract is NotifyFacts.java.
//
// Every builder reproduces what the plugin built itself up to plugin 1.x (tests/plugin-embeds.test.ts
// compares against fixtures dumped from the old Java builders). `rsn` is always optional: without it
// the post has no author line and says "A clan member".
//
// Pure: no database, no network — the route validates and calls `buildPluginEmbed`.

import { clamp, code, LIMIT, type DiscordEmbed, type DiscordEmbedField } from './discordEmbeds';
import { itemIconUrl, skillIconUrl } from './tileIcons';

export const PLUGIN_EMBED_KINDS = [
  'drop',
  'pet',
  'clogSlot',
  'caTask',
  'caTier',
  'diary',
  'quest',
  'level99',
  // Any skill level the member's rules post (capability 'level-rules'); 99 reads exactly like level99.
  'level',
  'totalLevel',
] as const;
export type PluginEmbedKind = (typeof PLUGIN_EMBED_KINDS)[number];

/** One item in a drop. `value` is the whole stack's gp value (0 = unknown / untradeable). */
export interface DropItemFacts {
  id?: number | null;
  name: string;
  qty: number;
  value: number;
}

export interface DropFacts {
  rsn?: string | null;
  /** One item = a single drop post; several = one combined "haul" post led by the most valuable. */
  items: DropItemFacts[];
  source?: string | null;
  /** RuneLite loot kind, lowercased: npc / player→"pvp" / pickpocket / event … */
  sourceKind?: string | null;
  kc?: number | null;
  /** Per-kill probability (single item only). */
  dropRate?: number | null;
  /** The source hands this item over every kill (server dropFacts, judged by the plugin). */
  guaranteed?: boolean;
  /** A rare roll on something worthless. */
  troll?: boolean;
  /** An always-notify prestige item: 'loot' (seen in a loot event) or 'unlock' (collection-log line only). */
  notable?: 'loot' | 'unlock' | null;
  /** Awarded for finishing content (Infernal cape…) rather than rolled for. */
  earned?: boolean;
  /** Append a lucky-drop reaction line — the plugin decides whether it's deserved. */
  spoon?: boolean;
  /** A line the plugin composed from its own state (the vestige roll rotation), appended verbatim. */
  note?: string | null;
}

export interface PetFacts {
  rsn?: string | null;
  /** Null until the collection-log line names it. */
  name?: string | null;
  itemId?: number | null;
  duplicate?: boolean;
  source?: string | null;
  /** Skilling pet's skill (lowercase dataset key) when there is no source. */
  skill?: string | null;
  kc?: number | null;
  dropRate?: number | null;
}

export interface ClogSlotFacts {
  rsn?: string | null;
  item: string;
  itemId?: number | null;
  /** Unique slots obtained and the log's total; 0 when the log hasn't synced this session. */
  slots?: number | null;
  slotsMax?: number | null;
  source?: string | null;
  kc?: number | null;
}

export type CaTierName = 'Easy' | 'Medium' | 'Hard' | 'Elite' | 'Master' | 'Grandmaster';

export interface CaTaskFacts {
  rsn?: string | null;
  task: string;
  tier: CaTierName;
  /** CA points after this task (0 = unreadable). */
  totalPoints?: number | null;
  /** Lowest tier-unlock threshold above the total; 0/absent once every tier is unlocked. */
  nextThreshold?: number | null;
}

export interface CaTierFacts {
  rsn?: string | null;
  tier: CaTierName;
}

export interface DiaryFacts {
  rsn?: string | null;
  area: string;
  tier: string;
}

export interface QuestFacts {
  rsn?: string | null;
  quest: string;
  /** "Novice" … "Grandmaster", or null when the quest's tier isn't known. */
  difficulty?: string | null;
}

export interface Level99Facts {
  rsn?: string | null;
  skill: string;
  /** Skills at 99 (this one included) and how many skills there are. */
  at99: number;
  skills: number;
}

export interface LevelFacts {
  rsn?: string | null;
  skill: string;
  /** The level reached — the highest crossed that one of the member's rule sets posts. */
  level: number;
  /** Skills at 99 now, and how many skills there are. */
  at99: number;
  skills: number;
}

export interface TotalLevelFacts {
  rsn?: string | null;
  /** The milestone announced (a round number, or the max total when `maxed`). */
  total: number;
  maxed?: boolean;
  /** Live total and the max total, for the "to go" line. Omitted by a build not chasing max. */
  current?: number | null;
  max?: number | null;
  /** The round milestone that matched the rules (e.g. 1900); absent on a max. The route re-checks it. */
  milestone?: number | null;
}

export type PluginEmbedFacts =
  | { kind: 'drop'; facts: DropFacts }
  | { kind: 'pet'; facts: PetFacts }
  | { kind: 'clogSlot'; facts: ClogSlotFacts }
  | { kind: 'caTask'; facts: CaTaskFacts }
  | { kind: 'caTier'; facts: CaTierFacts }
  | { kind: 'diary'; facts: DiaryFacts }
  | { kind: 'quest'; facts: QuestFacts }
  | { kind: 'level99'; facts: Level99Facts }
  | { kind: 'level'; facts: LevelFacts }
  | { kind: 'totalLevel'; facts: TotalLevelFacts };

// ── Presentation constants (moved from the plugin) ──────────────────────────────────────────────

/** The plugin's two colours: drops/pets gold, achievements blue. Kept as the plugin had them. */
export const PLUGIN_COLOR = { rare: 0xd4a017, achievement: 0x4a90d9 } as const;

const WIKI = 'https://oldschool.runescape.wiki/w/';
const CA_ICON_URL = 'https://oldschool.runescape.wiki/images/Combat_Achievements_icon.png';
const CA_WIKI_URL = 'https://oldschool.runescape.wiki/w/Combat_Achievements';
const CA_TIERS: readonly CaTierName[] = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];

/** Lucky-drop reaction lines (were the plugin's anvil_text.json spoonTaunts). */
export const SPOON_LINES = [
  'SPOONED. 🥄',
  'Way under rate — absolute spoon.',
  'RNG said "here you go champ".',
  'Some of us are 5x dry. Disgusting.',
  'No skill, all luck. Congrats. 🥄',
  'Hand it over — someone drier deserved that.',
] as const;

// ── Formatting helpers ──────────────────────────────────────────────────────────────────────────

/** 12345678 → "12,345,678" (the plugin's "%,d"). */
export function commas(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Wiki page link; the OSRS wiki uses underscores for spaces. */
export function wikiUrl(page: string): string {
  return WIKI + page.replace(/ /g, '_');
}

function who(rsn: string | null | undefined): string {
  return rsn ? rsn : 'A clan member';
}

const stat = (name: string, value: string): DiscordEmbedField => ({
  name: clamp(name, LIMIT.fieldName),
  value: clamp(code(value), LIMIT.fieldValue),
  inline: true,
});
const plain = (name: string, value: string, inline: boolean): DiscordEmbedField => ({
  name: clamp(name, LIMIT.fieldName),
  value: clamp(value, LIMIT.fieldValue),
  inline,
});

function base(rsn: string | null | undefined, title: string, description: string, color: number): DiscordEmbed {
  const e: DiscordEmbed = {};
  if (rsn) e.author = { name: clamp(rsn, LIMIT.author) };
  e.title = clamp(title, LIMIT.title);
  e.description = clamp(description, LIMIT.description);
  e.color = color;
  return e;
}

// ── Drop wording (was the plugin's DropSource / DropLuck presentation half) ─────────────────────

function isLootKey(source: string | null | undefined): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  return s === 'loot chest' || s.includes('loot key');
}

/** How to name a drop's source, or null when it can't be named truthfully. */
export function sourceLabel(source: string | null | undefined, sourceKind: string | null | undefined): string | null {
  if (isLootKey(source)) return 'a loot key';
  const named = source != null && source.trim() !== '';
  if (sourceKind === 'pvp') return named ? `a player kill (${source!.trim()})` : 'a player kill';
  if (!named) return null;
  if (sourceKind === 'pickpocket') return `pickpocketing ${source!.trim()}`;
  return source!.trim();
}

/** " from Vorkath", " from a loot key", or "" when there's nothing true to say. */
export function fromPhrase(source: string | null | undefined, sourceKind: string | null | undefined): string {
  const label = sourceLabel(source, sourceKind);
  return label == null ? '' : ` from ${label}`;
}

/** What the count against this source is called — keys and caskets are not kills. */
export function countLabel(source: string | null | undefined): string {
  if (isLootKey(source)) return 'Keys opened';
  if (source && source.toLowerCase().startsWith('clue scroll')) return 'Caskets';
  return 'KC';
}

/** Share of players who'd already hold a drop of per-kill probability p after kc kills. */
export function obtainedShare(p: number, kc: number): number {
  if (p <= 0 || kc <= 0) return 0;
  if (p >= 1) return 1;
  return -Math.expm1(kc * Math.log1p(-p));
}

/** The "Luck" field: "Top 8% — spooned", "Top 20%", "Dry — 93% had it by now", or null when typical/unknown. */
export function luckLabel(dropRate: number | null | undefined, kc: number | null | undefined): string | null {
  if (dropRate == null || dropRate <= 0 || kc == null || kc <= 0) return null;
  const share = obtainedShare(dropRate, kc);
  const pct = Math.max(1, Math.round(share * 100));
  if (share < 0.1) return `Top ${pct}% — spooned`;
  if (share < 0.35) return `Top ${pct}%`;
  if (share >= 0.85) return `Dry — ${pct}% had it by now`;
  return null;
}

// ── Builders ────────────────────────────────────────────────────────────────────────────────────

export interface BuildOptions {
  /** Screenshot uploaded with the post; referenced as attachment://<name>. None → no image. */
  imageFilename?: string | null;
  /** For the reaction line; injectable so tests are deterministic. */
  random?: () => number;
}

function spoonLine(random: () => number): string {
  const i = Math.min(SPOON_LINES.length - 1, Math.max(0, Math.floor(random() * SPOON_LINES.length)));
  return SPOON_LINES[i];
}

const itemLabel = (name: string, qty: number) => (qty > 1 ? `${name} ×${qty}` : name);

function dropEmbed(f: DropFacts, random: () => number): DiscordEmbed {
  const kcLabel = countLabel(f.source);
  if (f.items.length > 1) {
    // A whole kill / loot key with several standouts: lead with the most valuable (the first of
    // equals), plus the combined total — never a post per item.
    const top = f.items.reduce((best, it) => (it.value > best.value ? it : best), f.items[0]);
    const total = f.items.reduce((sum, it) => sum + it.value, 0);
    let desc = `${who(f.rsn)} received a valuable haul${fromPhrase(f.source, f.sourceKind)}.`;
    if (f.spoon) desc += `\n${spoonLine(random)}`;
    const e = base(f.rsn, '💰 Rare drop!', desc, PLUGIN_COLOR.rare);
    e.fields = [
      plain('Top item', `${itemLabel(top.name, top.qty)} (${commas(top.value)} gp)`, false),
      stat('Total value', `${commas(total)} gp`),
      stat('Items', String(f.items.length)),
    ];
    if (f.kc != null && f.kc > 0) e.fields.push(stat(kcLabel, commas(f.kc)));
    e.url = wikiUrl(top.name);
    e.thumbnail = { url: itemIconUrl(top.id ?? 0) };
    return e;
  }

  const item = f.items[0];
  const guaranteed = f.guaranteed === true;
  let title: string;
  let desc: string;
  if (f.notable) {
    title = f.earned ? '🏆 Earned!' : '💎 Notable drop!';
    desc = f.notable === 'unlock'
      ? `${who(f.rsn)} unlocked ${item.name}!`
      : `${who(f.rsn)} received ${item.name}${fromPhrase(f.source, f.sourceKind)}!`;
  } else {
    title = f.troll ? '🎣 Troll drop!' : '💰 Rare drop!';
    desc = `${who(f.rsn)}${f.troll ? ' got robbed' : ' received a valuable drop'}${fromPhrase(f.source, f.sourceKind)}.`;
  }
  if (f.spoon && !guaranteed) desc += `\n${spoonLine(random)}`;
  if (f.note) desc += `\n${f.note}`;

  const e = base(f.rsn, title, desc, PLUGIN_COLOR.rare);
  // A notable item was never priced against a rate — the rate field and luck are for rolls.
  const dropRate = f.notable ? null : f.dropRate;
  e.fields = [stat('Item', itemLabel(item.name, item.qty))];
  if (item.value > 0) e.fields.push(stat('Value', `${commas(item.value)} gp`));
  // A guaranteed drop has no rate worth printing and no luck to speak of.
  if (guaranteed) e.fields.push(stat('Drop rate', 'Guaranteed'));
  else if (dropRate != null && dropRate > 0) e.fields.push(stat('Drop rate', `1/${commas(Math.round(1 / dropRate))}`));
  if (f.kc != null && f.kc > 0) e.fields.push(stat(kcLabel, commas(f.kc)));
  const luck = guaranteed ? null : luckLabel(dropRate, f.kc);
  if (luck) e.fields.push(stat('Luck', luck));
  e.url = wikiUrl(item.name);
  if (item.id != null && item.id > 0) e.thumbnail = { url: itemIconUrl(item.id) };
  return e;
}

function petEmbed(f: PetFacts): DiscordEmbed {
  const named = !!f.name;
  const e = base(
    f.rsn,
    named ? `🐾 ${f.name}` : '🐾 Pet drop!',
    f.duplicate
      // The game's own joke about a pet you already have.
      ? `${who(f.rsn)} has a funny feeling like they would have been followed.`
      : `${who(f.rsn)} has a funny feeling like they're being followed.`,
    PLUGIN_COLOR.rare,
  );
  e.fields = [stat('Status', f.duplicate ? 'Duplicate' : 'New!')];
  if (f.source) e.fields.push(stat('From', f.source));
  else if (f.skill) e.fields.push(stat('From', f.skill.charAt(0).toUpperCase() + f.skill.slice(1)));
  if (f.kc != null && f.kc > 0) e.fields.push(stat('KC', commas(f.kc)));
  const dropRate = named ? f.dropRate : null;
  if (dropRate != null && dropRate > 0) {
    e.fields.push(stat('Rarity', `1 in ${commas(Math.round(1 / dropRate))}`));
    const luck = luckLabel(dropRate, f.kc);
    if (luck) e.fields.push(stat('Luck', luck));
  }
  if (named && f.itemId != null && f.itemId > 0) e.thumbnail = { url: itemIconUrl(f.itemId) };
  if (named) e.url = wikiUrl(f.name!);
  return e;
}

/** The collection log's rank title for a slot count (thresholds are Jagex's; Gilded is 90% rounded down to 25). */
export function clogRank(obtained: number, totalSlots: number): string | null {
  if (obtained <= 0) return null;
  const gilded = totalSlots <= 0 ? Infinity : Math.floor(Math.floor(totalSlots * 0.9) / 25) * 25;
  if (obtained >= gilded) return 'Gilded';
  const ranks: [number, string][] = [
    [100, 'Bronze'], [300, 'Iron'], [500, 'Steel'], [700, 'Black'],
    [900, 'Mithril'], [1000, 'Adamant'], [1100, 'Rune'], [1200, 'Dragon'],
  ];
  let rank: string | null = null;
  for (const [at, name] of ranks) if (obtained >= at) rank = name;
  return rank;
}

function clogSlotEmbed(f: ClogSlotFacts): DiscordEmbed {
  const e = base(f.rsn, `📕 ${f.item}`, `${who(f.rsn)} added ${f.item} to their collection.`, PLUGIN_COLOR.achievement);
  e.url = wikiUrl(f.item);
  e.fields = [];
  const slots = f.slots ?? 0;
  const max = f.slotsMax ?? 0;
  // Dropped rather than guessed when the log hasn't synced this session.
  if (slots > 0 && max > 0 && slots <= max) {
    e.fields.push(stat('Completed', `${slots}/${max} (${((slots * 100) / max).toFixed(1)}%)`));
  }
  const rank = clogRank(slots > 0 && max > 0 && slots <= max ? slots : 0, Math.max(0, max));
  if (rank) e.fields.push(stat('Rank', rank));
  if (f.source) {
    e.fields.push(stat('Source', f.source));
    if (f.kc != null && f.kc > 0) e.fields.push(stat('Completion count', String(f.kc)));
  }
  if (f.itemId != null && f.itemId > 0) e.thumbnail = { url: itemIconUrl(f.itemId) };
  return e;
}

/** The wiki has no page per task: land on the tier's task list, the task as a fragment. */
function caTaskWikiUrl(tier: string, task: string): string {
  const b = `${CA_WIKI_URL}/${tier.replace(/ /g, '_')}`;
  return task ? `${b}#${task.trim().replace(/ /g, '_')}` : b;
}

function caTaskEmbed(f: CaTaskFacts): DiscordEmbed {
  const e = base(
    f.rsn,
    `⚔️ ${f.task}`,
    `${who(f.rsn)} completed a ${f.tier.toLowerCase()} combat task.`,
    PLUGIN_COLOR.achievement,
  );
  e.url = caTaskWikiUrl(f.tier, f.task);
  e.fields = [stat('Points earned', `+${CA_TIERS.indexOf(f.tier) + 1}`)];
  const total = f.totalPoints ?? 0;
  if (total > 0) {
    e.fields.push(stat('Total points', commas(total)));
    const next = f.nextThreshold ?? 0;
    if (next > 0) {
      e.fields.push(stat('Next unlock', `${commas(total)}/${commas(next)} (${((100 * total) / next).toFixed(1)}%)`));
    }
  }
  e.thumbnail = { url: CA_ICON_URL };
  return e;
}

// The message-only achievement posts carry no author line, as the plugin built them.
function textEmbed(title: string, description: string): DiscordEmbed {
  return base(null, title, description, PLUGIN_COLOR.achievement);
}

function totalLevelEmbed(f: TotalLevelFacts): DiscordEmbed {
  const e = textEmbed(
    f.maxed ? '🏆 Maxed!' : '📈 Total level milestone!',
    f.maxed
      ? `${who(f.rsn)} just **maxed** with a total level of **${f.total}**!`
      : `${who(f.rsn)} just reached **${f.total} total level**!`,
  );
  // From the LIVE total, not the milestone; omitted on a max and when there's nothing left.
  if (!f.maxed && f.current != null && f.max != null && f.max - f.current > 0) {
    e.fields = [plain('Progress to max', `${commas(f.current)} / ${commas(f.max)} — ${commas(f.max - f.current)} to go`, true)];
  }
  return e;
}

/** A 99 — the post the plugin has always made, kept byte-for-byte (tests pin it to the legacy fixture). */
function level99Embed(f: Level99Facts): DiscordEmbed {
  const e = textEmbed('🎉 Level 99!', `${who(f.rsn)} just reached **level 99 ${f.skill}**!`);
  e.fields = [plain('Progress', `${f.at99} of ${f.skills} skills at 99`, true)];
  return e;
}

/** Any other level a clan or member chose to post: same voice as the 99, plus the skill's wiki page and icon. */
function levelEmbed(f: LevelFacts): DiscordEmbed {
  if (f.level === 99) return level99Embed({ rsn: f.rsn, skill: f.skill, at99: f.at99, skills: f.skills });
  const e = textEmbed('⬆️ Level up!', `${who(f.rsn)} just reached **level ${f.level} ${f.skill}**!`);
  e.url = wikiUrl(f.skill);
  const icon = skillIconUrl(f.skill);
  if (icon) e.thumbnail = { url: icon };
  // The same progress line as a 99, when there is any progress to speak of.
  if (f.at99 > 0 && f.skills > 0) e.fields = [plain('Progress', `${f.at99} of ${f.skills} skills at 99`, true)];
  return e;
}

/** Compose the embed for already-validated facts. */
export function pluginEmbed(input: PluginEmbedFacts, opts: BuildOptions = {}): DiscordEmbed {
  const random = opts.random ?? Math.random;
  let e: DiscordEmbed;
  switch (input.kind) {
    case 'drop': e = dropEmbed(input.facts, random); break;
    case 'pet': e = petEmbed(input.facts); break;
    case 'clogSlot': e = clogSlotEmbed(input.facts); break;
    case 'caTask': e = caTaskEmbed(input.facts); break;
    case 'caTier': {
      const f = input.facts;
      e = textEmbed('🏆 Combat Achievement tier!', `${who(f.rsn)} unlocked the **${f.tier}** Combat Achievements tier!`);
      break;
    }
    case 'diary': {
      const f = input.facts;
      e = textEmbed('📜 Diary completed!', `${who(f.rsn)} just completed the **${f.area} ${f.tier}** achievement diary!`);
      break;
    }
    case 'quest': {
      const f = input.facts;
      const tag = f.difficulty ? ` (${f.difficulty})` : '';
      e = textEmbed('🗺️ Quest complete!', `${who(f.rsn)} just completed **${f.quest}**${tag}!`);
      break;
    }
    case 'level99': e = level99Embed(input.facts); break;
    case 'level': e = levelEmbed(input.facts); break;
    case 'totalLevel': e = totalLevelEmbed(input.facts); break;
  }
  if (opts.imageFilename) e.image = { url: `attachment://${opts.imageFilename}` };
  return e;
}

// ── Validation ──────────────────────────────────────────────────────────────────────────────────
//
// Facts come off the request body from anyone with a plugin token, so nothing is trusted: every
// field is type-checked and length-capped, and a bad payload is a 400, never a throw.

class BadFacts extends Error {}

type Obj = Record<string, unknown>;
const MAX_TEXT = 256;

function obj(v: unknown, what: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new BadFacts(`${what} must be an object`);
  return v as Obj;
}
function str(o: Obj, key: string, max = MAX_TEXT): string {
  const v = o[key];
  if (typeof v !== 'string' || v.trim() === '') throw new BadFacts(`${key} is required`);
  return v.slice(0, max);
}
function optStr(o: Obj, key: string, max = MAX_TEXT): string | null {
  const v = o[key];
  if (v == null) return null;
  if (typeof v !== 'string') throw new BadFacts(`${key} must be a string`);
  return v === '' ? null : v.slice(0, max);
}
function optInt(o: Obj, key: string): number | null {
  const v = o[key];
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new BadFacts(`${key} must be an integer`);
  return v;
}
function int(o: Obj, key: string): number {
  const v = optInt(o, key);
  if (v == null) throw new BadFacts(`${key} is required`);
  return v;
}
function optRate(o: Obj, key: string): number | null {
  const v = o[key];
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) throw new BadFacts(`${key} must be a probability`);
  return v;
}
function flag(o: Obj, key: string): boolean {
  const v = o[key];
  if (v == null) return false;
  if (typeof v !== 'boolean') throw new BadFacts(`${key} must be a boolean`);
  return v;
}
function caTier(o: Obj): CaTierName {
  const v = o.tier;
  if (typeof v !== 'string' || !(CA_TIERS as readonly string[]).includes(v)) throw new BadFacts('tier is not a CA tier');
  return v as CaTierName;
}
const rsnOf = (o: Obj) => optStr(o, 'rsn', 12);

function parseFacts(kind: PluginEmbedKind, raw: unknown): PluginEmbedFacts {
  const o = obj(raw, 'facts');
  switch (kind) {
    case 'drop': {
      if (!Array.isArray(o.items) || o.items.length === 0 || o.items.length > 50) {
        throw new BadFacts('items must be a non-empty array');
      }
      const items = o.items.map((it) => {
        const i = obj(it, 'item');
        const qty = int(i, 'qty');
        const value = int(i, 'value');
        if (qty < 1 || value < 0) throw new BadFacts('bad item qty/value');
        return { id: optInt(i, 'id'), name: str(i, 'name'), qty, value };
      });
      const notable = o.notable == null ? null : o.notable;
      if (notable !== null && notable !== 'loot' && notable !== 'unlock') throw new BadFacts('bad notable');
      return {
        kind,
        facts: {
          rsn: rsnOf(o), items, source: optStr(o, 'source'), sourceKind: optStr(o, 'sourceKind', 32),
          kc: optInt(o, 'kc'), dropRate: optRate(o, 'dropRate'), guaranteed: flag(o, 'guaranteed'),
          troll: flag(o, 'troll'), notable, earned: flag(o, 'earned'), spoon: flag(o, 'spoon'),
          note: optStr(o, 'note', 512),
        },
      };
    }
    case 'pet':
      return {
        kind,
        facts: {
          rsn: rsnOf(o), name: optStr(o, 'name'), itemId: optInt(o, 'itemId'), duplicate: flag(o, 'duplicate'),
          source: optStr(o, 'source'), skill: optStr(o, 'skill', 32), kc: optInt(o, 'kc'),
          dropRate: optRate(o, 'dropRate'),
        },
      };
    case 'clogSlot':
      return {
        kind,
        facts: {
          rsn: rsnOf(o), item: str(o, 'item'), itemId: optInt(o, 'itemId'), slots: optInt(o, 'slots'),
          slotsMax: optInt(o, 'slotsMax'), source: optStr(o, 'source'), kc: optInt(o, 'kc'),
        },
      };
    case 'caTask':
      return {
        kind,
        facts: {
          rsn: rsnOf(o), task: str(o, 'task'), tier: caTier(o), totalPoints: optInt(o, 'totalPoints'),
          nextThreshold: optInt(o, 'nextThreshold'),
        },
      };
    case 'caTier':
      return { kind, facts: { rsn: rsnOf(o), tier: caTier(o) } };
    case 'diary':
      return { kind, facts: { rsn: rsnOf(o), area: str(o, 'area'), tier: str(o, 'tier', 32) } };
    case 'quest':
      return { kind, facts: { rsn: rsnOf(o), quest: str(o, 'quest'), difficulty: optStr(o, 'difficulty', 32) } };
    case 'level99':
      return {
        kind,
        facts: { rsn: rsnOf(o), skill: str(o, 'skill', 32), at99: int(o, 'at99'), skills: int(o, 'skills') },
      };
    case 'level': {
      const level = int(o, 'level');
      if (level < 1 || level > 99) throw new BadFacts('level must be 1..99');
      return {
        kind,
        facts: { rsn: rsnOf(o), skill: str(o, 'skill', 32), level, at99: int(o, 'at99'), skills: int(o, 'skills') },
      };
    }
    case 'totalLevel':
      return {
        kind,
        facts: {
          rsn: rsnOf(o), total: int(o, 'total'), maxed: flag(o, 'maxed'), current: optInt(o, 'current'),
          max: optInt(o, 'max'), milestone: optInt(o, 'milestone'),
        },
      };
  }
}

export function isPluginEmbedKind(value: unknown): value is PluginEmbedKind {
  return typeof value === 'string' && (PLUGIN_EMBED_KINDS as readonly string[]).includes(value);
}

/** Validate `kind` + `facts` off a request and build the embed. Never throws. */
export function buildPluginEmbed(
  kind: unknown,
  facts: unknown,
  opts: BuildOptions = {},
): { ok: true; embed: DiscordEmbed } | { ok: false; error: string } {
  if (!isPluginEmbedKind(kind)) return { ok: false, error: 'Unknown kind' };
  try {
    return { ok: true, embed: pluginEmbed(parseFacts(kind, facts), opts) };
  } catch (err) {
    return { ok: false, error: err instanceof BadFacts ? `Bad facts: ${err.message}` : 'Bad facts' };
  }
}
