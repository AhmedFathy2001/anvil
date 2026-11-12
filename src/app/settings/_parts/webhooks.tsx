import { emissionSettingsView } from '@/lib/emissionSettings';
import { WebhooksPanel } from '../EmissionPanels';
import { NeedsCharacter } from '../_none';
import { SettingsBlock, SettingsGroup } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

export async function WebhookGroups() {
  const session = await settingsSession();
  const view = session.playerId ? await emissionSettingsView(session.userId, session.playerId) : null;

  return (
    <>
      {!view || view.accounts.length === 0 ? (
        <NeedsCharacter what="Webhooks" />
      ) : (
        <SettingsGroup title="Your webhooks" id="your-webhooks">
          <SettingsBlock>
            <WebhooksPanel initial={view} />
          </SettingsBlock>
        </SettingsGroup>
      )}
    </>
  );
}
