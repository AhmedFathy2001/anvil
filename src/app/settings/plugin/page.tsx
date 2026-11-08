import ClanLink from '@/components/ClanLink';

import PluginPlayerTokenClient from '@/app/profile/PluginPlayerTokenClient';
import { SettingsBlock, SettingsGroup, SettingsTitle } from '../_ui';

export default function PluginSettingsPage() {
  return (
    <>
      <SettingsTitle title="Plugin connection">
        What the Anvil RuneLite plugin signs in with. You rarely need it: <b className="text-foreground">Sign in with Discord</b> in the
        panel sets it for you. <ClanLink href="/guide/plugin" className="text-gold hover:text-gold-light">Plugin setup guide →</ClanLink>
      </SettingsTitle>
      <SettingsGroup title="Your token" id="plugin-token">
        <SettingsBlock>
          <PluginPlayerTokenClient />
        </SettingsBlock>
      </SettingsGroup>
    </>
  );
}
