import { ANVIL_SUPPORTERS_BACKFILL_KEY, anvilBotStatus, loadAnvilDiscordConfig } from '@/lib/anvilDiscord';
import { hasPlatformRole } from '@/lib/clanRoles';
import { requirePlatformPage } from '@/lib/platformAccess';
import { getPlatformSetting, isPreview } from '@/lib/platformSettings';
import { ANVIL_RECRUITMENT_WEBHOOK_KEY } from '@/lib/clanBoosts';
import AnvilDiscordSettings from './AnvilDiscordSettings';
import PostPreviews from './PostPreviews';

export const dynamic = 'force-dynamic';

/**
 * The Anvil Discord: the owner's own server. A "new supporters" channel, and supporter roles the
 * platform bot hands out to anyone who signed in with Discord and is in the server (lib/anvilDiscord).
 */
export default async function StaffDiscordPage() {
  const actor = await requirePlatformPage('support');
  const [cfg, status, backfilledAt, recruitHook] = await Promise.all([
    loadAnvilDiscordConfig(),
    anvilBotStatus(),
    getPlatformSetting(ANVIL_SUPPORTERS_BACKFILL_KEY),
    getPlatformSetting(ANVIL_RECRUITMENT_WEBHOOK_KEY),
  ]);
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Anvil Discord
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Your own server: announce new supporters, and give each tier its role to anyone who signed in to Anvil with
        Discord and is in the server. Roles follow every change straight away, and an hourly sweep catches terms that
        ran out and people who join later.
      </p>
      {isPreview() && (
        <div className="mb-6 rounded-xl border border-gold/35 bg-gold/[0.05] px-4 py-3 text-sm text-text-muted">
          This is beta: settings here are beta&rsquo;s own, and beta never posts or changes roles. Set this up on
          production.
        </div>
      )}
      <AnvilDiscordSettings
        canWrite={!!actor && hasPlatformRole(actor.role, 'staff')}
        initial={{ guildId: cfg.guildId ?? '', webhookSet: !!cfg.webhook, rolesEnabled: cfg.rolesEnabled, backfilledAt, recruitWebhookSet: !!recruitHook }}
        initialStatus={status}
      />
      {/* Works on beta too: it only posts to a channel someone pastes in, never the Anvil Discord. */}
      {!!actor && hasPlatformRole(actor.role, 'staff') && (
        <div className="mt-6">
          <PostPreviews />
        </div>
      )}
    </div>
  );
}
