import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { players } from '@/db/schema';
import SupporterName from '@/components/SupporterName';
import { supporterForUser } from '@/lib/supporter';
import { settingsCharacters } from '@/lib/settingsData';
import { SettingSwitch } from '../_client';
import { SettingsGroup, SettingsRow } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

export async function PrivacyGroups() {
  const session = await settingsSession();
  const [[person, characters], supporter] = await Promise.all([
    session.playerId
      ? Promise.all([db.query.players.findFirst({ where: eq(players.id, session.playerId) }), settingsCharacters(session.playerId)])
      : Promise.resolve([null, []] as const),
    supporterForUser(session.userId),
  ]);
  const sharedCount = characters.filter((c) => c.shared).length;

  return (
    <>
      {characters.length > 0 && (
        <SettingsGroup
          title="Who can see each character"
          id="character-visibility"
          note="On: the character has its own public page and shows on the cross-clan leaderboards."
        >
          {characters.map((c) => (
            <SettingsRow
              key={c.accountId}
              label={<SupporterName name={c.rsn} tier={supporter?.tier.id} style={supporter?.style} plain />}
              description={c.shared ? 'Public' : 'Only its clans'}>
              <SettingSwitch
                url={`/api/profile/accounts/${c.accountId}/share`}
                field="shared"
                checked={c.shared}
                label={`Show ${c.rsn} publicly`}
              />
            </SettingsRow>
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup title="Across Anvil" id="across-anvil">
        {characters.length >= 2 && (
          <SettingsRow
            label="Show that my characters are one person"
            description={
              <>
                Your public characters link to each other.
                {sharedCount < 2 && ' Takes effect once more than one is public.'}
              </>
            }
          >
            <SettingSwitch url="/api/profile/link-accounts" field="link" checked={person?.linkAccountsPublicly ?? false} label="Link my characters publicly" />
          </SettingsRow>
        )}
        <SettingsRow label="Show other clans’ public boards on my home" description="The “Open to everyone” list on the Anvil home page.">
          <SettingSwitch url="/api/profile/discover-events" field="show" checked={person?.discoverEvents ?? true} label="Show other clans' boards" />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
