import { verifyUser } from '@/lib/auth';
import { claimsOnMyCharacters, myOwnershipClaims, OBJECTION_DAYS } from '@/lib/ownershipClaims';
import { ActionButton } from '../_client';
import { Pill, SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';

function day(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const CLOSED_LABEL: Record<string, string> = {
  transferred: 'moved to you',
  objected: 'owner objected',
  declined: 'owner declined',
  withdrawn: 'withdrawn',
  lapsed: 'closed',
};

/**
 * /settings/claims — "This is my account" claims (lib/ownershipClaims), from both sides.
 *
 * On YOUR characters: somebody's plugin is logged into one and they say it's theirs. You see who is
 * asking and answer here. Asked FROM your plugin: where your claim stands — never who the owner is.
 */
export default async function OwnershipClaimsPage() {
  const session = (await verifyUser())!;
  const [onMine, mine] = await Promise.all([
    session.playerId ? claimsOnMyCharacters(session.playerId) : Promise.resolve([]),
    myOwnershipClaims(session.userId),
  ]);

  return (
    <>
      <SettingsTitle title="Ownership claims">
        When somebody&rsquo;s RuneLite plugin is logged into a character linked to another Anvil account, they can say it&rsquo;s
        theirs. Nothing moves without the owner being told, and everything a character earned stays where it was recorded.
      </SettingsTitle>

      <SettingsGroup
        title="Claims on your characters"
        note={
          onMine.length > 0
            ? `A character linked by name only moves after ${OBJECTION_DAYS} days unless you object. One your own plugin proved moves only if you approve.`
            : null
        }
      >
        {onMine.length === 0 && <SettingsRow label="Nobody is asking for any of your characters." />}
        {onMine.map((c) => (
          <SettingsRow
            key={c.id}
            label={
              <>
                {c.rsn}
                {c.status === 'approved' ? (
                  <Pill tone="gold">moving after its event</Pill>
                ) : c.mode === 'objection' ? (
                  <Pill tone="yellow">moves {day(c.deadlineAt)} unless you object</Pill>
                ) : (
                  <Pill tone="yellow">needs your answer</Pill>
                )}
              </>
            }
            description={`${c.claimantName}’s plugin is logged into ${c.rsn} and says it’s theirs (asked ${day(c.createdAt)}).`}
          >
            {c.status === 'open' && (
              <div className="flex gap-2">
                <ActionButton
                  url={`/api/profile/ownership-claims/${c.id}`}
                  body={{ action: 'decline' }}
                  confirm={{
                    title: `Keep ${c.rsn}?`,
                    body: `${c.rsn} stays on your account and ${c.claimantName}’s claim closes. If they still think it’s theirs they can ask Anvil staff.`,
                    confirmLabel: c.mode === 'objection' ? 'Object' : 'Decline',
                  }}
                >
                  {c.mode === 'objection' ? 'Object — it’s mine' : 'Decline'}
                </ActionButton>
                <ActionButton
                  url={`/api/profile/ownership-claims/${c.id}`}
                  body={{ action: 'approve' }}
                  tone="danger"
                  confirm={{
                    title: `Give ${c.rsn} to ${c.claimantName}?`,
                    body: 'It leaves your Anvil account. Results it already earned stay where they were recorded. If it is in a live event, it moves when the event ends.',
                    confirmLabel: 'Give it to them',
                  }}
                >
                  Approve
                </ActionButton>
              </div>
            )}
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup title="Your claims">
        {mine.length === 0 && (
          <SettingsRow
            label="You haven’t claimed any character."
            description="Logged into a character the plugin says belongs to another Anvil player? Press “This is my account” in the plugin’s side panel."
          />
        )}
        {mine.map((c) => (
          <SettingsRow
            key={c.id}
            label={
              <>
                {c.rsn}
                {c.status === 'open' || c.status === 'approved' ? (
                  <Pill tone="yellow">open</Pill>
                ) : (
                  <Pill tone={c.status === 'transferred' ? 'green' : 'muted'}>{CLOSED_LABEL[c.status] ?? c.status}</Pill>
                )}
              </>
            }
            description={c.line}
          >
            {(c.status === 'open' || c.status === 'approved') && (
              <ActionButton
                url={`/api/profile/ownership-claims/${c.id}`}
                body={{ action: 'withdraw' }}
                confirm={{ title: `Withdraw your claim on ${c.rsn}?`, body: 'The current owner keeps it.', confirmLabel: 'Withdraw' }}
              >
                Withdraw
              </ActionButton>
            )}
          </SettingsRow>
        ))}
      </SettingsGroup>
    </>
  );
}
