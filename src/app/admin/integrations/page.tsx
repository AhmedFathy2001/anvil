import Link from 'next/link';
import SettingsTabs from './SettingsTabs';
import { listBotChannels } from '@/lib/discord-broadcast';

export const dynamic = 'force-dynamic';

export default async function AdminIntegrationsPage() {
  // Fetch the bot's channel list once, server-side, and pass it to every WebhookField so the channel
  // pickers don't each fire their own request. `botEnabled` is false with no bot token.
  const { enabled: botEnabled, channels } = await listBotChannels();
  return (
    <div className="max-w-3xl">
      <header className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Advanced settings</h1>
        <p className="text-text-muted text-sm">
          Fine-tune every service Anvil talks to. New here? Try the{' '}
          <Link href="/admin/setup" className="text-gold hover:underline">
            guided setup
          </Link>{' '}
          instead — nothing here is required to start.
        </p>
      </header>

      <p className="text-xs text-text-muted mb-5">
        Clan name and roster sync live under <span className="text-foreground/80">Clan → Roster</span>.
      </p>

      <SettingsTabs channels={channels} botEnabled={botEnabled} />
    </div>
  );
}
