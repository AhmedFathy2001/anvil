// What the item hunt pages render, assembled once on the server from lib/itemHuntDb.
//
// Server only: the source choices for a manual proof come from the drop dataset (lib/itemObtain).

import { gainParts } from '@/lib/weeklyMetric';
import { weeklyMetricLabel } from '@/lib/constants';
import { rushRulesWords } from '@/lib/bossRushRules';
import { itemObtainInfo } from '@/lib/itemObtain';
import {
  type HuntConfig,
  dropOriginWords,
  dropScore,
  type HuntRule,
  dropStatWords,
  huntEndingWords,
  huntIconUrl,
  huntKindWord,
  huntLine,
  huntStat,
  huntStatLabel,
  manualStatKind,
  huntPets,
  huntRows,
  huntBountyBoard,
  isRush,
  rushTallyWords,
  type HuntRowProgress,
} from '@/lib/itemHunt';
import { parsePrizeCurrency, type PrizeCurrency } from '@/lib/competitionGame';
import { huntStandings, rushDeathShotsOf, type HuntStandings } from '@/lib/itemHuntDb';
import { weeklyStatus } from '@/lib/weeklyStage';
import { isHardcoreEntrant, MAIN } from '@/lib/competitionGame';

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
  /** What it put on a points hunt's standings: 0 for a repeat that scores nothing; null on other hunts. */
  score: number | null;
}

/** One entrant's kills (or XP) at each boss or skill of a hunt counted over several, named for a person. */
function splitOf(
  type: string,
  parts: { baseline: Record<string, number> | null; current: Record<string, number> | null } | undefined,
  gained: number,
): { label: string; gained: number; from: number; now: number }[] | null {
  const rows = gainParts(parts?.baseline, parts?.current, gained);
  return rows ? rows.map((r) => ({ label: weeklyMetricLabel(type, r.key) || r.key, gained: r.gained, from: r.from, now: r.now })) : null;
}

export interface HuntViewRow {
  rank: number;
  rsn: string;
  count: number;
  /** Boss Rush: "312 kc · +55 drops · 4 deaths", what the score is made of. */
  rushWords: string | null;
  isMe: boolean;
  /** Kills at the source (or XP) since the hunt started; null when the hunt shows neither. */
  statGain: number | null;
  /** Their starting line has not been read yet, so the gain is not known. */
  statPending: boolean;
  /** A hunt over several bosses: the kills at each, adding up to statGain. Null with one boss, or when the split is not known. */
  statParts: { label: string; gained: number; from: number; now: number }[] | null;
  drops: HuntViewDrop[];
  firstAt: string | null;
  lastAt: string | null;
  /** A Hardcore Worlds character (lib/competitionGame isHardcoreEntrant), and one that died mid-way. */
  hcw: boolean;
  stopped: boolean;
  /** v2: progress per row since the start ("Graardor +2,140 kc"); null on a v1 hunt. */
  progress: HuntRowProgress[] | null;
  /** v2: Due as a fraction (1 = one drop expected); null with no rate or no starting line. */
  due: number | null;
  /** How many of the hunt's rows they hold: "2 of 3". */
  held: number;
  /** "When a player has all of them": they do, since then. */
  completeAt: string | null;
  /** Item ids of the rows they hold, for the little icons beside the name. */
  heldIds: number[];
  /** Boss Rush, the viewer's own rows only: each death that cost points, with its screenshot. */
  deathShots?: RushDeathShot[];
}

/** One counted Boss Rush death as its player sees it. */
export interface RushDeathShot {
  at: string;
  source: string | null;
  url: string | null;
}

/** One target a manual proof can be for, with the sources it may name. */
export interface HuntProofTarget {
  itemId: number;
  name: string;
  /** Sources to choose from. `free` means any source is accepted (the list is a suggestion). */
  sources: string[];
  free: boolean;
  /** A pet row of a v2 hunt: no source to ask about, and one at a time. */
  pet?: boolean;
}

export interface HuntView {
  kindWord: string;
  /** "Uncut onyx from Zulrah · most by the end" */
  line: string;
  rule: HuntRule;
  /** A points hunt: each item and what it scores, for the line under the title. */
  points: { name: string; points: number }[] | null;
  /** Boss Rush: its scoring on one line ("1 kill = 1 pt · each death -1 · plugin kills only"). */
  rushRules: string | null;
  /** A points hunt: only each player's first drop of each item scores. */
  firstOfEach: boolean;
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
  /** Every one of the viewer's characters on this hunt, best placed first (`me` is the first). */
  mine: HuntViewRow[];
  drops: number;
  hunters: number;
  /** Drops the "after N drops" ending is waiting on staff for. */
  awaiting: { rsn: string; itemName: string; occurredAt: string }[];
  proof: { targets: HuntProofTarget[]; statKind: 'kc' | 'xp' | 'either'; xpSkill: string | null; pets: boolean };
  /** v2: rows with their own progress, and Due. */
  v2: boolean;
  /** The rows hunted, in order. */
  targets: { id: number; name: string; pet: boolean }[];
  /** v2: some row has a drop rate, so players without a drop are ordered by Due. */
  rated: boolean;
  /** "When a player has all of them". */
  endsAll: boolean;
  /** The rows with a bounty, each with its amounts by place and who has claimed it, in order. Empty: none. */
  bounties: { itemId: number; name: string; amounts: number[]; claimedBy: string[] }[];
  /** What the bounties (and prizes) are paid in. */
  currency: PrizeCurrency;
}

