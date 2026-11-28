import { momentSentence } from '@/lib/moments';
import { ordinal } from '@/lib/yourTeam';

/**
 * A competition's feed: what happened at its own bosses or in its own skills, day by day.
 *
 * Built to stay quiet in a busy week. A standings table already says who is where, so the feed only
 * speaks when a top place changes hands (the podium, or further down when more places pay), and
 * everything else about the order is one "daily update" line per finished day: who had the biggest
 * day, and where the viewer's own move left them. Deaths are one line per person per day, however
 * many there were. An efficiency contest counts everything a player does, so its moments would be
 * the whole clan's drops and deaths; it gets the standings lines only.
 *
 * Pure: the page hands it the standings days and the competition's moments (already kept to the
 * competition's own content when they were stored, lib/moments weeklyKindFor).
 */

export type FeedTag = 'rank' | 'day' | 'drop' | 'milestone' | 'death';

export interface CompetitionFeedLine {
  key: string;
  tag: FeedTag;
  /** Who it is about, shown in bold before the text. Null when the text stands alone. */
  rsn: string | null;
  text: string;
  /** "1 in 1,024 · 311 KC" */
  detail: string | null;
  /** When it happened. Null for lines that belong to the day as a whole. */
  at: string | null;
  mine: boolean;
}

export interface CompetitionFeedDay {
  /** 'YYYY-MM-DD' */
  day: string;
  /** 0-based day of the competition. */
  index: number;
  lines: CompetitionFeedLine[];
}

export interface FeedEntry {
  rsn: string;
  /** Gain per day, index-aligned with the competition's days. */
  days: number[];
  isMe: boolean;
}

export interface FeedMoment {
  id: number;
  rsn: string;
  kind: string;
  itemName: string | null;
  quantity: number;
  source: string | null;
  sourceKind?: string | null;
  valueGp: number | null;
  tier?: string | null;
  kc: number | null;
  /** XP in the competition's skill when it landed (skill weeks). */
  statXp?: number | null;
  rarityDenominator: number | null;
  occurredAt: string;
}

/** The places whose changes are news: the podium, or every paying place when more than three pay. */
export function watchedPlaces(payingPlaces: number): number {
  return Math.max(3, payingPlaces);
}

/** Each entry's place at the end of a day (1-based), by gain so far. Nobody is placed on zero. */
export function placesAfter(entries: FeedEntry[], dayIndex: number): Map<string, number> {
  const totals = entries.map((e, order) => ({
    rsn: e.rsn,
    order,
    total: e.days.slice(0, dayIndex + 1).reduce((n, d) => n + d, 0),
  }));
  const ranked = totals.filter((t) => t.total > 0).sort((a, b) => b.total - a.total || a.order - b.order);
  return new Map(ranked.map((t, i) => [t.rsn, i + 1]));
}

function momentDetail(m: FeedMoment): string | null {
  const bits: string[] = [];
  if (m.rarityDenominator && m.rarityDenominator >= 100) bits.push(`1 in ${m.rarityDenominator.toLocaleString()}`);
  if (m.kc && m.kc > 0) bits.push(`${m.kc.toLocaleString()} KC`);
  if (m.statXp && m.statXp > 0) bits.push(`at ${m.statXp.toLocaleString()} XP`);
  if (m.valueGp && m.valueGp >= 1_000_000) bits.push(`${(m.valueGp / 1_000_000).toFixed(1)}M`);
  return bits.length > 0 ? bits.join(' · ') : null;
}

const MILESTONE_KINDS = new Set(['level', 'ca', 'milestone']);

