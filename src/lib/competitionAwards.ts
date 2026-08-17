// Awards for a competition week — who came out swinging, who kept at it, who carried the clan.
//
// WHY THESE AND NOT "FIRST XP". A week's numbers arrive at wildly different times: the plugin pushes
// within seconds, the hiscores sweep can be hours behind for someone it hasn't polled lately. So any
// award decided by ARRIVAL ORDER — first to score, first kill — would really be measuring who
// installed the plugin. Every award here is decided by the SHAPE of the week instead: which day,
// how many days, what share. Late data changes when an award updates, never who wins it.
//
// (Boards are different: a completion carries a real event-time stamp, so genuine firsts live there.)
//
// Deliberately imports NOTHING — like lib/recapDerive and lib/competitionInsights — so the node test
// runner can strip types and run it without a bundler resolving the `@/` alias.

export interface AwardEntry {
  rsn: string;
  /** The competition's own number. */
  gained: number;
  /** Gain per day, index-aligned with the competition's day range. */
  days: number[];
  /** Consecutive active days, most recent run. */
  streak: number;
  /** False for guests, who rank but have no daily history to shape an award from. */
  trackable: boolean;
}

export interface CompetitionAward {
  key: string;
  emoji: string;
  title: string;
  /** One line on what it measures — these are only fun if you can tell what they mean. */
  blurb: string;
  who: string;
  /** Pre-formatted headline number. */
  value: string;
  /** The supporting fact: which day, over how many days. */
  detail?: string;
}

/** Below this, a per-day rate is one good session wearing a big number. */
const MIN_ACTIVE_DAYS_FOR_RATE = 2;
/** A late surge is only a story once there's an early half to have been quiet through. */
const MIN_DAYS_FOR_SURGE = 4;
/** Carrying the clan means carrying it — not just topping a field of two. */
const MIN_SHARE = 0.15;
const MIN_SCORERS_FOR_SHARE = 3;

interface Ranked {
  rsn: string;
  value: number;
  detail?: string;
}

/**
 * Highest wins, ties broken by name.
 *
 * The tie-break matters more than it looks: the old "first to score" award picked whoever happened
 * to sort first in the query and printed it as a fact. An award nobody can predict from the numbers
 * is worse than no award.
 */
function best(ranked: Ranked[]): Ranked | null {
  const sorted = [...ranked]
    .filter((r) => Number.isFinite(r.value) && r.value > 0)
    .sort((a, b) => b.value - a.value || a.rsn.localeCompare(b.rsn));
  return sorted[0] ?? null;
}

export interface AwardContext {
  /** Days of the competition that have actually happened. */
  elapsed: number;
  /** Everything the clan gained, for the share award. */
  clanTotal: number;
  /** Formats a raw gain — '1.2M XP', '412 KC', '38.2h'. */
  fmt: (value: number) => string;
  /** Day index → a label a person reads ('Tue', 'Aug 12'). */
  dayLabel: (index: number) => string;
}

