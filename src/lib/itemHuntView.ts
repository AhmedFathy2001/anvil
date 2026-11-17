// What the item hunt pages render, assembled once on the server from lib/itemHuntDb.
//
// Server only: the source choices for a manual proof come from the drop dataset (lib/itemObtain).

import { itemObtainInfo } from '@/lib/itemObtain';
import {
  type HuntConfig,
  dropOriginWords,
  dropStatWords,
  huntEndingWords,
  huntIconUrl,
  huntKindWord,
  huntLine,
  huntStat,
  huntStatLabel,
  manualStatKind,
  petGroupOf,
} from '@/lib/itemHunt';
import { huntStandings, type HuntStandings } from '@/lib/itemHuntDb';
import { weeklyStatus } from '@/lib/weeklyStage';

export interface HuntViewDrop {
  id: number;
  itemId: number | null;
  itemName: string;
  quantity: number;
  source: string | null;
  occurredAt: string;
  /** "at 1,204 kc" / "at 13,034,431 Woodcutting XP" */
  stat: string | null;
  /** "plugin" / "manual proof (approved by Olive)" */
  origin: string;
  manual: boolean;
  confirmed: boolean;
  /** The hunt would end on this drop, and staff have not confirmed it yet. */
  awaiting: boolean;
  screenshotUrl: string | null;
}

export interface HuntViewRow {
  rank: number;
  rsn: string;
  count: number;
  isMe: boolean;
  /** Kills at the source (or XP) since the hunt started; null when the hunt shows neither. */
  statGain: number | null;
  /** Their starting line has not been read yet, so the gain is not known. */
  statPending: boolean;
  drops: HuntViewDrop[];
  firstAt: string | null;
  lastAt: string | null;
}

/** One target a manual proof can be for, with the sources it may name. */
export interface HuntProofTarget {
  itemId: number;
  name: string;
  /** Sources to choose from. `free` means any source is accepted (the list is a suggestion). */
  sources: string[];
  free: boolean;
}

export interface HuntView {
  kindWord: string;
  /** "Uncut onyx from Zulrah · most by the end" */
  line: string;
  rule: 'first' | 'most';
  endingWords: string;
  confirm: 'staff' | 'auto';
  status: 'upcoming' | 'active' | 'completed';
  iconUrl: string | null;
  multipleTargets: boolean;
  /** "Zulrah" / "Woodcutting": what the stat column is about. Null: no column. */
  statLabel: string | null;
  statUnit: 'kills' | 'xp' | null;
  rows: HuntViewRow[];
  me: HuntViewRow | null;
  drops: number;
  hunters: number;
  /** Drops the "after N drops" ending is waiting on staff for. */
  awaiting: { rsn: string; itemName: string; occurredAt: string }[];
  proof: { targets: HuntProofTarget[]; statKind: 'kc' | 'xp' | 'either'; xpSkill: string | null; pets: boolean };
}

export function proofTargets(config: HuntConfig): HuntProofTarget[] {
  if (config.target === 'pets') {
    return (petGroupOf(config.petGroup)?.items ?? []).map((p) => ({ itemId: p.id, name: p.name, sources: [], free: true }));
  }
  return config.items.map((it) => ({
    itemId: it.id,
    name: it.name,
    sources: it.sources.length > 0 ? it.sources : [...new Set(itemObtainInfo(it.id).sources.map((s) => s.split('#')[0].trim()))],
    free: it.sources.length === 0,
  }));
}

export function buildHuntView(
  comp: { metric: string; startDate: string; endDate: string; status: string },
  standings: HuntStandings,
  viewerMemberIds: number[] = [],
): HuntView {
  const { config } = standings;
  const stat = huntStat(config);
  const mine = new Set(standings.participants.filter((p) => p.clanMemberId != null && viewerMemberIds.includes(p.clanMemberId)).map((p) => p.rsn));
  const baselined = new Map(standings.participants.map((p) => [p.rsn, p.baselineValue != null]));
  const awaitingIds = new Set(standings.awaiting.map((d) => d.id));
  const rows: HuntViewRow[] = standings.rows.map((r) => ({
    rank: r.rank,
    rsn: r.rsn,
    count: r.count,
    isMe: mine.has(r.rsn),
    statGain: stat ? r.statGain : null,
    statPending: !!stat && !baselined.get(r.rsn),
    firstAt: r.firstAt,
    lastAt: r.lastAt,
    drops: r.drops.map((d) => ({
      id: d.id,
      itemId: d.itemId,
      itemName: d.itemName,
      quantity: d.quantity,
      source: d.source,
      occurredAt: d.occurredAt,
      stat: dropStatWords(d),
      origin: dropOriginWords(d),
      manual: d.origin === 'manual',
      confirmed: d.confirmed,
      awaiting: awaitingIds.has(d.id),
      screenshotUrl: d.screenshotUrl,
    })),
  }));
  const rsnOf = new Map(standings.participants.map((p) => [p.rsn.replace(/\s+/g, ' ').trim().toLowerCase(), p.rsn]));
  return {
    kindWord: huntKindWord(config),
    line: huntLine(config, comp.metric),
    rule: config.rule,
    endingWords: huntEndingWords(config.ends),
    confirm: config.confirm,
    status: weeklyStatus(comp),
    iconUrl: huntIconUrl(config),
    multipleTargets: config.target === 'pets' || config.items.length > 1,
    statLabel: huntStatLabel(config),
    statUnit: stat ? (stat.type === 'boss' ? 'kills' : 'xp') : null,
    rows,
    me: rows.find((r) => r.isMe) ?? null,
    drops: standings.drops.length,
    hunters: rows.filter((r) => r.count > 0).length,
    awaiting: standings.awaiting.map((d) => ({ rsn: rsnOf.get(d.rsnKey) ?? d.rsnKey, itemName: d.itemName, occurredAt: d.occurredAt })),
    proof: { targets: proofTargets(config), statKind: manualStatKind(config), xpSkill: config.xpSkill, pets: config.target === 'pets' },
  };
}

export async function loadHuntView(
  comp: { id: number; type: string; metric: string; hunt?: string | null; startDate: string; endDate: string; status: string },
  viewerMemberIds: number[] = [],
): Promise<HuntView | null> {
  const standings = await huntStandings(comp);
  return standings ? buildHuntView(comp, standings, viewerMemberIds) : null;
}
