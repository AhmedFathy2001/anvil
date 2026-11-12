import ClanLink from '@/components/ClanLink';

import { LoginGroups } from '../_parts/account';
import { StreamingGroups } from '../_parts/connections';
import { PrivacyGroups } from '../_parts/privacy';
import { PartJumps, SettingsPart, SettingsTitle } from '../_ui';

export const dynamic = 'force-dynamic';

/**
 * Account: signing in (devices, sessions, clan billing), the streaming accounts you linked, and who
 * sees your characters. Was Login & devices, Streaming accounts and Who sees my characters.
 */
export default function AccountSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <SettingsTitle title="Account">Signing in, the accounts you linked, and who can see your characters.</SettingsTitle>
      <PartJumps
        parts={[
          { id: 'login', label: 'Login & devices' },
          { id: 'streaming', label: 'Streaming accounts' },
          { id: 'privacy', label: 'Who sees my characters' },
        ]}
      />

      <SettingsPart id="login" title="Login & devices">
        <LoginGroups />
      </SettingsPart>

      <SettingsPart
        id="streaming"
        title="Streaming accounts"
        intro="Link where you stream and clip. Anvil only learns who you are on each one — it never posts as you or keeps a key to your account. Linked accounts also get you into streamers’ follower and subscriber events without linking again."
      >
        <StreamingGroups searchParams={searchParams} />
      </SettingsPart>

      <SettingsPart
        id="privacy"
        title="Who sees my characters"
        intro={
          <>
            What people outside your clans can see. A clan always sees the characters on its own roster; these choices are about everyone
            else. Hiding chat in screenshots is under{' '}
            <ClanLink href="/settings/posts#screenshot-privacy" className="text-gold hover:text-gold-light">
              Discord posts &amp; screenshots →
            </ClanLink>
          </>
        }
      >
        <PrivacyGroups />
      </SettingsPart>
    </>
  );
}
