import { playerClipSetting } from '@/lib/highlights/store';
import { SettingSwitch } from '@/app/settings/_client';
import { SettingsRow } from '@/app/settings/_ui';

/**
 * A player's own "clip my stream" switch (lib/highlights), under their linked Twitch in Settings →
 * Connected accounts (settings/connections/extras). Reads its own row; nothing without a Twitch link.
 */
export default async function StreamClipSetting({ userId }: { userId: number }) {
  const s = await playerClipSetting(userId);
  if (!s) return null;
  return (
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
}
