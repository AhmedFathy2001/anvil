// Which parts of a guide a clan posts to Discord, and the setups as Discord text. PURE.
//
// A POST'S SELECTION is stored with the post (guide_posts.selection), so every later edit and resync
// posts the same chosen parts: some levels, some setups. A setup added to the guide later is left
// out unless the clan ticked "Also post setups added later" (includeNew). The site page always
// shows the whole guide; only the Discord body is filtered.
//
// NULL SELECTION = a post made before selections existed: it keeps the original compact format
// (dps/summary gearSummaryMarkdown) byte for byte, so those messages keep editing in place with no
// change at all until the clan opens the post and picks.

import { bestStyle, type Monster } from './dps/engine';
import { SLOTS, type Slot } from './dps/tables';
import { fmtDuration, setupLoadout, type GearIndex } from './dps/summary';
import { TIERS, blockTargets, type GearBlock, type GearSetup, type TierKey } from './guideTiers';
import { accountLabel, buildLabel, setupKey } from './guideSetups';
import { bankTagString } from './runeliteExport';
import { groundMarkersJson } from './groundMarkers';
import { discordName } from './guideCredit';
import { parseYouTube, youTubeLink } from './youtube';

export interface PostSelection {
  v: 1;
  /** Levels posted (their text sections and setups). */
  tiers: TierKey[];
  /** Setup keys posted (lib/guideSetups setupKey). */
  setups: string[];
  /** Every setup key the guide had when the clan chose: anything else is "added later". */
  known: string[];
  /** Post setups added after the choice. Default off. */
  includeNew: boolean;
}

const TIER_KEYS = TIERS.map((t) => t.key) as TierKey[];

/** A selection from a request body; null when absent (= legacy / everything). */
export function cleanSelection(v: unknown): PostSelection | null {
  const s = v as Partial<PostSelection> | null;
  if (!s || typeof s !== 'object') return null;
  const keys = (a: unknown) => (Array.isArray(a) ? [...new Set(a.filter((x): x is string => typeof x === 'string' && /^[a-z0-9-]{1,60}$/.test(x)))].slice(0, 200) : []);
  return {
    v: 1,
    tiers: Array.isArray(s.tiers) ? TIER_KEYS.filter((t) => s.tiers!.includes(t)) : [...TIER_KEYS],
    setups: keys(s.setups),
    known: keys(s.known),
    includeNew: s.includeNew === true,
  };
}

/** Everything, as a selection (the dialog's starting state). */
export function selectAll(block: GearBlock | null): PostSelection {
  const keys = (block?.setups ?? []).map((s, i) => setupKey(s, i));
  return { v: 1, tiers: [...TIER_KEYS], setups: keys, known: keys, includeNew: false };
}

/** A bulk post's filter: levels, and account types / builds a setup must suit to go out. */
export interface PostFilter {
  tiers: TierKey[];
  accounts: string[];
  builds: string[];
  includeNew: boolean;
}

export function cleanFilter(v: unknown): PostFilter | null {
  const f = v as Partial<PostFilter> | null;
  if (!f || typeof f !== 'object') return null;
  const words = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && /^[a-z]{2,10}$/.test(x)).slice(0, 10) : []);
  return { tiers: Array.isArray(f.tiers) ? TIER_KEYS.filter((t) => f.tiers!.includes(t)) : [...TIER_KEYS], accounts: words(f.accounts), builds: words(f.builds), includeNew: f.includeNew === true };
}

/**
 * One guide's selection from a bulk filter: setups on the chosen levels that suit any chosen
 * account type and build (a setup with no tags suits everyone).
 */
