// How a clan is doing, in one word and one reason, for the staff clans list.
//
// The list used to show counts and leave the reading to the operator. A count does not say "this
// clan signed up eleven days ago and never ran an event", and that sentence is the thing to act on.
// Each rule below is a fact a person can check; the first that holds wins, worst first.
//
// Pure: lib/clanHealthDb gathers the facts.

export type ClanHealthKey = 'broken' | 'stuck' | 'quiet' | 'new' | 'thriving' | 'steady';

export interface ClanHealthFacts {
  createdAt: string;
  members: number;
  /** Seats the plan allows; null = no cap. */
  memberCap: number | null;
  /** Characters seen on the plugin in the last 7 days, and in the 7 before. */
  plugin7d: number;
  pluginPrev7d: number;
  /** Boards and competitions ever created, running now, and still to start. */
  eventsTotal: number;
  running: number;
  scheduled: number;
  /** The last page view, action or plugin sighting. Null: never. */
  lastActiveAt: string | null;
  /** lib/clanBilling billingStatus state, and the days left where it has any. */
  billing: string;
  billingDaysLeft: number | null;
  /** It saved a Discord server and Anvil's bot is not in it (lib/botGuilds). */
  botMissing?: boolean;
}

export interface ClanHealth {
  key: ClanHealthKey;
  label: string;
  /** Why, in a line. */
  reason: string;
  /** Things worth a look whatever the label says. */
  flags: ('trial-ending' | 'over-plan' | 'no-event')[];
}

export const HEALTH_LABEL: Record<ClanHealthKey, string> = {
  broken: 'Broken',
  stuck: 'Stuck',
  quiet: 'Going quiet',
  new: 'New',
  thriving: 'Thriving',
  steady: 'Steady',
};

/** Worst first: the order "needs attention" sorts by. */
export const HEALTH_ORDER: ClanHealthKey[] = ['broken', 'stuck', 'quiet', 'new', 'steady', 'thriving'];

const DAY = 86_400_000;
/** A clan gets this long to find its feet before "never ran an event" is a finding. */
export const STUCK_AFTER_DAYS = 3;
export const QUIET_AFTER_DAYS = 7;
export const TRIAL_ENDING_DAYS = 7;

const ms = (v: string | null) => {
  if (!v) return null;
  const t = Date.parse(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`);
  return Number.isNaN(t) ? null : t;
};
const daysSince = (v: string | null, now: number) => {
  const t = ms(v);
  return t == null ? null : Math.max(0, Math.floor((now - t) / DAY));
};
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

export function clanHealth(f: ClanHealthFacts, now: number = Date.now()): ClanHealth {
  const flags: ClanHealth['flags'] = [];
  if (f.billing === 'trialing' && f.billingDaysLeft != null && f.billingDaysLeft <= TRIAL_ENDING_DAYS) flags.push('trial-ending');
  if (f.memberCap != null && f.members > f.memberCap) flags.push('over-plan');
  const done = (key: ClanHealthKey, reason: string): ClanHealth => ({ key, label: HEALTH_LABEL[key], reason, flags });

  const age = daysSince(f.createdAt, now) ?? 0;
  const idle = daysSince(f.lastActiveAt, now);

  if (f.billing === 'lapsed') return done('broken', 'Its payment did not go through');
  if (f.botMissing) return done('broken', 'The Anvil bot is not in the Discord server it saved');
  if (f.eventsTotal === 0) {
    if (age <= STUCK_AFTER_DAYS) return done('new', `Joined ${age === 0 ? 'today' : `${days(age)} ago`}, no event yet`);
    flags.push('no-event');
    // Its players are on the plugin all the same (a clan that plays in another clan's events, or uses
    // Anvil for the roster and the feed): not stuck, but still one that has never run its own.
    if (f.plugin7d > 0) return done('steady', `${f.plugin7d} on the plugin this week, no event of its own yet`);
    return done('stuck', `Joined ${days(age)} ago and has never created an event`);
  }
  if (f.pluginPrev7d > 0 && f.plugin7d === 0) return done('quiet', `${f.pluginPrev7d} on the plugin last week, none this week`);
  if (f.running === 0 && f.scheduled === 0 && (idle == null || idle >= QUIET_AFTER_DAYS)) {
    return done('quiet', idle == null ? 'Nothing running, nothing scheduled, never seen active' : `Nothing running or scheduled, last active ${days(idle)} ago`);
  }
  if (f.running > 0 && f.members > 0 && f.plugin7d * 3 >= f.members) {
    return done('thriving', `${f.running} running, ${f.plugin7d} of ${f.members} members on the plugin this week`);
  }
  if (f.running > 0) return done('steady', `${f.running} running`);
  if (f.scheduled > 0) return done('steady', `${f.scheduled} scheduled`);
  return done('steady', idle === 0 ? 'Active today, nothing running' : `Last active ${days(idle ?? 0)} ago, nothing running`);
}

/** The one-click views above the list. */
export type ClanView = 'all' | 'attention' | 'trial' | 'paying' | 'quiet' | 'stuck' | 'over';

export function inClanView(view: ClanView, h: ClanHealth, billing: string): boolean {
  switch (view) {
    case 'all':
      return true;
    case 'attention':
      return h.key === 'broken' || h.key === 'stuck' || h.key === 'quiet' || h.flags.length > 0;
    case 'trial':
      return h.flags.includes('trial-ending');
    case 'paying':
      return billing === 'active' || billing === 'cancelling';
    case 'quiet':
      return h.key === 'quiet';
    case 'stuck':
      return h.flags.includes('no-event');
    case 'over':
      return h.flags.includes('over-plan');
  }
}
