import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { players } from '@/db/schema';
import { settingsCharacters } from '@/lib/settingsData';
import { SettingSwitch } from '../_client';
import { SettingsGroup, SettingsRow } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

export async function PrivacyGroups() {
  const session = await settingsSession();
  const [person, characters] = session.playerId
    ? await Promise.all([db.query.players.findFirst({ where: eq(players.id, session.playerId) }), settingsCharacters(session.playerId)])
    : [null, []];

  return (
    <>
      <SettingsGroup title="Across Anvil" id="across-anvil">
        {characters.length >= 2 && (
          <SettingsRow
            label="Show that my characters are one person"
            description="Your characters link to each other."
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
