import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { players } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { settingsCharacters } from '@/lib/settingsData';
import { SettingSwitch } from '../_client';
import { SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';

export default async function PrivacySettingsPage() {
  const session = (await verifyUser())!;
  const [person, characters] = session.playerId
    ? await Promise.all([db.query.players.findFirst({ where: eq(players.id, session.playerId) }), settingsCharacters(session.playerId)])
    : [null, []];
  const sharedCount = characters.filter((c) => c.shared).length;

  return (
    <>
      <SettingsTitle title="Privacy">
        What people outside your clans can see. A clan always sees the characters on its own roster; these choices are about everyone
        else.
      </SettingsTitle>

      {characters.length > 0 && (
        <SettingsGroup
          title="Who can see each character"
          note="On: the character has its own public page and shows on the cross-clan leaderboards."
        >
          {characters.map((c) => (
            <SettingsRow key={c.accountId} label={c.rsn} description={c.shared ? 'Public' : 'Only its clans'}>
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

      <SettingsGroup title="Across Anvil">
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
