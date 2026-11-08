import { claimsOnMyCharacters, myOwnershipClaims, noticesFor, OBJECTION_DAYS } from '@/lib/ownershipClaims';
import { ActionButton } from '../_client';
import { Pill, SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

function day(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? '' : new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const CLOSED_LABEL: Record<string, string> = {
  transferred: 'moved to you',
  objected: 'with Anvil staff',
  declined: 'with Anvil staff',
  staff: 'with Anvil staff',
  withdrawn: 'withdrawn',
  expired: 'check timed out',
  lapsed: 'closed',
};

/**
 * /settings/claims — "This is my account" claims (lib/ownershipClaims), from both sides, and the
 * notices Anvil left about them.
 *
 * On YOUR characters: somebody proved control of one with the XP check and says it's theirs. You see
 * who is asking and answer here. Asked by YOU: where your claim stands — never who the owner is.
 */
export default async function OwnershipClaimsPage() {
  const session = await settingsSession();
  const [onMine, mine, notices] = await Promise.all([
    session.playerId ? claimsOnMyCharacters(session.playerId) : Promise.resolve([]),
    myOwnershipClaims(session.userId),
    noticesFor(session.userId),
  ]);

  return (
    <>
      <SettingsTitle title="Ownership claims">
        When a character is linked to another Anvil account, its real owner can claim it: they prove control with a quick XP check, and
        only then is the current owner asked. Nothing moves without the owner being told, and everything a character earned stays where it
        was recorded.
      </SettingsTitle>

      <SettingsGroup
        title="Claims on your characters"
        id="claims-on-yours"
        note={
          onMine.length > 0
            ? `A character you never verified moves after ${OBJECTION_DAYS} days unless you object. One you verified moves only if you approve. Saying no hands it to Anvil staff.`
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
                {c.status === 'approved' || c.status === 'transferring' ? (
                  <Pill tone="gold">moving after its event</Pill>
                ) : c.mode === 'objection' ? (
                  <Pill tone="yellow">moves {day(c.deadlineAt)} unless you object</Pill>
                ) : (
                  <Pill tone="yellow">needs your answer</Pill>
                )}
              </>
            }
            description={`${c.claimantName} proved control of ${c.rsn} with Anvil’s XP check and says it’s theirs.`}
          >
            {c.status === 'open' && (
              <div className="flex gap-2">
                <ActionButton
                  url={`/api/profile/ownership-claims/${c.id}`}
                  body={{ action: 'decline' }}
                  confirm={{
                    title: `Keep ${c.rsn}?`,
                    body: `${c.rsn} stays on your account for now and Anvil staff look at both sides — ${c.claimantName} proved control of it too.`,
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

      <SettingsGroup title="Your claims" id="your-claims">
        {mine.length === 0 && (
          <SettingsRow
            label="You haven’t claimed any character."
            description="Logged into a character the plugin says belongs to another Anvil player? Press “This is my account” in the plugin’s side panel (You tab)."
          />
        )}
        {mine.map((c) => {
          const live = c.status === 'verifying' || c.status === 'open' || c.status === 'approved' || c.status === 'transferring';
          return (
            <SettingsRow
              key={c.id}
              label={
                <>
                  {c.rsn}
                  {c.status === 'verifying' ? (
                    <Pill tone="yellow">XP check</Pill>
                  ) : live ? (
                    <Pill tone="yellow">open</Pill>
                  ) : (
                    <Pill tone={c.status === 'transferred' ? 'green' : 'muted'}>{CLOSED_LABEL[c.status] ?? c.status}</Pill>
                  )}
                </>
              }
              description={c.line}
            >
              {live && c.status !== 'transferring' && (
                <div className="flex gap-2">
                  {c.status === 'verifying' && (
                    <ActionButton url={`/api/profile/ownership-claims/${c.id}`} body={{ action: 'check' }}>
                      Check
                    </ActionButton>
                  )}
                  <ActionButton
                    url={`/api/profile/ownership-claims/${c.id}`}
                    body={{ action: 'withdraw' }}
                    confirm={{ title: `Withdraw your claim on ${c.rsn}?`, body: 'The current owner keeps it.', confirmLabel: 'Withdraw' }}
                  >
                    Withdraw
                  </ActionButton>
                </div>
              )}
            </SettingsRow>
          );
        })}
      </SettingsGroup>

      {notices.length > 0 && (
        <SettingsGroup title="Notices">
          {notices.map((n) => (
            <SettingsRow
              key={n.id}
              label={
                <>
                  {n.title}
                  {n.readAt == null && <Pill tone="gold">new</Pill>}
                </>
              }
              description={`${n.body.replace(/\*\*/g, '')} · ${day(n.createdAt)}`}
            />
          ))}
        </SettingsGroup>
      )}
    </>
  );
}
