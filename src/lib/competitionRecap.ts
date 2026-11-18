import { placesAfter, type FeedEntry, type FeedMoment } from '@/lib/competitionFeed';

/**
 * A finished competition, looked back on: how the lead moved, who died where, who was lucky.
 *
 * Drops and deaths reach the site only from players running the plugin, while kills come from the
 * hiscores for everyone. So anything that divides one by the other (kills per death, the cleanest
 * week, the driest) is worked out over the players the plugin was seen for this week: the ones with
 * at least one moment of any kind. Somebody with 600 kills and no plugin did not have a deathless
 * week, the site just never saw it.
 *
 * Pure: the page hands it the standings and the competition's moments.
 */

export interface DeathTally {
  rsn: string;
  count: number;
  /** Where they died, most first. */
  split: { source: string; count: number }[];
  mine: boolean;
}

export interface RecapDrop {
  rsn: string;
  itemName: string;
  source: string | null;
  rarity: number | null;
  kc: number | null;
  xp: number | null;
  /** 'YYYY-MM-DD' */
  day: string;
  pet: boolean;
}

export interface CompetitionRecap {
  /** How many times first place changed hands after the first day anyone scored. Null without a day-by-day. */
  leadChanges: number | null;
  /** The winner, and the day (index) their unbroken run in first began. */
  leader: { rsn: string; sinceDay: number } | null;
  biggestDay: { rsn: string; value: number; day: number } | null;
  drops: number;
  pets: number;
  deaths: number;
  /** Kills per death, over the players the plugin was seen for. Boss weeks only. */
  killsPerDeath: number | null;
  deathBoard: {
    bySource: { source: string; deaths: number; most: { rsn: string; count: number } }[];
    /** The three who died most: the blame is shared. */
    top: DeathTally[];
    /** The viewer's own, when they died and are not in the three. */
    me: DeathTally | null;
    cleanest: { rsn: string; kills: number; deaths: number } | null;
    worstDay: { rsn: string; count: number; source: string | null; day: string } | null;
  } | null;
  luck: {
    rarest: RecapDrop | null;
    luckiest: { rsn: string; drops: number; kills: number } | null;
    driest: { rsn: string; kills: number } | null;
    list: RecapDrop[];
  } | null;
  mine: { bestDay: { value: number; day: number } | null; drops: number; deaths: number; killsPerDeath: number | null } | null;
}

export interface RecapEntry extends FeedEntry {
  gained: number;
}

/** A killer the site could not name still counts as a death; it is grouped under this. */
export const UNKNOWN_KILLER = 'somewhere unnamed';

/** The cleanest week has to be a real week: at least this share of the most kills among the players seen. */
const CLEANEST_MIN_SHARE = 0.2;

const isDrop = (m: FeedMoment) => m.kind === 'pet' || m.kind === 'unique';
const byCountThenName = <T extends { rsn: string; count: number }>(a: T, b: T) => b.count - a.count || a.rsn.localeCompare(b.rsn);

