import { detectedFor, settingsCharacters } from '@/lib/settingsData';
import AddCharacterClient from '@/app/profile/AddCharacterClient';
import DetectedAccountsClient from '@/app/profile/DetectedAccountsClient';
import IgnoredAccountsClient from '@/app/profile/IgnoredAccountsClient';
import { SettingsBlock, SettingsGroup, SettingsTitle } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

/**
 * Adding a character, and the two lists that feed it: characters the plugin saw you play that aren't
 * linked yet, and the ones you said weren't yours. `?connect=<rsn>` (from the apex home or an old
 * /profile link) pre-fills the name.
 */
export default async function AddCharacterPage({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const session = await settingsSession();
  const suggestedRsn = ((await searchParams).connect ?? '').trim().slice(0, 12);
  const characters = session.playerId ? await settingsCharacters(session.playerId) : [];
  const detected = await detectedFor(session.userId, characters);

  return (
    <>
      <SettingsTitle title="Add a character">
        Play it once with the Anvil plugin and it links itself. On mobile or the official client, link it by name instead.
      </SettingsTitle>

      {detected.pending.length > 0 && (
        <SettingsGroup title="We noticed you playing">
          <SettingsBlock>
            <DetectedAccountsClient initial={detected.pending} />
          </SettingsBlock>
        </SettingsGroup>
      )}

      <SettingsGroup title="Link a character" id="link-account">
        <SettingsBlock>
          <AddCharacterClient
            first={characters.length === 0}
            suggestedRsn={suggestedRsn}
            linkedCount={characters.length}
            detectedCount={detected.pending.length}
          />
        </SettingsBlock>
      </SettingsGroup>

      {detected.ignored.length > 0 && (
        <SettingsGroup title="Not mine">
          <SettingsBlock>
            <IgnoredAccountsClient initial={detected.ignored} />
          </SettingsBlock>
        </SettingsGroup>
      )}
    </>
  );
}
