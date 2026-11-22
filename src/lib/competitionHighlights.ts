// A competition's drops for the plugin panel: "Best drops" and "Latest", as plain rows the panel's
// highlight nodes draw (lib/pluginUi/highlightsUi). Served by /api/plugin/weekly-leaderboard, which
// has already applied the clan's and the competition's privacy rules before calling this.
//
// Skill, boss and efficiency competitions read the moments attached to them at ingest (lib/moments);
// an item hunt reads its own counted drops, which are the whole point of it.

import type { DropMoment } from '@/lib/bestDrops';
import { type HuntStandings } from '@/lib/itemHuntDb';
import { dropIsPet, huntPanelLine, huntStat } from '@/lib/itemHunt';
import { bestDropMoments, momentsForCompetition } from '@/lib/momentsStore';
import { type PanelHighlights, panelHighlights } from '@/lib/pluginUi/highlightsUi';
import { weeklyRsnKey } from '@/lib/weeklyRsn';

export async function competitionHighlights(
  comp: { id: number; type: string },
  hunt: HuntStandings | null,
  onBoard: ReadonlySet<string>,
): Promise<PanelHighlights | null> {
  if (hunt) {
    const rsnOf = new Map(hunt.participants.map((p) => [weeklyRsnKey(p.rsn), p.rsn]));
    return panelHighlights(
      hunt.drops.map((d) => ({
        id: d.id,
        rsn: rsnOf.get(d.rsnKey) ?? d.rsnKey,
        kind: dropIsPet(hunt.config, d.itemId) ? 'pet' : 'unique',
        itemId: d.itemId,
        itemName: d.itemName,
        valueGp: null,
        kc: d.kc,
        rarityDenominator: null,
        occurredAt: d.occurredAt,
      })),
      onBoard,
    );
  }
  // Two bounded reads: the best by rank (never the newest N), and the newest few.
  const [best, newest] = await Promise.all([bestDropMoments(comp.id), momentsForCompetition(comp.id, 40)]);
  const seen = new Set<number>();
  const rows: DropMoment[] = [];
  for (const m of [...best, ...newest]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    rows.push(m);
  }
  return panelHighlights(rows, onBoard);
}

/**
 * An item hunt's dim line per player: kills at the source (or XP) since it started, and whether they
 * are dry. A v2 hunt also gives the figure on the right ("8 pts · 2/3", "61% due"), and its line is
 * the progress on the rows still missing (lib/itemHunt huntPanelLine).
 */
export function huntPanelSubs(hunt: HuntStandings): { rsn: string; sub: string | null; figure?: string | null }[] {
  if (hunt.config.v === 2) {
    return hunt.rows.map((r) => ({ rsn: r.rsn, ...huntPanelLine(hunt.config, r, hunt.progress.get(r.rsn)?.rows ?? null) }));
  }
  const stat = huntStat(hunt.config);
  if (!stat) return [];
  return hunt.rows.flatMap((r) => {
    if (r.statGain == null) return [];
    const n = r.statGain.toLocaleString('en-US');
    const sub = stat.type === 'boss' ? `${n} ${r.statGain === 1 ? 'kill' : 'kills'}${r.count === 0 && r.statGain > 0 ? ', no drop' : ''}` : `${n} xp gained`;
    return [{ rsn: r.rsn, sub }];
  });
}
