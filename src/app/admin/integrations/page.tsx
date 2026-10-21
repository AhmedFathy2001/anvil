import { requireClan } from '@/lib/clanContext';
import { getClanFeatures } from '@/lib/clanFeatures';
import { listBotChannels } from '@/lib/discord-broadcast';
import { configuredOrigin } from '@/lib/request-origin';
import GuideLink from '@/components/GuideLink';
import DiscordSettings from './DiscordSettings';

export const dynamic = 'force-dynamic';

export default async function AdminDiscordPage() {
  const clan = await requireClan();
  // Fetch the bot's channel list once, server-side, and pass it to every WebhookField so the channel
  // pickers don't each fire their own request. `botEnabled` is false with no bot token.
  const [{ enabled: botEnabled, channels }, features] = await Promise.all([
    listBotChannels(clan.id),
    getClanFeatures(clan.id),
  ]);
  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="display display-lg text-4xl sm:text-[44px] font-semibold leading-tight">Discord</h1>
        <p className="text-text-muted mt-2 text-[15px]">
          Let the bot set up your channels, then tell your members. Everything else is under More settings.
        </p>
        <p className="mt-2">
          <GuideLink href="/guide/discord">Discord guide</GuideLink>
        </p>
      </header>
      <DiscordSettings
        channels={channels}
        botEnabled={botEnabled}
        funMessagesOn={features.on('funMessages')}
        clanHallOn={features.on('clanHall')}
        siteUrl={configuredOrigin() ?? ''}
      />
    </div>
  );
}
