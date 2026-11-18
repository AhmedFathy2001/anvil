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
  const add = (d: Omit<Decision, 'clans'> & { clans: DecisionClan[] }) => {
    if (d.clans.length > 0 || d.href) out.push(d);
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
    });
  }
  if (input.errors > 0) {
    out.push({ key: 'errors', tone: 'info', tag: 'Errors', title: `${plural(input.errors, 'error is', 'errors are')} unresolved`, detail: 'Grouped by cause on the Errors page.', clans: [], href: '/staff/errors', hrefLabel: 'Open errors' });
  }
  return out.sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone));
}
