import DiscordSettings from '@/components/DiscordSettings';
import AlwaysNotifyItems from '@/components/AlwaysNotifyItems';
import LineListSetting from '@/components/LineListSetting';

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

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Plugin notifications</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Channels the Anvil plugin posts to directly when a clan member dies or receives a rare
          drop. Members fetch these on launch, so remapping a channel here takes effect on their next
          login — no plugin update needed. Leave blank to disable that notification.
        </p>
        <div className="space-y-4">
          <div className="border border-card-border rounded-xl p-5 bg-card-bg">
            <DiscordSettings
              settingKey="webhook_rare_drops"
              label="Rare drops channel"
              helpText="Valuable drops and pets are posted here by the plugin."
            />
          </div>
          <div className="border border-card-border rounded-xl p-5 bg-card-bg">
            <DiscordSettings
              settingKey="webhook_deaths"
              label="Deaths channel"
              helpText="Death notifications (and the occasional surprise) are posted here by the plugin."
            />
          </div>
          <div className="border border-card-border rounded-xl p-5 bg-card-bg">
            <DiscordSettings
              settingKey="webhook_combat_achievements"
              label="Combat achievements channel"
              helpText="CA tier clears (and high-tier task completions) are posted here by the plugin."
            />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Notification lines</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          The clan&apos;s flavour text for plugin posts. Leave a box blank to use the plugin&apos;s
          built-in defaults. Members pick up changes on their next login — no plugin update needed.
        </p>
        <div className="space-y-4">
          <div className="border border-card-border rounded-xl p-5 bg-card-bg">
            <LineListSetting
              settingKey="fun_death_messages"
              label="Death one-liners (1 in 100 chance)"
              helpText="Replaces the whole death message on a rare roll. Use {name} for the player's RSN. One per line."
              placeholder={'One line per entry, e.g.\n{name} got sent to Lumbridge.\nPress F for {name}.'}
            />
          </div>
          <div className="border border-card-border rounded-xl p-5 bg-card-bg">
            <LineListSetting
              settingKey="death_taunts"
              label="Death reaction lines"
              helpText='Appended to every death post when "Funny lines" is on in the plugin. One per line.'
              placeholder={'One line per entry, e.g.\nSit.\nL + ratio.\nSkill issue.'}
            />
          </div>
          <div className="border border-card-border rounded-xl p-5 bg-card-bg">
            <LineListSetting
              settingKey="spoon_taunts"
              label="Lucky-drop (spoon) reaction lines"
              helpText='Appended to a rare / high-value drop post when "Funny lines" is on. One per line.'
              placeholder={'One line per entry, e.g.\nSPOONED.\nWay under rate.'}
            />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Always-notify drops</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Prestige items that always post to the rare-drops channel regardless of value or rarity —
          untradeables and cheap-but-meaningful unlocks the value/rarity thresholds would miss. The
          plugin ships with a built-in list; add clan extras here without a plugin update.
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg">
          <AlwaysNotifyItems />
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
