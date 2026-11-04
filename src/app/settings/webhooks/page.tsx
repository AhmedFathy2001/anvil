import { verifyUser } from '@/lib/auth';
import { emissionSettingsView } from '@/lib/emissionSettings';
import { WebhooksPanel } from '../EmissionPanels';
import { NeedsCharacter } from '../_none';
import { SettingsBlock, SettingsGroup, SettingsTitle } from '../_ui';

export default async function WebhooksSettingsPage() {
  const session = (await verifyUser())!;
  const view = session.playerId ? await emissionSettingsView(session.userId, session.playerId) : null;

  return (
    <>
      <SettingsTitle title="Discord webhooks">
        Send copies of your notifications to your own Discord channels, separate from any clan. Paste a webhook from a
        channel&rsquo;s Integrations → Webhooks.
      </SettingsTitle>
      {!view || view.accounts.length === 0 ? (
        <NeedsCharacter what="Webhooks" />
      ) : (
        <SettingsGroup title="Your webhooks">
          <SettingsBlock>
            <WebhooksPanel initial={view} />
          </SettingsBlock>
        </SettingsGroup>
      )}
    </>
  );
}
