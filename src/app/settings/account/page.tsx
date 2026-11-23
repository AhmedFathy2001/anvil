import ClanLink from '@/components/ClanLink';

import { LoginGroups } from '../_parts/account';
import { PlanGroups } from '../_parts/supporter';
import { StreamingGroups } from '../_parts/connections';
import { PrivacyGroups } from '../_parts/privacy';
import { DataGroups } from '../_parts/data';
import { PartJumps, SettingsPart, SettingsTitle } from '../_ui';

export const dynamic = 'force-dynamic';

/**
 * Account: your plan, signing in (devices, sessions, clan billing), the streaming accounts you linked, who
 * sees your characters, and at the bottom your data (download it, or delete the account). Was Login & devices, Streaming accounts and Who sees my characters.
 */
export default function AccountSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <SettingsTitle title="Account">Your plan, signing in, the accounts you linked, and who can see your characters.</SettingsTitle>
      <PartJumps
        parts={[
          { id: 'plan', label: 'Your plan & billing' },
          { id: 'login', label: 'Login & devices' },
          { id: 'streaming', label: 'Streaming accounts' },
          { id: 'privacy', label: 'Who sees my characters' },
          { id: 'your-data', label: 'Your data' },
        ]}
      />

      <SettingsPart id="plan" title="Your plan & billing" intro="Supporters pay for Anvil’s servers, and their name says so.">
        <PlanGroups />
      </SettingsPart>

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
            Every character’s page is public. These choices are about showing your characters as one person and what your home page
            lists. Hiding chat in screenshots is under{' '}
            <ClanLink href="/settings/posts#screenshot-privacy" className="text-gold hover:text-gold-light">
              Discord posts &amp; screenshots →
            </ClanLink>
          </>
        }
      >
        <PrivacyGroups />
      </SettingsPart>

      {/* Last, and apart from everything above: the two things that are about the whole account. */}
      <div className="mt-10 border-t border-card-border pt-8">
        <SettingsPart id="your-data" title="Your data" intro="Take a copy of everything Anvil holds about you, or delete your account.">
          <DataGroups />
        </SettingsPart>
      </div>
    </>
  );
}
