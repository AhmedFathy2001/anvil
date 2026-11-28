// A competition's drops for the plugin panel: "Best drops" and "Latest", as plain rows the panel's
// highlight nodes draw (lib/pluginUi/highlightsUi). Served by /api/plugin/weekly-leaderboard, which
// has already applied the clan's and the competition's privacy rules before calling this.
//
// Skill, boss and efficiency competitions read the moments attached to them at ingest (lib/moments);
// an item hunt reads its own counted drops, which are the whole point of it.

import type { DropMoment } from '@/lib/bestDrops';
import { rushFeedFacts, type HuntStandings } from '@/lib/itemHuntDb';
import { dropIsPet, firstDoneWords, huntPanelLine, huntStat, isRush, rushDropPoints } from '@/lib/itemHunt';
import { deathCause } from '@/lib/deathSource';
import { bestDropMoments, momentsForCompetition } from '@/lib/momentsStore';
import { PANEL_FEED, type PanelFeedLine, type PanelHighlights, namesWords, panelHighlights } from '@/lib/pluginUi/highlightsUi';
import { weeklyRsnKey } from '@/lib/weeklyRsn';

export async function competitionHighlights(
  comp: { id: number; type: string },
  hunt: HuntStandings | null,
  onBoard: ReadonlySet<string>,
): Promise<PanelHighlights | null> {
  const h = await highlightsOnly(comp, hunt, onBoard);
  const feed = await competitionFeedLines(comp, hunt, onBoard);
  if (!h && !feed.length) return null;
  return { ...(h ?? { best: [], latest: [] }), ...(feed.length ? { feed } : {}) };
}

/**
 * The competition's feed for the panel, newest first: its drops (a rush's with their points), its
 * deaths (a rush's counted ones, else the deaths stored for it), and a rush's kills finished together.
 */
async function competitionFeedLines(comp: { id: number; type: string }, hunt: HuntStandings | null, onBoard: ReadonlySet<string>): Promise<PanelFeedLine[]> {
  const lines: PanelFeedLine[] = [];
  const shown = (rsn: string) => onBoard.has(weeklyRsnKey(rsn));
  if (hunt) {
    const rsnOf = new Map(hunt.participants.map((p) => [weeklyRsnKey(p.rsn), p.rsn]));
    for (const d of hunt.drops) {
      const who = rsnOf.get(d.rsnKey) ?? d.rsnKey;
      if (!shown(who)) continue;
      const pts = isRush(hunt.config) ? rushDropPoints(hunt.config, d) : 0;
      lines.push({ kind: 'drop', who, text: d.quantity > 1 ? `${d.itemName} ×${d.quantity}` : d.itemName, itemId: d.itemId, ...(pts > 0 ? { pts } : {}), at: d.occurredAt });
    }
    if (isRush(hunt.config)) {
      const facts = await rushFeedFacts(comp.id);
      for (const d of facts.deaths) if (shown(d.rsn)) lines.push({ kind: 'death', who: d.rsn, text: d.source ? `died to ${d.source}` : 'died', at: d.at });
      for (const t of facts.together) {
        const who = t.who.filter(shown);
        if (who.length >= 2) lines.push({ kind: 'together', who: namesWords(who), text: `finished ${t.target} together`, at: t.at });
      }
    }
  } else if (comp.type !== 'efficiency') {
    for (const m of await momentsForCompetition(comp.id, 40)) {
      if (!shown(m.rsn)) continue;
      if (m.kind === 'death') lines.push({ kind: 'death', who: m.rsn, text: deathCause(m.source, m.sourceKind) ? `died to ${deathCause(m.source, m.sourceKind)}` : 'died', at: m.occurredAt });
      else if ((m.kind === 'pet' || m.kind === 'unique' || m.kind === 'loot') && (m.itemName || m.kind === 'pet')) {
        lines.push({ kind: 'drop', who: m.rsn, text: m.itemName ?? 'A pet', itemId: m.itemId, at: m.occurredAt });
      }
    }
  }
  return lines.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, PANEL_FEED);
}

async function highlightsOnly(
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
  return hunt.rows.flatMap((r): { rsn: string; sub: string | null; figure?: string | null }[] => {
    // "First to get it": a player with a drop is done, in their place.
    if (hunt.config.rule === 'first' && r.count > 0) return [{ rsn: r.rsn, sub: null, figure: firstDoneWords(r.rank) }];
    if (r.statGain == null) return [];
    const n = r.statGain.toLocaleString('en-US');
    const sub = stat.type === 'boss' ? `${n} ${r.statGain === 1 ? 'kill' : 'kills'}${r.count === 0 && r.statGain > 0 ? ', no drop' : ''}` : `${n} xp gained`;
    return [{ rsn: r.rsn, sub }];
  });
}
