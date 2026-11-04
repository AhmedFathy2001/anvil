import type { ReactNode } from 'react';

import type { ConnectedLink, Platform } from '@/lib/connectedAccountsRules';

/**
 * EXTENSION POINT — per-platform settings under a linked account in settings > Connected accounts.
 *
 * Rendered once for every platform the person has linked, right under its row, inside the same card.
 * Return null for "nothing extra". Features that only make sense with a linked account put their
 * controls here rather than editing the page, e.g. stream highlights' "Clip my stream when I hit a big
 * moment" (Twitch only):
 *
 *   if (platform === 'twitch') return <SettingsRow label="Clip my stream when I hit a big moment" …>…</SettingsRow>;
 *
 * Use the settings building blocks (../_ui SettingsRow, ../_client SettingSwitch) so the rows look like
 * every other setting. This is a server component: read what you need with `userId`.
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
  void platform;
  void userId;
  void link;
  return null;
}