function momentLines(moments: FeedMoment[], mine: (rsn: string) => boolean): CompetitionFeedLine[] {
  const lines: CompetitionFeedLine[] = [];
  // One line per person for the day's ordinary deaths. A death that ends a hardcore account (it
  // carries a tier) is its own news and stays its own line.
  const deaths = new Map<string, FeedMoment[]>();
  for (const m of moments) {
    if (m.kind === 'death' && !m.tier) {
      const list = deaths.get(m.rsn);
      if (list) list.push(m);
      else deaths.set(m.rsn, [m]);
      continue;
    }
    lines.push({
      key: `m${m.id}`,
      tag: m.kind === 'death' ? 'death' : MILESTONE_KINDS.has(m.kind) ? 'milestone' : 'drop',
      rsn: m.rsn,
      text: momentSentence(m),
      detail: momentDetail(m),
      at: m.occurredAt,
      mine: mine(m.rsn),
    });
  }
  for (const [rsn, list] of deaths) {
    const last = list.reduce((a, b) => (b.occurredAt > a.occurredAt ? b : a));
    const sources = [...new Set(list.map((d) => d.source).filter((s): s is string => !!s))];
    const text =
      list.length === 1
        ? momentSentence(last)
        : sources.length === 1
          ? `died ${list.length} times to ${sources[0]}`
          : `died ${list.length} times`;
    lines.push({ key: `d${last.id}`, tag: 'death', rsn, text, detail: null, at: last.occurredAt, mine: mine(rsn) });
  }
  return lines.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
}

export function buildCompetitionFeed(input: {
  type: 'skill' | 'boss' | 'efficiency';
  /** Every UTC day of the competition, and how many have begun. */
  days: string[];
  elapsed: number;
  ended: boolean;
  entries: FeedEntry[];
  /** How many places pay a prize. */
  payingPlaces: number;
  moments: FeedMoment[];
  /** "+140 KC": a day's gain in the competition's own unit. */
  gainWords: (value: number) => string;
}): CompetitionFeedDay[] {
  const { type, days, entries, payingPlaces, gainWords } = input;
  const elapsed = Math.min(input.elapsed, days.length);
  const watched = watchedPlaces(payingPlaces);
  const me = entries.find((e) => e.isMe) ?? null;
  const myNames = new Set(entries.filter((e) => e.isMe).map((e) => e.rsn));
  const mine = (rsn: string) => myNames.has(rsn);
  const onBoard = new Set(entries.map((e) => e.rsn.toLowerCase()));
  const moments = type === 'efficiency' ? [] : input.moments.filter((m) => onBoard.has(m.rsn.toLowerCase()));

  const out: CompetitionFeedDay[] = [];
  let before = new Map<string, number>();
  for (let d = 0; d < elapsed; d++) {
    const after = placesAfter(entries, d);
    const lines: CompetitionFeedLine[] = [];
    const finished = input.ended || d < elapsed - 1;

    // The daily update: only once the day is over, so it never changes after it is read.
    if (finished) {
      const best = entries.reduce<FeedEntry | null>((a, e) => ((e.days[d] ?? 0) > (a?.days[d] ?? 0) ? e : a), null);
      const sentences: string[] = [];
      if (best) sentences.push(`had the biggest day: +${gainWords(best.days[d])}.`);
      const mineNow = me ? after.get(me.rsn) : undefined;
      const mineWas = me ? before.get(me.rsn) : undefined;
      if (d > 0 && mineNow != null && mineWas != null && mineNow !== mineWas) {
        const n = Math.abs(mineWas - mineNow);
        sentences.push(`You ${mineNow < mineWas ? 'climbed' : 'slipped'} ${n} ${n === 1 ? 'place' : 'places'} to ${ordinal(mineNow)}.`);
      }
      if (sentences.length > 0) {
        lines.push({
          key: `day${d}`,
          tag: 'day',
          rsn: best?.rsn ?? null,
          text: sentences.join(' '),
          detail: null,
          at: null,
          mine: sentences.length > 1 || (best != null && mine(best.rsn)),
        });
      }
    }

    // A watched place changing hands. The first day anyone scores only sets the order, so it has
    // no changes: without this a week whose first gains land on day three would open with a line
    // for every place at once.
    if (before.size > 0) {
      const holderBefore = new Map([...before].map(([rsn, place]) => [place, rsn]));
      for (const [rsn, place] of [...after].sort((a, b) => a[1] - b[1])) {
        if (place > watched) break;
        const was = before.get(rsn);
        if (was != null && was <= place) continue;
        const from = holderBefore.get(place);
        lines.push({
          key: `rank${d}-${place}`,
          tag: 'rank',
          rsn,
          text: `took ${ordinal(place)}${from && from !== rsn ? ` from ${from}` : ''}`,
          detail: place > 3 ? 'a paying place' : null,
          at: null,
          mine: mine(rsn),
        });
      }
    }

    lines.push(...momentLines(moments.filter((m) => m.occurredAt.slice(0, 10) === days[d]), mine));
    if (lines.length > 0) out.push({ day: days[d], index: d, lines });
    before = after;
  }
  return out.reverse();
}

