// A gear block as text — for Discord, which can't run the calculator. PURE.

import { bestStyle, type GearItem, type ItemLookup, type Loadout, type Monster } from './engine';
import { SLOTS } from './tables';
import { TIERS, bodyForDiscord, type GearBlock, type GearSetup } from '../guideTiers';

export interface GearData {
  items: GearItem[];
  monsters: Monster[];
}

export interface GearIndex {
  item: ItemLookup;
  monster: (key: string) => Monster | null;
  items: GearItem[];
  monsters: Monster[];
}

/** Lookups over the datasets. "Name#Version" picks a version; a bare name takes the first. */
export function indexGear(data: GearData): GearIndex {
  const byId = new Map(data.items.map((i) => [i.id, i]));
  return {
    items: data.items,
    monsters: data.monsters,
    item: (id) => (id == null ? null : (byId.get(id) ?? null)),
    monster: (key) => {
      const [name, version] = key.split('#');
      const lname = name.trim().toLowerCase();
      return (
        data.monsters.find((m) => m.n.toLowerCase() === lname && (version == null || (m.v ?? '') === version)) ??
        data.monsters.find((m) => m.n.toLowerCase() === lname) ??
        null
      );
    },
  };
}

export const monsterKey = (m: Monster) => (m.v ? `${m.n}#${m.v}` : m.n);
export const monsterLabel = (m: Monster) => (m.v ? `${m.n} (${m.v})` : m.n);

export function setupLoadout(s: GearSetup): Loadout {
  return {
    gear: s.gear,
    style: s.style ?? 0,
    spell: s.spell ?? null,
    dart: s.dart ?? null,
    stats: s.stats,
    prayer: s.prayer ?? null,
    boost: s.boost ?? null,
    onTask: s.onTask ?? false,
  };
}

/** m:ss, or h:mm:ss past an hour. */
export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function gearSummaryMarkdown(block: GearBlock | null, idx: GearIndex, siteUrl: string | null): string {
  if (!block) return '';
  const monster = idx.monster(block.monster);
  if (!monster) return `-# Gear progression: unknown monster "${block.monster}".`;
  const lines = [`### ⚔️ Gear progression vs ${monsterLabel(monster)}`];
  for (const t of TIERS) {
    for (const s of block.setups.filter((x) => x.tier === t.key)) {
      const r = bestStyle(setupLoadout(s), monster, idx.item)?.result ?? null;
      const stat = r ? ` · \`${r.dps.toFixed(2)} DPS\` · max hit \`${r.maxHit}\` · ~${fmtDuration(r.ttk)} per kill` : '';
      lines.push(`**${t.emoji} ${t.label} — ${s.name}**${stat}`);
      const names = SLOTS.map((slot) => idx.item(s.gear[slot])?.n).filter(Boolean);
      if (names.length) lines.push(`-# ${names.join(' · ')}`);
    }
  }
  if (siteUrl) lines.push('', `🧮 [Check your own gear and upgrade route](<${siteUrl}>)`);
  return lines.join('\n');
}

/** The body Discord gets: tiers as headed messages, gear blocks as summaries. */
export function discordBody(body: string, idx: GearIndex | null, siteUrl: string | null): string {
  return bodyForDiscord(body, (block) =>
    idx ? gearSummaryMarkdown(block, idx, siteUrl) : block ? `-# ⚔️ Gear progression vs ${block.monster} — ${block.setups.length} setups` : '',
  );
}
