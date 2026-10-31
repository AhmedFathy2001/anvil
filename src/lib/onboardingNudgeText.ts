// The one reminder a stalled clan's owner gets — who qualifies, and what it says.
//
// WHY IT EXISTS. Of the clans created in October 2026, half never got a roster, and in every one of
// those the owner's plugin had never sent a thing. They did not fail at the sync; they never reached
// the plugin at all, because nothing on the site sent them there. The ops digest told the operator,
// which is a to-do list for one person. This tells the owner, who is the person who can fix it.
//
// ONE, EVER. A reminder that repeats is a reason to mute the bot, and the bot is also how every
// event announcement reaches them. The sender stamps the clan's audit log whatever the outcome, so a
// DM that could not be delivered is not retried on the next day's run.
//
// No `@/db` import: the eligibility rule and the copy are tested without a database.

import { isChaseable, reasonFor, type LeadRow } from '@/lib/leadsDigest';

/** The audit event that marks a clan as reminded. Its presence is the whole "already sent" check. */
export const NUDGE_EVENT = 'onboarding_nudge_sent';

export type NudgeReason = 'unverified' | 'no-members';

/**
 * Does this clan get the reminder? Same window and same stall rule as the ops digest — old enough
 * to have had a fair go (a day), young enough that a nudge is still welcome (thirty) — but only for
 * the two stalls the plugin fixes. "Has members, never ran an event" is a different conversation.
 */
export function nudgeReasonFor(row: LeadRow, now: number, alreadyNudged: boolean): NudgeReason | null {
  if (alreadyNudged || (!row.ownerDiscordId && !row.ownerEmail)) return null;
  if (!isChaseable(row, now)) return null;
  if (reasonFor(row) === 'unverified') return 'unverified';
  // The owner alone is a roster of one — the line the checklist and dashboard draw. The digest's
  // `members === 0` would let a verified clan holding only its owner's seat slip past.
  return row.members <= 1 ? 'no-members' : null;
}

export interface NudgeText {
  subject: string;
  /** Paragraphs, plain text with Discord markdown. */
  lines: string[];
  /** The numbered how-to, kept separate so email can render it as a list. */
  steps: string[];
  cta: { label: string; url: string };
  guideUrl: string;
}

export function nudgeText(opts: {
  clanName: string;
  reason: NudgeReason;
  setupUrl: string;
  guideUrl: string;
}): NudgeText {
  const steps = [
    'In RuneLite: **Configuration** (the wrench) → **Plugin Hub** → search **Anvil** → **Install**.',
    'Open the **Anvil** side panel and press **Sign in with Discord**.',
    'Log in to OSRS, open your **clan window**, and press the **Anvil** button in its title bar.',
  ];
  const lines =
    opts.reason === 'unverified'
      ? [
          `Your clan **${opts.clanName}** is on Anvil, but its member list hasn't come in yet. Sign-ups, boards and Discord roles all run off that list, and loading it takes about two minutes:`,
          'Any rank works, as long as you are in the clan. That first sync also proves the clan is yours, so nobody else can claim the name.',
        ]
      : [
          `Your clan **${opts.clanName}** is verified on Anvil, but its member list is still empty. Sign-ups, boards and Discord roles all run off that list, and loading it takes about two minutes:`,
          'After the first sync the plugin keeps the list up to date by itself whenever an admin logs in.',
        ];
  return {
    subject: `Finish setting up ${opts.clanName} on Anvil`,
    lines,
    steps,
    cta: { label: 'Open setup', url: opts.setupUrl },
    guideUrl: opts.guideUrl,
  };
}

/** The DM body: one embed, the steps numbered inline. */
export function nudgeEmbedDescription(t: NudgeText): string {
  const [intro, ...rest] = t.lines;
  return [
    intro,
    t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    ...rest,
    `[Open setup](${t.cta.url}) · [Plugin guide](${t.guideUrl})`,
    '-# This is the only reminder Anvil will send about this.',
  ].join('\n\n');
}
