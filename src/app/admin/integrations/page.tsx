import DiscordSettings from '@/components/DiscordSettings';

export const dynamic = 'force-dynamic';

export default function AdminIntegrationsPage() {
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Integrations</h1>
        <p className="text-text-muted text-sm">
          External services Anvil pushes to. The clan name and clan-roster sync settings live under
          Clan → Roster.
        </p>
      </header>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Discord webhook</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Webhook URL receives event start/end notifications, weekly competition pings, and clan-sync
          summaries (joins / leaves / renames).
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg">
          <DiscordSettings />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Plugin tokens</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Long-lived tokens are issued automatically when an admin completes the plugin link flow.
          Existing tokens can be revoked from the user&apos;s plugin client.
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg text-sm text-text-muted">
          Manage tokens via the plugin link flow on your{' '}
          <a href="/profile" className="text-gold hover:underline">
            profile
          </a>
          . There&apos;s no per-token UI yet — open an issue if you need bulk revocation.
        </div>
      </section>
    </div>
  );
}
