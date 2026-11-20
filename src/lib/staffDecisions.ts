// The staff Today page's list: what needs a decision, worst first, each naming the clans it is
// about and why. A dashboard of totals is a report; this is the part that is a tool.
//
// Pure: the page gathers the clans, their health and billing, and the counts.

export type DecisionTone = 'broken' | 'money' | 'quiet' | 'stuck' | 'info';

export interface DecisionClan {
  id: number;
  name: string;
  /** Why this clan is in this line. */
  why: string;
  /** Has an owner on record to write to. */
  hasOwner: boolean;
  /** The note to its owner is a welcome, not a problem. */
  welcome?: boolean;
}

export interface Decision {
  key: string;
  tone: DecisionTone;
  /** The chip word: BROKEN, TRIAL, GOING QUIET… */
  tag: string;
  title: string;
  detail: string;
  clans: DecisionClan[];
  /** Where to go to act on it, when it is not one clan. */
  href?: string;
  hrefLabel?: string;
  /** How big it is (clans named, errors open…): a dismissed line returns when this grows. */
  size: number;
}

export interface DecisionClanInput {
  id: number;
  name: string;
  hasOwner: boolean;
  verified: boolean;
  /** A creator space has no in-game clan to prove. */
  creator: boolean;
  healthKey: string;
  healthReason: string;
  flags: string[];
  /** lib/clanBilling state and its label ("Trial · 5 days left"). */
  billing: string;
  billingLabel: string;
  botMissing: boolean;
  /** Has run an event and has players on the plugin: the signs a trial converts. */
  engaged: boolean;
  /** Whole days since it was created; null when unknown. */
  ageDays: number | null;
}

/** A clan is "new" on Today for this long: the window in which a hello from a person lands best. */
export const NEW_CLAN_DAYS = 14;

/**
 * Dismissed lines, as `{ key: size when dismissed }`. A line stays hidden while it is no bigger than
 * that, and comes back the moment it grows: one more clan stuck, more errors open.
 */
export type Dismissed = Record<string, number>;