export function selectionFromFilter(block: GearBlock | null, f: PostFilter): PostSelection {
  const all = (block?.setups ?? []).map((s, i) => ({ s, key: setupKey(s, i) }));
  const suits = (s: GearSetup) =>
    f.tiers.includes(s.tier) &&
    (!f.accounts.length || !s.accounts?.length || s.accounts.some((a) => f.accounts.includes(a))) &&
    (!f.builds.length || !s.builds?.length || s.builds.some((b) => f.builds.includes(b)));
  return { v: 1, tiers: f.tiers, setups: all.filter((x) => suits(x.s)).map((x) => x.key), known: all.map((x) => x.key), includeNew: f.includeNew };
}

export function setupSelected(sel: PostSelection, s: GearSetup, i: number): boolean {
  const key = setupKey(s, i);
  if (!sel.tiers.includes(s.tier)) return false;
  return sel.setups.includes(key) || (sel.includeNew && !sel.known.includes(key));
}

const SLOT_LABEL: Record<Slot | 'quiver', string> = {
  head: 'Head', cape: 'Cape', neck: 'Neck', ammo: 'Ammo', weapon: 'Weapon', body: 'Body', shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet', ring: 'Ring', quiver: 'Quiver',
};
const SPELLBOOKS = ['Standard', 'Ancient', 'Lunar', 'Arceuus'];
export const spellbookName = (n: number | undefined) => SPELLBOOKS[n ?? 0] ?? 'Standard';

