import { eq } from 'drizzle-orm';

import ClanLink from '@/components/ClanLink';
import PersonalNote from '@/components/PersonalNote';
import { db } from '@/db';
import { users } from '@/db/schema';
import { anvilServerMember } from '@/lib/anvilDiscord';
import { operatorDiscordId } from '@/lib/welcomeDm';
import { SettingSwitch } from '../_client';
import { SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

// How Anvil itself reaches this person (lib/notices, lib/welcomeDm): the site bell's sound and DMs from
// Anvil's bot. Clan announcements are elsewhere (/settings/announcements); this is Anvil, not a clan.
export default async function NotificationSettingsPage() {
  const session = await settingsSession();
  const me = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { noticeSound: true, anvilDms: true, discordId: true },
  });
  const [inServer, contactId] = await Promise.all([anvilServerMember(me?.discordId).catch(() => null), operatorDiscordId().catch(() => null)]);

  return (
    <>
      <SettingsTitle title="Notifications">
        How Anvil lets you know about things that matter: a plugin update you need to act on, a billing problem, a note from me. All
        of it is in your <ClanLink href="/inbox" className="text-gold hover:text-gold-light">inbox</ClanLink>.
      </SettingsTitle>

      <SettingsGroup title="On the site">
        <SettingsRow label="Play a sound" description="A short chime when a new notice arrives while Anvil is open in a tab.">
          <SettingSwitch url="/api/notices" method="POST" field="sound" extra={{ action: 'prefs' }} checked={!!me?.noticeSound} label="Play a sound for new notices" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Discord"
        note="Only important updates, never marketing. Every DM has a Stop button too. Discord only lets the bot DM you while you share a server with it."
      >
        <SettingsRow label="DM me important updates" description={me?.anvilDms === 'yes' ? 'On' : 'Off'}>
          <SettingSwitch url="/api/notices" method="POST" field="dms" extra={{ action: 'prefs' }} checked={me?.anvilDms === 'yes'} label="DM me important updates" />
        </SettingsRow>
      </SettingsGroup>

      <PersonalNote contactId={contactId} joinBack={inServer ? null : '/settings/notifications'} className="mt-6">
        Stuck on something, or want to tell me what&rsquo;s missing? Discord is the quickest way to reach me.
      </PersonalNote>
    </>
  );
}
