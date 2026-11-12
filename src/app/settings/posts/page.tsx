import ClanLink from '@/components/ClanLink';

import { NotificationGroups } from '../_parts/notifications';
import { PostsGroups } from '../_parts/announcements';
import { WebhookGroups } from '../_parts/webhooks';
import { PartJumps, SettingsPart, SettingsTitle } from '../_ui';

export const dynamic = 'force-dynamic';

/**
 * Posts & alerts: how Anvil reaches you, what your plugin posts to your clans' Discords (and which
 * chat its screenshots hide), and copies to your own webhooks. Was Notifications, Discord posts &
 * screenshots, and Your Discord webhooks.
 */
export default function PostsSettingsPage() {
  return (
    <>
      <SettingsTitle title="Posts & alerts">
        What Anvil tells you, and what your plugin posts for you.
      </SettingsTitle>
      <PartJumps
        parts={[
          { id: 'notifications', label: 'Notifications' },
          { id: 'discord-posts', label: 'Discord posts & screenshots' },
          { id: 'webhooks', label: 'Your webhooks' },
        ]}
      />

      <SettingsPart
        id="notifications"
        title="Notifications"
        intro={
          <>
            How Anvil lets you know about things that matter: a plugin update you need to act on, a billing problem, a note from me. All
            of it is in your{' '}
            <ClanLink href="/inbox" className="text-gold hover:text-gold-light">
              inbox
            </ClanLink>
            .
          </>
        }
      >
        <NotificationGroups />
      </SettingsPart>

      <SettingsPart
        id="discord-posts"
        title="Discord posts & screenshots"
        intro="What your plugin posts to your clans’ Discords (drops, pets, deaths, combat achievements and the rest) and which chat is hidden in its screenshots. Bingo submissions aren’t affected: those always reach the clan running the board."
      >
        <PostsGroups />
      </SettingsPart>

      <SettingsPart
        id="webhooks"
        title="Your Discord webhooks"
        intro="Copies of your notifications in your own Discord channels, separate from any clan. Paste a webhook from a channel’s Integrations → Webhooks."
      >
        <WebhookGroups />
      </SettingsPart>
    </>
  );
}