export function buildCompetitionRecap(input: {
  type: 'skill' | 'boss' | 'efficiency';
  days: string[];
  /** False when the day-by-day cannot be trusted: the lead and biggest-day lines are left out. */
  daily: boolean;
  entries: RecapEntry[];
  moments: FeedMoment[];
}): CompetitionRecap {
  const { type, days, entries } = input;
  const me = entries.find((e) => e.isMe) ?? null;
  const gainedOf = new Map(entries.map((e) => [e.rsn.toLowerCase(), e.gained]));
  // An efficiency contest counts everything, so none of its moments are the contest's own.
  const moments = type === 'efficiency' ? [] : input.moments.filter((m) => gainedOf.has(m.rsn.toLowerCase()));
  const seen = new Set(moments.map((m) => m.rsn.toLowerCase()));
  const isMine = (rsn: string) => entries.some((e) => e.isMe && e.rsn.toLowerCase() === rsn.toLowerCase());

  // The lead, day by day.
  let leadChanges: number | null = null;
  let leader: CompetitionRecap['leader'] = null;
  let biggestDay: CompetitionRecap['biggestDay'] = null;
  if (input.daily) {
    leadChanges = 0;
    let holder: string | null = null;
    for (let d = 0; d < days.length; d++) {
      const first = [...placesAfter(entries, d)].find(([, place]) => place === 1)?.[0] ?? null;
      if (first && first !== holder) {
        if (holder) leadChanges++;
        holder = first;
        leader = { rsn: first, sinceDay: d };
      }
      for (const e of entries) {
        const v = e.days[d] ?? 0;
        if (v > (biggestDay?.value ?? 0)) biggestDay = { rsn: e.rsn, value: v, day: d };
      }
    }
  }

  // Deaths.
  const deathMoments = moments.filter((m) => m.kind === 'death');
  const tallies = new Map<string, { rsn: string; count: number; split: Map<string, number>; perDay: Map<string, FeedMoment[]> }>();
  for (const m of deathMoments) {
    const key = m.rsn.toLowerCase();
    const t = tallies.get(key) ?? { rsn: m.rsn, count: 0, split: new Map(), perDay: new Map() };
    t.count++;
    const source = m.source || UNKNOWN_KILLER;
    t.split.set(source, (t.split.get(source) ?? 0) + 1);
    const day = m.occurredAt.slice(0, 10);
    t.perDay.set(day, [...(t.perDay.get(day) ?? []), m]);
    tallies.set(key, t);
  }
  const ranked: DeathTally[] = [...tallies.values()]
    .map((t) => ({
      rsn: t.rsn,
      count: t.count,
      split: [...t.split].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
      mine: isMine(t.rsn),
    }))
    .sort(byCountThenName);

  const seenKills = [...seen].reduce((n, rsn) => n + (gainedOf.get(rsn) ?? 0), 0);
  const perDeath = (kills: number, deaths: number) => (type === 'boss' && deaths > 0 && kills > 0 ? Math.round(kills / deaths) : null);

  let deathBoard: CompetitionRecap['deathBoard'] = null;
  if (ranked.length > 0) {
    const sources = new Map<string, Map<string, number>>();
    for (const t of ranked) for (const s of t.split) sources.set(s.source, new Map(sources.get(s.source) ?? []).set(t.rsn, s.count));
    const bySource = [...sources]
      .map(([source, people]) => {
        const most = [...people].map(([rsn, count]) => ({ rsn, count })).sort(byCountThenName)[0];
        return { source, deaths: [...people.values()].reduce((n, c) => n + c, 0), most };
      })
      .sort((a, b) => b.deaths - a.deaths || a.source.localeCompare(b.source));

    let worstDay: NonNullable<CompetitionRecap['deathBoard']>['worstDay'] = null;
    for (const t of tallies.values()) {
      for (const [day, list] of t.perDay) {
        if (list.length < 2 || list.length <= (worstDay?.count ?? 0)) continue;
        const where = [...new Set(list.map((m) => m.source).filter((s): s is string => !!s))];
        worstDay = { rsn: t.rsn, count: list.length, source: where.length === 1 ? where[0] : null, day };
      }
    }

    // Kills for each death they did have: nobody is "cleanest" on a handful of kills.
    let cleanest: NonNullable<CompetitionRecap['deathBoard']>['cleanest'] = null;
    if (type === 'boss' && seen.size >= 3) {
      const floor = Math.max(...entries.filter((e) => seen.has(e.rsn.toLowerCase())).map((e) => e.gained), 0) * CLEANEST_MIN_SHARE;
      let bestRate = 0;
      for (const e of entries) {
        if (!seen.has(e.rsn.toLowerCase()) || e.gained <= 0 || e.gained < floor) continue;
        const died = tallies.get(e.rsn.toLowerCase())?.count ?? 0;
        const rate = e.gained / (died + 1);
        if (rate > bestRate) {
          bestRate = rate;
          cleanest = { rsn: e.rsn, kills: e.gained, deaths: died };
        }
      }
    }

    const top = ranked.slice(0, 3);
    const mineTally = ranked.find((t) => t.mine) ?? null;
    deathBoard = { bySource, top, me: mineTally && !top.includes(mineTally) ? mineTally : null, cleanest, worstDay };
  }

  // Drops.
  const dropMoments = moments.filter(isDrop);
  const asDrop = (m: FeedMoment): RecapDrop => ({
    rsn: m.rsn,
    itemName: m.itemName ?? (m.kind === 'pet' ? 'a pet' : 'a drop'),
    source: m.source,
    rarity: m.rarityDenominator,
    kc: m.kc,
    xp: m.statXp ?? null,
    day: m.occurredAt.slice(0, 10),
    pet: m.kind === 'pet',
  });
  let luck: CompetitionRecap['luck'] = null;
  if (dropMoments.length > 0) {
    const byRarity = [...dropMoments].sort((a, b) => (b.rarityDenominator ?? 0) - (a.rarityDenominator ?? 0) || a.occurredAt.localeCompare(b.occurredAt));
    const counts = new Map<string, { rsn: string; drops: number }>();
    for (const m of dropMoments) {
      const c = counts.get(m.rsn.toLowerCase()) ?? { rsn: m.rsn, drops: 0 };
      c.drops++;
      counts.set(m.rsn.toLowerCase(), c);
    }
    let luckiest: NonNullable<CompetitionRecap['luck']>['luckiest'] = null;
    let driest: NonNullable<CompetitionRecap['luck']>['driest'] = null;
    if (type === 'boss') {
      // Luckiest only means something against somebody else's luck.
      if (counts.size >= 2) {
        let bestRate = 0;
        for (const [key, c] of counts) {
          const kills = gainedOf.get(key) ?? 0;
          if (kills <= 0) continue;
          const rate = c.drops / kills;
          if (rate > bestRate) {
            bestRate = rate;
            luckiest = { rsn: c.rsn, drops: c.drops, kills };
          }
        }
      }
      for (const e of entries) {
        const key = e.rsn.toLowerCase();
        if (!seen.has(key) || counts.has(key) || e.gained <= (driest?.kills ?? 0)) continue;
        driest = { rsn: e.rsn, kills: e.gained };
      }
    }
    luck = { rarest: byRarity[0]?.rarityDenominator ? asDrop(byRarity[0]) : null, luckiest, driest, list: byRarity.slice(0, 5).map(asDrop) };
  }

  let mine: CompetitionRecap['mine'] = null;
  if (me) {
    const myDeaths = tallies.get(me.rsn.toLowerCase())?.count ?? 0;
    let bestDay: { value: number; day: number } | null = null;
    if (input.daily) me.days.forEach((v, d) => { if (v > (bestDay?.value ?? 0)) bestDay = { value: v, day: d }; });
    mine = {
      bestDay,
      drops: dropMoments.filter((m) => m.rsn.toLowerCase() === me.rsn.toLowerCase()).length,
      deaths: myDeaths,
      killsPerDeath: perDeath(me.gained, myDeaths),
    };
  }

  return {
    leadChanges,
    leader,
    biggestDay,
    drops: dropMoments.length,
    pets: dropMoments.filter((m) => m.kind === 'pet').length,
    deaths: deathMoments.length,
    killsPerDeath: perDeath(seenKills, deathMoments.length),
    deathBoard,
    luck,
    mine,
  };
}

/**
 * An item hunt looked back on: who needed the fewest kills for each drop, and who went longest
 * without one. Only for hunts that count kills, and only with two hunters to compare.
 */
export function huntLuck(rows: { rsn: string; count: number; statGain: number | null }[]): {
  luckiest: { rsn: string; drops: number; kills: number } | null;
  driest: { rsn: string; kills: number } | null;
} {
  const known = rows.filter((r) => r.statGain != null && r.statGain > 0);
  let luckiest: { rsn: string; drops: number; kills: number } | null = null;
  let driest: { rsn: string; kills: number } | null = null;
  if (known.filter((r) => r.count > 0).length >= 2) {
    for (const r of known) {
      if (r.count > 0 && (!luckiest || r.count / r.statGain! > luckiest.drops / luckiest.kills)) luckiest = { rsn: r.rsn, drops: r.count, kills: r.statGain! };
    }
  }
  for (const r of known) if (r.count === 0 && r.statGain! > (driest?.kills ?? 0)) driest = { rsn: r.rsn, kills: r.statGain! };
  return { luckiest, driest };
}