export type FeedFilter = 'all' | 'standings' | 'drops' | 'milestones' | 'deaths' | 'mine';

export function feedLineMatches(line: CompetitionFeedLine, filter: FeedFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'standings':
      return line.tag === 'rank' || line.tag === 'day';
    case 'drops':
      return line.tag === 'drop';
    case 'milestones':
      return line.tag === 'milestone';
    case 'deaths':
      return line.tag === 'death';
    case 'mine':
      return line.mine;
  }
}

/**
 * An item hunt's feed: each confirmed drop of a hunted item, by day. A hunt has no daily gain to
 * rank, and its standings are the list of drops, so the drops are the whole feed.
 */
export function buildHuntFeed(
  rows: {
    rsn: string;
    isMe: boolean;
    drops: { id: number; itemName: string; quantity: number; source: string | null; occurredAt: string; stat: string | null; awaiting: boolean }[];
  }[],
  startDate: string,
  /** A rush's other lines: its counted deaths and its kills finished together (already built). */
  extra: CompetitionFeedLine[] = [],
): CompetitionFeedDay[] {
  const start = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`);
  const byDay = new Map<string, CompetitionFeedLine[]>();
  for (const line of extra) {
    if (!line.at) continue;
    const day = line.at.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(line);
    else byDay.set(day, [line]);
  }
  for (const row of rows) {
    for (const d of row.drops) {
      if (d.awaiting) continue;
      const day = d.occurredAt.slice(0, 10);
      const line: CompetitionFeedLine = {
        key: `h${d.id}`,
        tag: 'drop',
        rsn: row.rsn,
        text: `got ${d.quantity > 1 ? `${d.quantity.toLocaleString()} × ` : ''}${d.itemName}${d.source ? ` from ${d.source}` : ''}`,
        detail: d.stat,
        at: d.occurredAt,
        mine: row.isMe,
      };
      const list = byDay.get(day);
      if (list) list.push(line);
      else byDay.set(day, [line]);
    }
  }
  return [...byDay]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, lines]) => ({
      day,
      index: Math.max(0, Math.round((Date.parse(`${day}T00:00:00Z`) - start) / 86_400_000)),
      lines: lines.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')),
    }));
}

/** A rush's deaths and kills done together as feed lines (lib/itemHuntDb rushFeedFacts). */
export function rushFeedExtra(
  facts: { deaths: { rsn: string; source: string | null; at: string }[]; together: { target: string; at: string; who: string[] }[] },
  mine: ReadonlySet<string>,
): CompetitionFeedLine[] {
  const names = (who: string[]) => (who.length <= 1 ? (who[0] ?? '') : `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}`);
  return [
    ...facts.deaths.map((d, i): CompetitionFeedLine => ({ key: `rd${i}:${d.at}`, tag: 'death', rsn: d.rsn, text: d.source ? `died to ${d.source}` : 'died', detail: null, at: d.at, mine: mine.has(d.rsn) })),
    ...facts.together.map((t, i): CompetitionFeedLine => ({ key: `rt${i}:${t.at}`, tag: 'milestone', rsn: names(t.who), text: `finished ${t.target} together`, detail: null, at: t.at, mine: t.who.some((w) => mine.has(w)) })),
  ];
}
