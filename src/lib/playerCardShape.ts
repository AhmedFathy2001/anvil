import { BOSSES } from '@/lib/constants';
import { groupOf, type PageGroup } from '@/lib/clogRarity';
import { clogPageItems, clogPageNames } from '@/lib/clogDataset';
import { clogPageForBoss } from '@/lib/clogKillcounts';
import { personalBestEntries, type PbEntry } from '@/lib/pbGroups';
import { totalXpLabel } from '@/lib/totalXpMilestones';

// The plugin's player card: one character, told as a story rather than a hiscores table.
//
// The side panel is ~230px wide. WOM's lookup fills it with three tables of mostly `0 / --`; this is
// the opposite bet — only what's notable about the account, newest and biggest first, and nothing
// that's zero. The full tables stay on /p/<rsn>, one click away.
//
// Pure on purpose: the route loads rows, this decides what the card says, and a test can drive it
// without a database.

export interface PlayerCardGroup {
  name: PageGroup;
  obtained: number;
  total: number;
}

export interface PlayerCardLatest {
  /** 'item' = a collection log slot we watched land; 'milestone' = a 99, KC or XP threshold. */
  kind: 'item' | 'milestone';
  label: string;
  /** Set for items, so the plugin can draw the item's own icon. */
  itemId: number | null;
  at: string;
}

export interface PlayerCardBoss {
  key: string;
  /** The game's name for it — the plugin matches this to RuneLite's hiscore sprites. */
  label: string;
  kc: number;
  /** The log page its kills fill (a raid's modes share one), or null — clicking the boss opens it. */
  clogPage?: string | null;
}

export interface PlayerCardSkill {
  key: string;
  level: number;
  xp: number;
}

export interface PlayerCardActivity {
  key: string;
  label: string;
  /** "Elite" where the row already sits under a Clues heading. */
  shortLabel: string;
  /** 'clues' | 'minigames' | 'collection'. */
  group: string;
  score: number;
}

export interface PlayerCardPage {
  name: string;
  group: PageGroup;
  obtained: number;
  total: number;
  /** An item to draw the page by — its first slot, usually the pet or the signature drop. */
  iconItemId: number | null;
}

export interface PlayerCard {
  rsn: string;
  accountType: string | null;
  /** `logoUrl` is the clan's own image; absent/null = the crest. */
  clan: { slug: string; name: string; logoUrl?: string | null } | null;
  totalLevel: number;
  combatLevel: number | null;
  overallXp: number | null;
  ehp: number | null;
  ehb: number | null;
  statsAt: string | null;
  /** Null until they've synced their log at least once. */
  clog: { obtained: number; total: number; groups: PlayerCardGroup[] } | null;
  latest: PlayerCardLatest[];
  topBosses: PlayerCardBoss[];
  // ---- The in-panel profile: the detail behind the summary above. ----
  /** Every skill but overall, in the order the site knows them. Empty until stats are tracked. */
  skills: PlayerCardSkill[];
  /** Every boss with a kill, highest first. */
  bosses: PlayerCardBoss[];
  /** Clues, minigames and the like — only those with a score. */
  activities: PlayerCardActivity[];
  /** Every log page, grouped and in group order; empty until the log is synced. */
  clogPages: PlayerCardPage[];
  /** Personal bests the plugin uploaded: one entry per boss and mode, best time first, team sizes behind it. */
  times: PbEntry[];
  /**
   * Absent on a card about an Anvil account. 'hiscores' = nobody on Anvil has this name, so the card
   * was built from a public hiscores lookup (lib/publicHiscoresCard): no clan, no log, no history —
   * the plugin should say so rather than show those sections as empty.
   */
  source?: 'hiscores';
  /** With source 'hiscores': when that lookup was made (it is cached, so it can trail by minutes). */
  fetchedAt?: string;
}

export interface PlayerCardInput {
  rsn: string;
  accountType: string | null;
  /** `logoUrl` is the clan's own image; absent/null = the crest. */
  clan: { slug: string; name: string; logoUrl?: string | null } | null;
  totalLevel: number;
  combatLevel: number | null;
  overallXp: number | null;
  ehp: number | null;
  ehb: number | null;
  statsAt: string | null;
  bosses: { key: string; kc: number }[];
  skills?: { key: string; level: number; xp: number }[];
  activities?: { key: string; label: string; shortLabel: string; group: string; score: number }[];
  bests?: { activity: string; time: string }[];
  clogHeader: { obtained: number; total: number } | null;
  clogPages: { name: string; obtained: number; total: number }[];
  recentItems: { itemId: number; name: string; at: string }[];
  milestones: { kind: string; metric: string | null; threshold: number; noticedAt: string }[];
}

/**
 * Pages whose first slot isn't the picture anyone thinks of. A raid is its megarare — the Twisted bow,
 * the Scythe, Tumeken's shadow — not whichever item the log happens to list first.
 */
