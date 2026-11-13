import PluginPlayerTokenClient from '@/app/profile/PluginPlayerTokenClient';
import { SettingsBlock, SettingsGroup } from '../_ui';

export function PluginGroups() {
  return (
    <>
      <SettingsGroup title="Your token" id="plugin-token">
        <SettingsBlock>
          <PluginPlayerTokenClient />
        </SettingsBlock>
      </SettingsGroup>
    </>
  );
}