export function buildCompetitionAwards(entries: AwardEntry[], ctx: AwardContext): CompetitionAward[] {
  const { elapsed, clanTotal, fmt, dayLabel } = ctx;
  const scoring = entries.filter((e) => e.trackable && e.gained > 0 && e.days.length > 0);
  if (scoring.length === 0 || elapsed <= 0) return [];

  const upto = (e: AwardEntry) => e.days.slice(0, elapsed);
  const activeDays = (e: AwardEntry) => upto(e).filter((d) => d > 0).length;
  const out: CompetitionAward[] = [];

  // Opening day. The honest version of "who went first": not who was SEEN first, which is a
  // function of polling order, but who actually did the most before anyone had settled in.
  const dayOne = best(scoring.map((e) => ({ rsn: e.rsn, value: upto(e)[0] ?? 0 })));
  if (dayOne) {
    out.push({
      key: 'day-one',
      emoji: '🚀',
      title: 'Off the mark',
      blurb: 'Most on the opening day',
      who: dayOne.rsn,
      value: fmt(dayOne.value),
      detail: dayLabel(0),
    });
  }

  // The single best day anyone had, and when.
  const bigDay = best(
    scoring.map((e) => {
      const days = upto(e);
      let idx = 0;
      for (let i = 1; i < days.length; i++) if (days[i] > days[idx]) idx = i;
      return { rsn: e.rsn, value: days[idx] ?? 0, detail: dayLabel(idx) };
    }),
  );
  if (bigDay) {
    out.push({
      key: 'big-day',
      emoji: '💥',
      title: 'Biggest day',
      blurb: 'The best single day of the week',
      who: bigDay.rsn,
      value: fmt(bigDay.value),
      detail: bigDay.detail,
    });
  }

  const streaker = best(scoring.map((e) => ({ rsn: e.rsn, value: e.streak })));
  if (streaker && streaker.value > 1) {
    out.push({
      key: 'streak',
      emoji: '🔥',
      title: 'Kept at it',
      blurb: 'Longest run of days in a row',
      who: streaker.rsn,
      value: `${streaker.value} days`,
    });
  }

  // The counterweight to every "most" award, which mostly measure who had the most free time:
  // what they did on the days they actually played. Needs more than one day behind it.
  const perDay = best(
    scoring
      .filter((e) => activeDays(e) >= MIN_ACTIVE_DAYS_FOR_RATE)
      .map((e) => {
        const active = activeDays(e);
        const total = upto(e).reduce((a, b) => a + b, 0);
        return { rsn: e.rsn, value: total / active, detail: `over ${active} active days` };
      }),
  );
  if (perDay) {
    out.push({
      key: 'per-day',
      emoji: '⚡',
      title: 'Best per day',
      blurb: 'Most per day actually played',
      who: perDay.rsn,
      value: `${fmt(Math.round(perDay.value))}/day`,
      detail: perDay.detail,
    });
  }

  // Someone who was quiet all week and then went off. Share of their OWN total, so it belongs to
  // whoever changed gear rather than whoever is biggest.
  if (elapsed >= MIN_DAYS_FOR_SURGE) {
    const surge = best(
      scoring.map((e) => {
        const days = upto(e);
        const total = days.reduce((a, b) => a + b, 0);
        if (total <= 0) return { rsn: e.rsn, value: 0 };
        const late = days.slice(-2).reduce((a, b) => a + b, 0);
        const share = late / total;
        // Only a surge if the last two days beat their even share of the week by a distance.
        return share > (2 / days.length) * 1.75
          ? { rsn: e.rsn, value: share, detail: `${fmt(late)} of ${fmt(total)}` }
          : { rsn: e.rsn, value: 0 };
      }),
    );
    if (surge) {
      out.push({
        key: 'late-surge',
        emoji: '🌙',
        title: 'Late surge',
        blurb: 'Left it late, then went off',
        who: surge.rsn,
        value: `${Math.round(surge.value * 100)}% at the end`,
        detail: surge.detail,
      });
    }
  }

  // Carrying the clan. Suppressed on a small field, where topping it says nothing.
  if (scoring.length >= MIN_SCORERS_FOR_SHARE && clanTotal > 0) {
    const share = best(
      scoring.map((e) => {
        const s = e.gained / clanTotal;
        return s >= MIN_SHARE ? { rsn: e.rsn, value: s, detail: `of ${fmt(clanTotal)} clan-wide` } : { rsn: e.rsn, value: 0 };
      }),
    );
    if (share) {
      out.push({
        key: 'share',
        emoji: '🐘',
        title: 'Carrying the clan',
        blurb: 'Biggest share of everything gained',
        who: share.rsn,
        value: `${Math.round(share.value * 100)}%`,
        detail: share.detail,
      });
    }
  }

  return out;
}
