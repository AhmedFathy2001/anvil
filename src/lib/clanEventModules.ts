import { type ClanEventTiming, type Occurrence, currentOccurrence, occurrenceAt, pastOccurrences } from '@/lib/clanEventTimes';

// What a clan event switches on beyond "I'm going": sign-ups (with the host's own questions), an
// entry fee, payouts and a survey — each off until the host turns it on, each set up per event.
// Pure, so tests/clan-event-modules.test.ts runs it without a database.
//
// THE KEY. Everything a module records — a sign-up, a payout, a survey answer — is filed under a
// key. A weekly mass run week by week files each week under that occurrence's ISO start, the same
// key RSVPs already use; one run as a series (a four-week league) files everything under 'series'.
// A sentinel rather than null, so the unique indexes on (event, key, person) still hold.

export const SERIES = 'series';

export interface ClanEventModules {
  /** A weekly event's modules run per week, or once over the whole series. A one-off is one key either way. */
  scope: 'occurrence' | 'series';
  signups: {
    on: boolean;
    /** Most sign-ups taken (pending and approved together); null is no limit. */
    cap: number | null;
    /** Each sign-up waits for staff to approve it. */
    approval: boolean;
    /** Sign-ups close when it starts, or stay open until it ends. */
    closes: 'start' | 'end';
  };
  fee: { on: boolean; amount: number };
  payouts: { on: boolean; addedGp: number };
  survey: { on: boolean };
}

export const NO_MODULES: ClanEventModules = {
  scope: 'occurrence',
  signups: { on: false, cap: null, approval: false, closes: 'start' },
  fee: { on: false, amount: 0 },
  payouts: { on: false, addedGp: 0 },
  survey: { on: false },
};

/** Most gp one fee, one added pot or one payout can be — an int4 column, with room to spare. */
export const MAX_GP = 2_000_000_000;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const gp = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_GP) : 0;
};

/**
 * Stored or submitted settings, made whole. Anything missing or malformed is off — a fee needs
 * sign-ups to hang off, so a fee without them is off too.
 */
export function parseModules(raw: unknown): ClanEventModules {
  const m = obj(raw);
  const s = obj(m.signups);
  const f = obj(m.fee);
  const p = obj(m.payouts);
  const v = obj(m.survey);
  const cap = Math.round(Number(s.cap));
  const signupsOn = s.on === true;
  const amount = gp(f.amount);
  return {
    scope: m.scope === 'series' ? 'series' : 'occurrence',
    signups: {
      on: signupsOn,
      cap: Number.isFinite(cap) && cap > 0 ? Math.min(cap, 10_000) : null,
      approval: s.approval === true,
      closes: s.closes === 'end' ? 'end' : 'start',
    },
    fee: { on: signupsOn && f.on === true && amount > 0, amount },
    payouts: { on: p.on === true, addedGp: gp(p.addedGp) },
    survey: { on: v.on === true },
  };
}

export const anyModule = (m: ClanEventModules) => m.signups.on || m.payouts.on || m.survey.on;

/** The key a module files today's occurrence under. */
export function keyFor(m: ClanEventModules, e: Pick<ClanEventTiming, 'repeat'>, o: Occurrence): string {
  return m.scope === 'series' && e.repeat === 'weekly' ? SERIES : o.start;
}

/** Whether a key is one this event can have: 'series' on a weekly run as a series, or one of its real occurrences. */
export function validKey(m: ClanEventModules, e: ClanEventTiming, key: string): boolean {
  if (m.scope === 'series' && e.repeat === 'weekly') return key === SERIES;
  return occurrenceAt(e, key) != null;
}

export type SignupWindow = { open: true; key: string; occurrence: Occurrence } | { open: false; reason: string };

/**
 * Whether sign-ups take a name right now, and under which key. A series takes them until its
 * first week starts (or ends, if they stay open), then closes for good — a league's roster is set.
 */
export function signupWindow(m: ClanEventModules, e: ClanEventTiming, now: number): SignupWindow {
  if (!m.signups.on) return { open: false, reason: 'This event doesn’t take sign-ups.' };
  const o = currentOccurrence(e, now);
  if (!o) return { open: false, reason: 'This event is over.' };
  const series = m.scope === 'series' && e.repeat === 'weekly';
  const first = { start: e.startsAt, end: new Date(Date.parse(e.startsAt) + Math.max(1, e.durationMin) * 60_000).toISOString() };
  const which = series ? first : o;
  const shut = m.signups.closes === 'end' ? Date.parse(which.end) : Date.parse(which.start);
  if (now >= shut) return { open: false, reason: m.signups.closes === 'end' ? 'Sign-ups closed when it ended.' : 'Sign-ups closed when it started.' };
  return { open: true, key: keyFor(m, e, o), occurrence: o };
}

/**
 * The keys staff look back over — payouts and survey results: the one coming up (or on now) and
 * the recent ones that ended, newest first. A series is its one key.
 */
export function recentKeys(m: ClanEventModules, e: ClanEventTiming, now: number): { key: string; label: 'series' | 'next' | 'past'; occurrence: Occurrence | null }[] {
  if (m.scope === 'series' && e.repeat === 'weekly') return [{ key: SERIES, label: 'series', occurrence: null }];
  const out: { key: string; label: 'next' | 'past'; occurrence: Occurrence | null }[] = [];
  const next = currentOccurrence(e, now);
  if (next) out.push({ key: next.start, label: 'next', occurrence: next });
  for (const o of pastOccurrences(e, now, 8)) out.push({ key: o.start, label: 'past', occurrence: o });
  return out;
}

/**
 * The key the survey asks about now: the occurrence that most recently ended (a weekly asks about
 * last week until this week's ends), or the series once its first week is over. Null before then.
 */
export function surveyKey(m: ClanEventModules, e: ClanEventTiming, now: number): string | null {
  if (!m.survey.on) return null;
  if (m.scope === 'series' && e.repeat === 'weekly') {
    return pastOccurrences(e, now, 1).length ? SERIES : null;
  }
  return pastOccurrences(e, now, 1)[0]?.start ?? null;
}

/** The prize pot for a key: the host's added gp plus the fees actually collected under it. */
export function potGp(m: ClanEventModules, collectedFeesGp: number): number {
  return (m.payouts.on ? m.payouts.addedGp : 0) + Math.max(0, collectedFeesGp);
}
