import { runningXpCheck } from '@/lib/xpCheckRead';
import { detectedFor, settingsCharacters } from '@/lib/settingsData';
import AddCharacterClient from '@/app/profile/AddCharacterClient';
import DetectedAccountsClient from '@/app/profile/DetectedAccountsClient';
import IgnoredAccountsClient from '@/app/profile/IgnoredAccountsClient';
import { continueQuery, readContinue } from '@/lib/clanScopedPaths';
import { SettingsBlock, SettingsGroup } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

/**
 * Adding a character, and the two lists that feed it: characters the plugin saw you play that aren't
 * linked yet, and the ones you said weren't yours. `?connect=<rsn>` (from the apex home or an old
 * /profile link) pre-fills the name.
 */
export async function AddGroups({ searchParams }: { searchParams: Promise<{ connect?: string; next?: string; for?: string }> }) {
  const session = await settingsSession();
  const params = await searchParams;
  const suggestedRsn = (params.connect ?? '').trim().slice(0, 12);
  // Kept on the "Verify ownership" link, so the way back survives that hop.
  const continueQs = continueQuery(readContinue(params));
  const characters = session.playerId ? await settingsCharacters(session.playerId) : [];
  const checkRunning = !!(await runningXpCheck(session.userId).catch(() => null));
  const detected = await detectedFor(session.userId, characters);

  return (
    <>
      {detected.pending.length > 0 && (
        <SettingsGroup title="We noticed you playing" id="detected">
          <SettingsBlock>
            <DetectedAccountsClient initial={detected.pending} continueQs={continueQs} />
          </SettingsBlock>
        </SettingsGroup>
      )}

      <SettingsGroup title="Link a character" id="link-account">
        <SettingsBlock>
          <AddCharacterClient
            first={characters.length === 0}
            suggestedRsn={suggestedRsn}
            checkRunning={checkRunning}
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
