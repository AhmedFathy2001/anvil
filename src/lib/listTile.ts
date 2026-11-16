// LIST tiles: one Kills or Skill XP tile that counts several bosses / skills SEPARATELY, each to its
// own goal, done when all of them (or at least N) are ("50 each of these five bosses"). Stored as a
// combo whose rule carries `list` (lib/combo) and whose parts are one ordinary stat/kill tile per
// entry, so every tracker already understands it; the editor shows it as the kind it is. Pure.

import type { ComboList } from '@/lib/combo';
import { hiscoresKeyForMonster, hiscoresKeyLabel, killLineNameForKey, killSourceOf, type KillPick, type KillSource } from '@/lib/killSource';
import { statKeys } from '@/lib/tileKinds';
import type { ComboPartConfig, TileConfig } from '@/lib/types';

export interface ListEntry {
  /** The saved part behind this entry, kept so a re-save updates it (and its progress) in place. */
  id?: number;
  /** Kills: the pick's identity (`listKillKey`). Skill: the skill key. */
  key: string;
  goal: number;
  pick?: KillPick;
  /** Kills: the engine this part was saved on — frozen with the tile once the event runs. */
  source?: KillSource | null;
}

export interface ListTile {
  list: ComboList;
  /** How many entries must finish; 0 = all of them. */
  need: number;
  entries: ListEntry[];
  /** The goal most entries share: what the editor's one amount box shows. */
  shared: number;
  /** An ordinary tile of that kind holding every entry, to seed the editor's fields from. */
  seed: TileConfig;
}

export const listKillKey = (p: KillPick) => `${p.key ?? ''}|${p.name.toLowerCase()}`;

function partPicks(part: ComboPartConfig): KillPick[] {
  const source = killSourceOf(part);
  if (source === 'hiscores') return statKeys(part.trackedStat).map((key) => ({ name: killLineNameForKey(key) ?? hiscoresKeyLabel(key), key }));
  if (source === 'plugin') return (part.targetNpcs || []).map((name) => ({ name, key: hiscoresKeyForMonster(name) }));
  return [];
}

/** The list a stored tile holds, or null when it isn't one (an ordinary tile, or a real combo). */
export function readListTile(tile: TileConfig): ListTile | null {
  const list = tile.tileType === 'combo' ? tile.comboRule?.list : undefined;
  const parts = tile.parts ?? [];
  if (!list || parts.length === 0) return null;
  const entries: ListEntry[] = [];
  for (const part of parts) {
    if (list === 'skill') {
      if (part.statType !== 'skill' || !part.trackedStat) return null;
      entries.push({ id: part.id, key: part.trackedStat, goal: part.statGoal ?? 0 });
    } else {
      const [pick] = partPicks(part);
      const source = killSourceOf(part);
      if (!pick) return null;
      entries.push({ id: part.id, key: listKillKey(pick), pick, source, goal: (source === 'hiscores' ? part.statGoal : part.requiredAmount) ?? 0 });
    }
  }
  const counts = new Map<number, number>();
  for (const e of entries) counts.set(e.goal, (counts.get(e.goal) ?? 0) + 1);
  const shared = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const first = parts[0];
  const allHiscores = entries.every((e) => e.source === 'hiscores');
  const seed: TileConfig = {
    ...tile,
    comboRule: null,
    parts: null,
    statBasis: first.statBasis ?? 'gain',
    trackingMode: first.trackingMode ?? 'team',
    coopCredit: first.coopCredit ?? null,
    coopMinMembers: first.coopMinMembers ?? null,
    ...(list === 'skill'
      ? { tileType: 'standard', statType: 'skill', trackedStat: entries[0].key, statGoal: shared }
      : allHiscores
        ? { tileType: 'standard', statType: 'boss', trackedStat: entries.map((e) => e.pick!.key).join(','), statGoal: shared }
        : { tileType: 'kill', statType: null, trackedStat: null, targetNpcs: entries.map((e) => e.pick!.name), requiredAmount: shared }),
  };
  const rule = tile.comboRule!;
  return { list, need: rule.mode === 'nOf' ? Math.min(rule.n ?? entries.length, entries.length) : 0, entries, shared, seed };
}

/** The rule a list saves under: all of them, or at least `need` (0 / the whole count = all). */
export function listRule(list: ComboList, need: number, count: number): { mode: 'all' | 'nOf'; n?: number; list: ComboList } {
  return need > 0 && need < count ? { mode: 'nOf', n: need, list } : { mode: 'all', list };
}
