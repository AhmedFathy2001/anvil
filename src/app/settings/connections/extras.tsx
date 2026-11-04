import type { ReactNode } from 'react';

import type { ConnectedLink, Platform } from '@/lib/connectedAccountsRules';
import StreamClipSetting from '@/components/settings/StreamClipSetting';

/**
 * EXTENSION POINT — per-platform settings under a linked account in settings > Connected accounts.
 *
 * Rendered once for every platform the person has linked, right under its row, inside the same card.
 * Return null for "nothing extra". Features that only make sense with a linked account put their
 * controls here rather than editing the page.
 *
 * Use the settings building blocks (../_ui SettingsRow, ../_client SettingSwitch) so the rows look like
 * every other setting. This is a server component: read what you need with `userId`.
 *
 *   twitch — stream highlights' "Clip my stream when I hit a big moment" (lib/highlights).
 */
export async function ConnectedAccountExtras({
  platform,
  userId,
  link,
}: {
  platform: Platform;
  userId: number;
  link: ConnectedLink;
}): Promise<ReactNode> {
  void link;
  if (platform === 'twitch') return <StreamClipSetting userId={userId} />;
  return null;
}