export function parseDismissed(raw: string | null | undefined): Dismissed {
  try {
    const o = JSON.parse(raw ?? '{}') as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const out: Dismissed = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && /^[a-z-]{1,40}$/.test(k)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export function applyDismissed(decisions: Decision[], dismissed: Dismissed): { open: Decision[]; hidden: number } {
  const open = decisions.filter((d) => !(d.key in dismissed) || d.size > dismissed[d.key]);
  return { open, hidden: decisions.length - open.length };
}

/** `dismissed` with lines that no longer exist dropped, so a line that went away and returns is shown. */
export function pruneDismissed(decisions: Decision[], dismissed: Dismissed): Dismissed {
  const live = new Set(decisions.map((d) => d.key));
  return Object.fromEntries(Object.entries(dismissed).filter(([k]) => live.has(k)));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const TONE_ORDER: DecisionTone[] = ['broken', 'money', 'quiet', 'stuck', 'info'];

export function buildDecisions(input: {
  clans: DecisionClanInput[];
  errors: number;
  /** Plugin builds seen in the last week, newest first, with how many accounts are on each. */
  versions: { version: string; accounts: number }[];
}): Decision[] {
  const out: Decision[] = [];
  const pick = (test: (c: DecisionClanInput) => boolean, why: (c: DecisionClanInput) => string): DecisionClan[] =>
    input.clans.filter(test).map((c) => ({ id: c.id, name: c.name, why: why(c), hasOwner: c.hasOwner }));
  const add = (d: Omit<Decision, 'clans' | 'size'> & { clans: DecisionClan[]; size?: number }) => {
    if (d.clans.length > 0 || d.href) out.push({ ...d, size: d.size ?? d.clans.length });
  };

  const noBot = pick((c) => c.botMissing, () => 'The Anvil bot is not in the Discord server it saved');
  add({
    key: 'bot-missing',
    tone: 'broken',
    tag: 'Broken',
    title: noBot.length === 1 ? `${noBot[0].name}'s Discord features are not working` : `${noBot.length} clans' Discord features are not working`,
    detail: 'The clan saved a server the bot is not in, so roles and team channels fail without anyone being told.',
    clans: noBot,
  });

  const lapsed = pick((c) => c.billing === 'lapsed', (c) => c.billingLabel);
  add({ key: 'lapsed', tone: 'broken', tag: 'Payment', title: `${plural(lapsed.length, 'renewal is', 'renewals are')} overdue`, detail: 'A paid period ended and no new one began. Usually a failed card.', clans: lapsed });

  const ownerless = pick((c) => !c.hasOwner, () => 'No owner on record');
  add({ key: 'ownerless', tone: 'broken', tag: 'No owner', title: `${plural(ownerless.length, 'clan has', 'clans have')} no owner`, detail: 'Its own transfer flow needs a current owner, so it cannot fix this itself.', clans: ownerless });

  const trial = pick((c) => c.flags.includes('trial-ending'), (c) => `${c.billingLabel}: ${c.engaged ? 'has run an event and has players on the plugin' : c.healthReason.charAt(0).toLowerCase() + c.healthReason.slice(1)}`);
  const likely = input.clans.filter((c) => c.flags.includes('trial-ending') && c.engaged).length;
  add({
    key: 'trial',
    tone: 'money',
    tag: 'Trial',
    title: `${plural(trial.length, 'trial ends', 'trials end')} within 7 days`,
    detail: likely === 0 ? 'None has run an event with players on the plugin yet.' : `${likely} of them ${likely === 1 ? 'has' : 'have'} run an event with players on the plugin: the likely ones to stay.`,
    clans: trial,
  });

  const cancelling = pick((c) => c.billing === 'cancelling', (c) => c.billingLabel);
  add({ key: 'cancelling', tone: 'money', tag: 'Cancelling', title: `${plural(cancelling.length, 'clan is', 'clans are')} cancelling`, detail: 'Still paid up and still served, which is why a message now is worth it.', clans: cancelling });

  const over = pick((c) => c.flags.includes('over-plan'), () => 'More members than its plan allows');
  add({ key: 'over', tone: 'money', tag: 'Over plan', title: `${plural(over.length, 'clan is', 'clans are')} over the plan`, detail: 'Nothing is blocked. Each is a fit for the next tier up.', clans: over });

  const quiet = pick((c) => c.healthKey === 'quiet', (c) => c.healthReason);
  add({ key: 'quiet', tone: 'quiet', tag: 'Going quiet', title: `${plural(quiet.length, 'clan is', 'clans are')} going quiet`, detail: 'Active before and not now. The cheapest moment to ask what happened.', clans: quiet });

  const stuck = pick((c) => c.healthKey === 'stuck', (c) => c.healthReason);
  add({ key: 'stuck', tone: 'stuck', tag: 'Stuck', title: `${plural(stuck.length, 'clan', 'clans')} signed up and never ran an event`, detail: 'No event and nobody on the plugin. Analytics, Journeys shows the step each stopped at.', clans: stuck });

  const unverified = pick((c) => !c.verified && !c.creator && c.hasOwner, () => 'Nobody has proved the in-game clan is theirs');
  add({ key: 'unverified', tone: 'stuck', tag: 'Unverified', title: `${plural(unverified.length, 'clan is', 'clans are')} unverified`, detail: 'It cannot sync a roster until an owner-rank character does, or you verify it by hand.', clans: unverified });

  // NEW CLANS: not a problem, a moment. An owner who hears from a person in the first days is the
  // one who writes back when something does not work, instead of quietly leaving.
  const fresh = input.clans
    .filter((c) => c.ageDays != null && c.ageDays <= NEW_CLAN_DAYS && c.hasOwner)
    .sort((a, b) => (a.ageDays ?? 0) - (b.ageDays ?? 0))
    .map((c) => ({ id: c.id, name: c.name, hasOwner: true, welcome: true, why: `${c.creator ? 'Creator space, created' : 'Created'} ${c.ageDays === 0 ? 'today' : `${plural(c.ageDays ?? 0, 'day', 'days')} ago`}${c.engaged ? ', already running with players on the plugin' : ''}` }));
  // Creator spaces are made the same way and their owners are just as new: named for what they are.
  const freshSpaces = input.clans.filter((c) => c.creator && c.ageDays != null && c.ageDays <= NEW_CLAN_DAYS && c.hasOwner).length;
  const freshClans = fresh.length - freshSpaces;
  const freshWhat = [freshClans > 0 ? plural(freshClans, 'clan', 'clans') : null, freshSpaces > 0 ? plural(freshSpaces, 'creator space', 'creator spaces') : null].filter(Boolean).join(' and ');
  add({ key: 'new-clans', tone: 'info', tag: 'New', title: `${freshWhat} ${fresh.length === 1 ? 'was' : 'were'} created in the last ${NEW_CLAN_DAYS} days`, detail: 'Say hello while it is new. The draft is a welcome; edit it before it goes.', clans: fresh, size: Math.max(0, ...fresh.map((c) => c.id)) });

  // The plugin: only worth a line while most players are still on an older build.
  const total = input.versions.reduce((n, v) => n + v.accounts, 0);
  const newest = input.versions[0];
  if (newest && total > 0 && newest.accounts * 2 < total) {
    out.push({
      key: 'plugin',
      tone: 'info',
      tag: 'Plugin',
      title: `${(total - newest.accounts).toLocaleString()} of ${total.toLocaleString()} players are not on plugin ${newest.version} yet`,
      detail: 'They update on their next client restart. Worth a look only if it is still true tomorrow.',
      clans: [],
      href: '/staff/analytics?tab=plugin',
      hrefLabel: 'Version spread',
      size: total - newest.accounts,
    });
  }
  if (input.errors > 0) {
    out.push({ key: 'errors', tone: 'info', tag: 'Errors', title: `${plural(input.errors, 'error is', 'errors are')} unresolved`, detail: 'Grouped by cause on the Errors page.', clans: [], size: input.errors, href: '/staff/errors', hrefLabel: 'Open errors' });
  }
  return out.sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone));
}