export function proofTargets(config: HuntConfig): HuntProofTarget[] {
  if (config.target === 'pets') {
    return huntPets(config).map((p) => ({ itemId: p.id, name: p.name, sources: [], free: true }));
  }
  return config.items.map((it) => it.pet ? { itemId: it.id, name: it.name, sources: [], free: true, pet: true } : ({
    itemId: it.id,
    name: it.name,
    sources: it.sources.length > 0 ? it.sources : [...new Set(itemObtainInfo(it.id).sources.map((s) => s.split('#')[0].trim()))],
    free: it.sources.length === 0,
  }));
}

export function buildHuntView(
  comp: { metric: string; startDate: string; endDate: string; status: string; countsOn?: string | null; prizeCurrency?: string | null },
  standings: HuntStandings,
  viewerMemberIds: number[] = [],
  deathShots: Map<string, RushDeathShot[]> = new Map(),
): HuntView {
  const { config } = standings;
  const stat = huntStat(config);
  const mine = new Set(standings.participants.filter((p) => p.clanMemberId != null && viewerMemberIds.includes(p.clanMemberId)).map((p) => p.rsn));
  const baselined = new Map(standings.participants.map((p) => [p.rsn, p.baselineValue != null]));
  const partsOf = new Map(standings.participants.map((p) => [p.rsn, { baseline: p.baselineParts, current: p.currentParts }]));
  const awaitingIds = new Set(standings.awaiting.map((d) => d.id));
  const gameOf = new Map(
    standings.participants.map((p) => [p.rsn, { hcw: isHardcoreEntrant(p.hiscoresTable, comp.countsOn ?? MAIN), stopped: p.stoppedAt != null }]),
  );
  const targets = huntRows(config).map((t) => ({ id: t.id, name: t.name, pet: !!t.pet }));
  const targetIds = new Set(targets.map((t) => t.id));
  const rows: HuntViewRow[] = standings.rows.map((r) => ({
    rank: r.rank,
    rsn: r.rsn,
    count: r.count,
    rushWords: r.rush ? rushTallyWords(r.rush) : null,
    isMe: mine.has(r.rsn),
    statGain: stat ? r.statGain : null,
    statPending: !!stat && !baselined.get(r.rsn),
    statParts: stat && r.statGain != null ? splitOf(stat.type, partsOf.get(r.rsn), r.statGain) : null,
    firstAt: r.firstAt,
    lastAt: r.lastAt,
    hcw: gameOf.get(r.rsn)?.hcw ?? false,
    stopped: gameOf.get(r.rsn)?.stopped ?? false,
    progress: standings.progress.get(r.rsn)?.rows ?? null,
    due: r.due,
    held: r.held,
    completeAt: r.completeAt,
    ...(mine.has(r.rsn) && deathShots.has(r.rsn) ? { deathShots: deathShots.get(r.rsn) } : {}),
    heldIds: [...new Set(r.drops.map((d) => d.itemId).filter((id): id is number => id != null && targetIds.has(id)))],
    drops: r.drops.map((d, i) => ({
      score: config.rule !== 'points' && config.rule !== 'rush' ? null : (config.repeat === 'first' || (config.rule === 'rush' && !!config.items.find((it) => it.id === d.itemId)?.once)) && r.drops.slice(0, i).some((e) => (e.itemId ?? e.itemName) === (d.itemId ?? d.itemName)) ? 0 : dropScore(config, d),
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
    points: config.rule === 'points' ? config.items.map((it) => ({ name: it.name, points: it.points ?? 1 })) : config.rule === 'rush' ? config.items.filter((it) => (it.points ?? 0) > 0).map((it) => ({ name: it.name, points: it.points ?? 0 })) : null,
    rushRules: isRush(config) ? rushRulesWords(config.rush) : null,
    firstOfEach: (config.rule === 'points' || config.rule === 'rush') && config.repeat === 'first',
    endingWords: huntEndingWords(config.ends),
    confirm: config.confirm,
    status: weeklyStatus(comp),
    iconUrl: huntIconUrl(config),
    multipleTargets: config.target === 'pets' || config.items.length > 1,
    v2: config.v === 2,
    targets,
    rated: Object.keys(standings.rates).length > 0,
    endsAll: config.ends.kind === 'all',
    statLabel: huntStatLabel(config),
    statUnit: stat ? (stat.type === 'boss' ? 'kills' : 'xp') : null,
    rows,
    me: rows.find((r) => r.isMe) ?? null,
    mine: rows.filter((r) => r.isMe),
    drops: standings.drops.length,
    hunters: rows.filter((r) => r.count > 0).length,
    awaiting: standings.awaiting.map((d) => ({ rsn: rsnOf.get(d.rsnKey) ?? d.rsnKey, itemName: d.itemName, occurredAt: d.occurredAt })),
    proof: { targets: proofTargets(config), statKind: manualStatKind(config), xpSkill: config.v === 2 ? null : config.xpSkill, pets: config.target === 'pets' },
    // standings.drops is already the counted drops inside the window.
    bounties: huntBountyBoard(config, standings.drops, { startMs: 0, endMs: null }, (k) => rsnOf.get(k) ?? k),
    currency: parsePrizeCurrency(comp.prizeCurrency),
  };
}

export async function loadHuntView(
  comp: { id: number; type: string; metric: string; hunt?: string | null; startDate: string; endDate: string; status: string; countsOn?: string | null },
  viewerMemberIds: number[] = [],
): Promise<HuntView | null> {
  const standings = await huntStandings(comp);
  if (!standings) return null;
  // A rush's death screenshots go to the player who died (staff see everyone's on the admin page).
  const shots = isRush(standings.config) && viewerMemberIds.length ? await rushDeathShotsOf(comp.id, viewerMemberIds) : new Map<string, RushDeathShot[]>();
  return buildHuntView(comp, standings, viewerMemberIds, shots);
}
