// A gear block as text — for Discord, which can't run the calculator. PURE.

import { bestStyle, type GearItem, type ItemLookup, type Loadout, type Monster } from './engine';
import { SLOTS } from './tables';
import type { EffectRule } from './effects';
import { TIERS, blockTargets, bodyForDiscord, setupTargets, type GearBlock, type GearSetup } from '../guideTiers';
import { encounter } from './encounter';

export interface GearData {
  items: GearItem[];
  monsters: Monster[];
  /** Custom effect rules from platform staff (lib/dps/effects). */
  rules?: EffectRule[];
  /** Changes whenever the data or its overrides do — the client cache key. */
  version?: string;
}

export interface GearIndex {
  item: ItemLookup;
  monster: (key: string) => Monster | null;
  items: GearItem[];
  monsters: Monster[];
  rules: EffectRule[];
}

/** Lookups over the datasets. "Name#Version" picks a version; a bare name takes the first. */
export function indexGear(data: GearData): GearIndex {
  const byId = new Map(data.items.map((i) => [i.id, i]));
  return {
    items: data.items,
    monsters: data.monsters,
    rules: data.rules ?? [],
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
  const monsters = blockTargets(block).map((k) => idx.monster(k));
  if (monsters.some((m) => !m)) return `-# Gear progression: unknown monster in "${blockTargets(block).join(', ')}".`;
  const ms = monsters as Monster[];
  const multi = ms.length > 1;
  const lines = [`### ⚔️ Gear progression vs ${multi ? ms.map((m) => m.n).join(', ') : monsterLabel(ms[0])}`];
  for (const t of TIERS) {
    const tierSetups = block.setups.filter((x) => x.tier === t.key);
    if (!tierSetups.length) continue;
    if (multi) {
      // The tier's setups together, each target killed with the best one for it.
      const run = encounter(
        tierSetups.map((s) => ({ loadout: setupLoadout(s), targets: setupTargets(s, block).map((k) => blockTargets(block).indexOf(k)) })),
        ms,
        idx.item,
        idx.rules,
      );
      lines.push(`**${t.emoji} ${t.label}** · full run ~${fmtDuration(run.time)} · \`${run.dps.toFixed(2)} DPS\``);
      for (const s of tierSetups) {
        const names = SLOTS.map((slot) => idx.item(s.gear[slot])?.n).filter(Boolean);
        lines.push(`-# ${s.name} (${setupTargets(s, block).map((k) => k.split('#')[0]).join(', ')}): ${names.join(' · ')}`);
      }
    } else {
      for (const s of tierSetups) {
        const r = bestStyle(setupLoadout(s), ms[0], idx.item, idx.rules)?.result ?? null;
        const stat = r ? ` · \`${r.dps.toFixed(2)} DPS\` · max hit \`${r.maxHit}\` · ~${fmtDuration(r.ttk)} per kill` : '';
        lines.push(`**${t.emoji} ${t.label} — ${s.name}**${stat}`);
        const names = SLOTS.map((slot) => idx.item(s.gear[slot])?.n).filter(Boolean);
        if (names.length) lines.push(`-# ${names.join(' · ')}`);
      }
    }
  }
  if (siteUrl) lines.push('', `🧮 [Check your own gear, inventory setups and bank tags](<${siteUrl}>)`);
  return lines.join('\n');
}

/** The body Discord gets: tiers as headed messages, gear blocks as summaries. */
export function discordBody(body: string, idx: GearIndex | null, siteUrl: string | null): string {
  return bodyForDiscord(body, (block) =>
    idx ? gearSummaryMarkdown(block, idx, siteUrl) : block ? `-# ⚔️ Gear progression vs ${block.monster} — ${block.setups.length} setups` : '',
  );
}