/** Escape free text for a Discord message (no markdown injection, no mentions). */
export function discordText(s: string): string {
  return s.replace(/([*_~`|\\[\]<])/g, '\\$1').replace(/@/g, '@\u200b');
}

/** Free text that may hold a YouTube link: the link goes as the plain youtu.be URL, the rest escaped. */
export function discordRich(s: string): string {
  return s
    .split(/(\s+)/)
    .map((tok) => {
      const yt = /^\s+$/.test(tok) ? null : parseYouTube(tok);
      return yt ? youTubeLink(yt) : discordText(tok);
    })
    .join('');
}

const qtyLabel = (q: number) => (q >= 10_000_000 ? `${Math.floor(q / 1_000_000)}M` : q >= 100_000 ? `${Math.floor(q / 1000)}K` : q.toLocaleString('en-US'));
const MARKERS_INLINE_MAX = 1800;

/**
 * One setup as a Discord block: heading with numbers, who it's for, gear by slot with fallbacks
 * inline, inventory, rune pouch, spellbook and spells, steps, then the bank tag (and tile markers
 * when short) in code blocks. `names` gives item names for ids the gear data doesn't hold (supplies).
 */
export function setupDiscordBlock(
  s: GearSetup,
  block: GearBlock,
  idx: GearIndex,
  names: Record<number, string>,
  opts: { guideTitle: string; siteUrl: string | null },
): string {
  const name = (id: number) => idx.item(id)?.n ?? names[id] ?? `Item ${id}`;
  const monsters = blockTargets(block).map((k) => idx.monster(k)).filter((m): m is Monster => !!m);
  const r = monsters[0] ? bestStyle(setupLoadout(s), monsters[0], idx.item, idx.rules)?.result ?? null : null;
  const tier = TIERS.find((t) => t.key === s.tier)!;
  const lines: string[] = [];
  lines.push(`### ${tier.label} · ${discordText(s.name)}${s.pick ? ' ⭐' : ''}${r ? ` · \`${r.dps.toFixed(2)} DPS\` · ~${fmtDuration(r.ttk)} per kill` : ''}`);
  const who = [
    s.accounts?.length ? s.accounts.map(accountLabel).join(', ') : '',
    s.builds?.length ? s.builds.map(buildLabel).join(', ') : '',
    ...Object.entries(s.req?.levels ?? {}).map(([k, v]) => `${v} ${k[0].toUpperCase()}${k.slice(1)}`),
    ...(s.req?.quests ?? []).map(discordText),
    s.tag ? discordText(s.tag) : '',
  ].filter(Boolean);
  if (who.length) lines.push(`-# ${who.join(' · ')}`);
  const gear: string[] = [];
  for (const slot of [...SLOTS, 'quiver'] as (Slot | 'quiver')[]) {
    const id = slot === 'quiver' ? s.quiver : s.gear[slot];
    if (!id) continue;
    const alts = (s.alts?.[slot] ?? []).filter((x) => Number.isInteger(x) && x > 0);
    gear.push(`${SLOT_LABEL[slot]}: ${discordText(name(id))}${alts.length ? ` (or ${alts.map((a) => discordText(name(a))).join(' / ')})` : ''}`);
  }
  if (gear.length) lines.push(gear.join(' · '));
  const inv = new Map<number, number>();
  for (const it of s.inventory ?? []) if (it && it.id > 0) inv.set(it.id, (inv.get(it.id) ?? 0) + Math.max(1, it.q ?? 1));
  if (inv.size) lines.push(`Inventory: ${[...inv.entries()].map(([id, q]) => `${qtyLabel(q)}× ${discordText(name(id))}`).join(', ')}`);
  if (s.runePouch?.length) lines.push(`Rune pouch: ${s.runePouch.map((it) => `${qtyLabel(it.q ?? 1)} ${discordText(name(it.id))}`).join(' · ')}`);
  if (s.spellbook || s.spells?.length) lines.push(`Spellbook: ${spellbookName(s.spellbook)}${s.spells?.length ? ` · ${s.spells.map(discordText).join(', ')}` : ''}`);
  (s.steps ?? []).forEach((st, i) => lines.push(`${i + 1}. ${discordRich(st)}`));
  if (s.note) lines.push(`-# ${discordRich(s.note)}`);
  const tag = bankTagString({ name: `${opts.guideTitle} ${s.name}`.replace(/[@`]/g, ''), gear: s.gear, inventory: s.inventory, runePouch: s.runePouch, spellbook: s.spellbook, quiver: s.quiver });
  lines.push('Bank tag (Bank Tags → Import tag tab):', '```', tag, '```');
  const markers = s.markers?.length ? s.markers : block.markers?.[s.tier] ?? [];
  if (markers.length) {
    const json = groundMarkersJson(markers);
    if (json.length < MARKERS_INLINE_MAX) lines.push(`Tile markers (world map orb → Import Ground Markers):`, '```', json, '```');
    else if (opts.siteUrl) lines.push(`Tile markers: ${markers.length} tiles — [copy them on the site](<${opts.siteUrl}>)`);
  }
  return lines.join('\n');
}

/** The gear block for a selected post: one message per setup the clan picked. */
export function selectedGearMarkdown(
  block: GearBlock | null,
  sel: PostSelection,
  idx: GearIndex | null,
  names: Record<number, string>,
  opts: { guideTitle: string; siteUrl: string | null },
): string {
  if (!block) return '';
  const chosen = block.setups.map((s, i) => ({ s, i })).filter(({ s, i }) => setupSelected(sel, s, i));
  if (!chosen.length) return '';
  if (!idx) return `-# ${chosen.length} setup${chosen.length === 1 ? '' : 's'} — see the guide on the site`;
  return chosen.map(({ s }) => setupDiscordBlock(s, block, idx, names, opts)).join('\n---\n');
}

/** Tips for the Discord post: the top few, plain text, escaped. */
export function tipsMarkdown(tips: { text: string; kind: 'tip' | 'mistake'; useful: number }[]): string {
  const t = tips.filter((x) => x.kind === 'tip').slice(0, 5);
  const m = tips.filter((x) => x.kind === 'mistake').slice(0, 3);
  const out: string[] = [];
  if (t.length) out.push('### 💡 Tips', ...t.map((x) => `- ${discordRich(x.text)}${x.useful ? ` · ${x.useful} found this useful` : ''}`));
  if (m.length) out.push('### ⚠️ Common mistakes', ...m.map((x) => `- ${discordRich(x.text)}`));
  return out.join('\n');
}

/** The footer credit line (names escaped, no mentions). */
export const creditFooter = (line: string) => (line ? `-# ${line}` : '');

export { discordName };
