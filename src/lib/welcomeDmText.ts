// The one welcome DM from Anvil's bot, in Ahmed's own voice. Pure — lib/welcomeDm sends it.
//
// ONE MESSAGE, THEN SILENCE. It thanks them, says how to reach a person (a reply to a bot goes
// nowhere, so it says so), and asks once whether they want important updates by DM. Nothing else is
// ever sent by DM unless they press Yes, and every later DM carries a Stop button (lib/notices).

export const DMS_YES = 'anvil-dms:yes';
export const DMS_NO = 'anvil-dms:no';
export const DMS_STOP = 'anvil-dms:stop';
export const DMS_IDS = [DMS_YES, DMS_NO, DMS_STOP] as const;
export type DmsChoice = 'yes' | 'no';

export type WelcomeFor = { kind: 'clan'; clanName: string } | { kind: 'supporter'; tierName: string };

export interface WelcomeOpts {
  name: string | null;
  for: WelcomeFor;
  /** The person to message (the operator's Discord id), rendered as a mention. */
  contactId: string | null;
  supportInvite: string;
}

const BUTTON = { PRIMARY: 1, SECONDARY: 2, LINK: 5 } as const;

function firstName(name: string | null): string {
  const n = (name ?? '').replace(/[*_~`|>]/g, '').trim();
  return n ? ` ${n.slice(0, 40)}` : '';
}

export function welcomeText(o: WelcomeOpts): string {
  const thanks =
    o.for.kind === 'clan'
      ? `Thanks for setting up **${o.for.clanName.replace(/[*_~`|>]/g, '')}** on Anvil! The checklist on your dashboard walks you through the rest, but if anything is confusing, broken, or just not how you'd want it, tell me. I read everything, and I'd really like to hear what's getting in your way.`
      : `Thank you for becoming an Anvil ${o.for.tierName}! You're what keeps Anvil running. If anything's off with your perks, or you've got an idea, tell me.`;
  const reach = o.contactId
    ? `Replies to this bot don't reach me, so message me directly (<@${o.contactId}>) or post in the support server: ${o.supportInvite}`
    : `Replies to this bot don't reach me, so come say hi in the support server: ${o.supportInvite}`;
  return [
    `Hey${firstName(o.name)}, I'm Ahmed, I build Anvil.`,
    thanks,
    reach,
    'Want me to DM you when something important changes? Things like a plugin update you need to act on, or a problem with billing. No marketing, and you can stop it any time.',
    '— Ahmed',
  ].join('\n\n');
}

/** The full message body: the text and the Yes / No / Support row. */
export function welcomeMessage(o: WelcomeOpts): Record<string, unknown> {
  return {
    content: welcomeText(o),
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: BUTTON.PRIMARY, label: 'Yes, DM me important updates', custom_id: DMS_YES },
          { type: 2, style: BUTTON.SECONDARY, label: 'No thanks', custom_id: DMS_NO },
          { type: 2, style: BUTTON.LINK, label: 'Support server', url: o.supportInvite },
        ],
      },
    ],
  };
}

/** The Stop row every notice DM carries. */
export function stopRow(): Record<string, unknown> {
  return { type: 1, components: [{ type: 2, style: BUTTON.SECONDARY, label: 'Stop these DMs', custom_id: DMS_STOP }] };
}

/** What a button press turns the message's buttons into: one greyed-out line saying what happened. */
export function choiceRow(choice: DmsChoice, supportInvite: string): Record<string, unknown> {
  const label = choice === 'yes' ? "You'll get important updates here" : "Got it, no more DMs";
  return {
    type: 1,
    components: [
      { type: 2, style: BUTTON.SECONDARY, label, custom_id: 'anvil-dms:done', disabled: true },
      { type: 2, style: BUTTON.LINK, label: 'Support server', url: supportInvite },
    ],
  };
}

/** The button's custom_id → the choice it records. */
export function choiceFor(customId: string): DmsChoice | null {
  if (customId === DMS_YES) return 'yes';
  if (customId === DMS_NO || customId === DMS_STOP) return 'no';
  return null;
}