const PAGE_ICON: Record<string, number> = {
  'Chambers of Xeric': 20997, // Twisted bow
  'Theatre of Blood': 22486, // Scythe of vitur (uncharged)
  'Tombs of Amascut': 27277, // Tumeken's shadow (uncharged)
};

const GROUP_ORDER: PageGroup[] = ['Bosses', 'Raids', 'Clues', 'Minigames', 'Other'];
const TOP_BOSSES = 6;
const LATEST = 3;

const bossLabel = new Map(BOSSES.map((b) => [b.key, b.label]));

/** Skill keys are lowercase ('slayer'); the game writes them capitalised. */
function skillName(key: string): string {
  return key ? key[0].toUpperCase() + key.slice(1) : key;
}

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${+(n / 1_000_000_000).toFixed(1)}b`;
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}m`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString('en-US');
}

/** "99 Slayer", "1,000 Vorkath KC", "50m Slayer XP", "2,000 total". Null for a kind we don't word. */
export function milestoneLabel(m: { kind: string; metric: string | null; threshold: number }): string | null {
  const metric = m.metric ?? '';
  switch (m.kind) {
    case 'level':
      return `${m.threshold} ${skillName(metric)}`;
    case 'xp':
      return `${compact(m.threshold)} ${skillName(metric)} XP`;
    case 'kc':
      return `${m.threshold.toLocaleString('en-US')} ${bossLabel.get(metric) ?? metric} KC`;
    case 'total':
      return `${m.threshold.toLocaleString('en-US')} total`;
    case 'totalxp':
      return `${totalXpLabel(m.threshold)} total XP`;
    case 'ehp':
      return `${m.threshold.toLocaleString('en-US')} EHP`;
    case 'ehb':
      return `${m.threshold.toLocaleString('en-US')} EHB`;
    default:
      return null;
  }
}

/** Timestamps arrive in two formats (SQLite-style space and JS ISO); compare on a normalised form. */
function sortKey(at: string): string {
  return at.replace(' ', 'T');
}

export function shapePlayerCard(input: PlayerCardInput): PlayerCard {
  const bossLabels = new Set(BOSSES.map((b) => b.label.toLowerCase()));
  const pageNames = clogPageNames();

  let clog: PlayerCard['clog'] = null;
  if (input.clogHeader) {
    const byGroup = new Map<PageGroup, PlayerCardGroup>();
    for (const page of input.clogPages) {
      const name = groupOf(page.name, bossLabels);
      const g = byGroup.get(name) ?? { name, obtained: 0, total: 0 };
      g.obtained += page.obtained;
      g.total += page.total;
      byGroup.set(name, g);
    }
    clog = {
      obtained: input.clogHeader.obtained,
      total: input.clogHeader.total,
      groups: GROUP_ORDER.map((n) => byGroup.get(n)).filter((g): g is PlayerCardGroup => !!g && g.total > 0),
    };
  }

  const latest: PlayerCardLatest[] = [
    ...input.recentItems.map((i) => ({ kind: 'item' as const, label: i.name, itemId: i.itemId, at: i.at })),
    ...input.milestones.flatMap((m) => {
      const label = milestoneLabel(m);
      return label ? [{ kind: 'milestone' as const, label, itemId: null, at: m.noticedAt }] : [];
    }),
  ]
    .sort((a, b) => sortKey(b.at).localeCompare(sortKey(a.at)))
    .slice(0, LATEST);

  const bosses = input.bosses
    .filter((b) => b.kc > 0 && bossLabel.has(b.key))
    .sort((a, b) => b.kc - a.kc)
    .map((b) => ({ key: b.key, label: bossLabel.get(b.key)!, kc: b.kc, clogPage: clogPageForBoss(b.key, pageNames) }));
  const topBosses = bosses.slice(0, TOP_BOSSES);

  const clogPages: PlayerCardPage[] = input.clogHeader
    ? input.clogPages
        .map((p) => ({
          name: p.name,
          group: groupOf(p.name, bossLabels),
          obtained: p.obtained,
          total: p.total,
          iconItemId: PAGE_ICON[p.name] ?? clogPageItems(p.name)[0]?.id ?? null,
        }))
        .filter((p) => p.total > 0)
        .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name))
    : [];

  return {
    rsn: input.rsn,
    accountType: input.accountType,
    clan: input.clan,
    totalLevel: input.totalLevel,
    combatLevel: input.combatLevel,
    overallXp: input.overallXp,
    ehp: input.ehp,
    ehb: input.ehb,
    statsAt: input.statsAt,
    clog,
    latest,
    topBosses,
    skills: (input.skills ?? []).filter((sk) => sk.key !== 'overall' && sk.level > 0),
    bosses,
    activities: (input.activities ?? []).filter((a) => a.score > 0),
    clogPages,
    times: personalBestEntries(input.bests ?? []),
  };
}
