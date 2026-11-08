// Where people get stuck: onboarding funnels for /staff/analytics.
//
// PURE — the reads live in lib/analyticsRead, which hands each actor's reached steps to this. Kept
// apart so the arithmetic is testable without a database (tests/pure-module-imports).
//
// THE RULE: an actor counts at step k only if it reached EVERY step up to k. A clan that started an
// event without ever adding a tile (a test board, a reveal-later board that never got its tiles) is
// not counted at "event started", because the funnel is asking "how far down the path did they get",
// and skipping a rung is not getting further. Steps are judged as reached-or-not rather than by
// timestamp order: the dates live in different tables written at different precisions, and ordering
// on them would drop real progress for a clock difference.

export interface FunnelStep {
  key: string;
  label: string;
  /** What reaching this step means, shown under the bar so nobody has to guess at the definition. */
  hint: string;
}

export interface FunnelDef {
  key: string;
  title: string;
  /** Who walks it — "clans created", "people who signed in". */
  actor: string;
  steps: FunnelStep[];
}

export const CLAN_ONBOARDING: FunnelDef = {
  key: 'clan-onboarding',
  title: 'Clan onboarding',
  actor: 'clans created in the window',
  steps: [
    { key: 'created', label: 'Clan created', hint: 'the clan row exists' },
    { key: 'event', label: 'First event', hint: 'created at least one event' },
    { key: 'tiles', label: 'Tiles added', hint: 'some event of theirs has a tile' },
    { key: 'started', label: 'Event started', hint: 'an event reached its start time' },
  ],
};

export const MEMBER_ONBOARDING: FunnelDef = {
  key: 'member-onboarding',
  title: 'Member onboarding',
  actor: 'people who first signed in during the window',
  steps: [
    { key: 'signedIn', label: 'Signed in with Discord', hint: 'a login row was created' },
    { key: 'character', label: 'Character linked', hint: 'owns at least one OSRS account' },
    { key: 'plugin', label: 'Plugin connected', hint: 'holds a plugin token' },
    { key: 'submission', label: 'First submission', hint: 'submitted proof for a tile' },
  ],
};

export interface FunnelRow {
  key: string;
  label: string;
  hint: string;
  count: number;
  /** Share of the first step that got this far, 0–1. */
  ofStart: number;
  /** Share of the PREVIOUS step lost here, 0–1 — the number that says where people get stuck. */
  dropFromPrev: number;
}

/**
 * Per-step counts for a funnel.
 *
 * `actors` is one entry per actor that entered the funnel (reached step one in the window), listing
 * the step keys it has reached. Unknown keys are ignored.
 */
export function computeFunnel(def: FunnelDef, actors: Iterable<Iterable<string>>): FunnelRow[] {
  const counts = new Array<number>(def.steps.length).fill(0);
  for (const reached of actors) {
    const set = new Set(reached);
    for (let k = 0; k < def.steps.length; k++) {
      if (!set.has(def.steps[k].key)) break;
      counts[k]++;
    }
  }
  const start = counts[0] ?? 0;
  return def.steps.map((step, k) => {
    const prev = k === 0 ? counts[0] : counts[k - 1];
    return {
      key: step.key,
      label: step.label,
      hint: step.hint,
      count: counts[k],
      ofStart: start > 0 ? counts[k] / start : 0,
      dropFromPrev: k === 0 || prev === 0 ? 0 : 1 - counts[k] / prev,
    };
  });
}

/** The step that loses the most people — the one worth looking at first. Null when nothing is lost. */
export function worstStep(rows: FunnelRow[]): FunnelRow | null {
  let worst: FunnelRow | null = null;
  for (const row of rows.slice(1)) {
    if (row.dropFromPrev > 0 && (!worst || row.dropFromPrev > worst.dropFromPrev)) worst = row;
  }
  return worst;
}

/** The analytics page's window choices, in days. Anything else falls back to 30. */
export const WINDOWS = [7, 30, 90] as const;
export type WindowDays = (typeof WINDOWS)[number];

export function parseWindow(raw: string | string[] | undefined): WindowDays {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (WINDOWS as readonly number[]).includes(n) ? (n as WindowDays) : 30;
}

/** `YYYY-MM-DD HH:MM:SS` for `days` ago, UTC — the stamp format analytics_events.ts is written in. */
export function windowStart(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * A daily series with the empty days filled in, oldest first. A day nobody visited is a real zero,
 * and a chart drawn from the sparse rows would close the gap and lie about it.
 */
export function densifyDays(
  rows: { day: string; count: number }[],
  days: number,
  now: Date = new Date(),
): { day: string; count: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: { day: string; count: number }[] = [];
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  for (let k = days - 1; k >= 0; k--) {
    const day = new Date(today - k * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, count: byDay.get(day) ?? 0 });
  }
  return out;
}

/**
 * A funnel whose steps were counted separately rather than per actor — the Supporter page, where a
 * view may carry no sign-in, and an invite link opened by someone who never signs in. The same rows
 * as computeFunnel, but a later step is not capped at the one before: a count that exceeds it (a
 * purchase whose view predates the window) reads as no drop rather than a negative one.
 */
export function funnelFromCounts(def: FunnelDef, counts: number[]): FunnelRow[] {
  const start = counts[0] ?? 0;
  return def.steps.map((step, k) => {
    const c = counts[k] ?? 0;
    const prev = k === 0 ? c : (counts[k - 1] ?? 0);
    return {
      key: step.key,
      label: step.label,
      hint: step.hint,
      count: c,
      ofStart: start > 0 ? Math.min(1, c / start) : 0,
      dropFromPrev: k === 0 || prev === 0 ? 0 : Math.max(0, 1 - c / prev),
    };
  });
}

export const CLAN_OWNER_JOURNEY: FunnelDef = {
  key: 'clan-owner',
  title: 'Clan owner journey',
  actor: 'clans created in the window',
  steps: [
    { key: 'created', label: 'Clan created', hint: 'clan.created' },
    { key: 'discord', label: 'Discord connected', hint: 'the bot was added to their server' },
    { key: 'roster', label: 'Roster synced', hint: 'the plugin pushed the in-game roster' },
    { key: 'event', label: 'First event created', hint: 'event.created' },
    { key: 'started', label: 'Event started', hint: 'event.started' },
  ],
};

export const PLAYER_JOURNEY: FunnelDef = {
  key: 'player',
  title: 'Player journey',
  actor: 'people who signed in during the window',
  steps: [
    { key: 'signedIn', label: 'Signed in', hint: 'auth.login' },
    { key: 'plugin', label: 'Plugin linked', hint: 'their first plugin token' },
    { key: 'credit', label: 'First credit', hint: 'a tile credited or a proof submitted' },
    { key: 'joined', label: 'Joined an event', hint: 'signed up for an event' },
  ],
};

export const SUPPORTER_JOURNEY: FunnelDef = {
  key: 'supporter',
  title: 'Supporter',
  actor: 'views of /supporter',
  steps: [
    { key: 'viewed', label: 'Viewed /supporter', hint: 'the page was opened' },
    { key: 'checkout', label: 'Started checkout', hint: 'pressed the buy button' },
    { key: 'purchased', label: 'Purchased', hint: 'Gumroad confirmed the sale' },
  ],
};

export const INVITE_JOURNEY: FunnelDef = {
  key: 'invite',
  title: 'Invite links',
  actor: 'invite links opened',
  steps: [
    { key: 'opened', label: 'Link opened', hint: 'a friends-event invite page loaded' },
    { key: 'joined', label: 'Joined', hint: 'the invite was accepted' },
  ],
};
