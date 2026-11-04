import { playerClipSetting } from '@/lib/highlights/store';
import { SettingSwitch } from '@/app/settings/_client';
import { SettingsGroup, SettingsRow } from '@/app/settings/_ui';

/**
 * A player's own "clip my stream" switch (lib/highlights). Self-contained: it reads its own row and
 * renders nothing until the person has linked Twitch, so it can sit beside the Twitch link wherever
 * that lives. `group` wraps it in its own settings group, for a page with no Twitch section to join.
 */
export default async function StreamClipSetting({ userId, group = false }: { userId: number; group?: boolean }) {
  const s = await playerClipSetting(userId);
  if (!s) return null;
  const row = (
    <SettingsRow
      label="Clip my stream when I hit a big moment in a streamed event"
      description={
        <>
          While you&rsquo;re live on twitch.tv/{s.login} and playing a streamer&rsquo;s event, Anvil clips your rare drops,
          pets and finished tiles. The clips show on that event&rsquo;s page. Off unless you turn it on.
        </>
      }
    >
      <SettingSwitch url="/api/profile/stream-clips" field="on" checked={s.on} label="Clip my stream when I hit a big moment" />
    </SettingsRow>
  );
  return group ? <SettingsGroup title="Your stream">{row}</SettingsGroup> : row;
}
