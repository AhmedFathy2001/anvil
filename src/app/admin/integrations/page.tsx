import DiscordSettings from '@/components/DiscordSettings';
import DiscordRoleSyncSettings from '@/components/DiscordRoleSyncSettings';
import DiscordTeamChannelSettings from '@/components/DiscordTeamChannelSettings';
import AlwaysNotifyItems from '@/components/AlwaysNotifyItems';
import KillCountToggle from '@/components/KillCountToggle';
import LineListSetting from '@/components/LineListSetting';
import TierBandsSetting from '@/components/TierBandsSetting';
import PlainSetting from '@/components/PlainSetting';

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
          <h2 className="font-semibold">Clan identity</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Public-facing links shown across the site. Leave the invite blank to hide the Discord
          links entirely. The clan name itself lives under Clan → Roster.
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg space-y-6">
          <PlainSetting
            settingKey="discord_invite_url"
            label="Discord invite URL"
            placeholder="https://discord.gg/your-invite"
            helpText="Shown as the Discord link in the top nav and on the home page. Hidden when blank."
          />
          <PlainSetting
            settingKey="discord_member_ping_role_id"
            label="Member ping role ID"
            placeholder="e.g. 123456789012345678"
            helpText="Role pinged when a bingo event starts or finishes. Leave blank for no ping."
          />
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">General / clan updates webhook</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Non-event posts: clan-roster sync summaries (member joins / leaves / renames / count). Also
          the fallback for bingo posts when no dedicated bingo webhook is set below.
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg">
          <DiscordSettings />
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Bingo events webhook</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Bingo-specific posts: event start / end, draft complete, blackout, and drop submissions.
          Leave blank to fall back to the general webhook above.
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg">
          <DiscordSettings
            settingKey="discord_webhook_bingo"
            label="Bingo events channel"
            helpText="Event start/end, draft, blackout, and submission notifications post here."
          />
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Weekly competitions webhook</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          A separate channel for Skill / Boss of the Week posts: a start announcement when a
          competition goes live, and a results post (winner + final standings) when it ends. Leave
          blank to disable weekly posts.
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg">
          <DiscordSettings
            settingKey="discord_webhook_weekly"
            label="SOTW / BOTW channel"
            helpText="Weekly competition start and results (winner) notifications post here."
          />
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
          <div className="border border-card-border rounded-xl p-5 bg-card-bg">
            <DiscordSettings
              settingKey="webhook_pvp_kills"
              label="PvP kills channel"
              helpText="When 'Notify on PvP kill' is enabled in the plugin, a screenshot of the kill (the tick your target hits 0 HP) is posted here."
            />
          </div>
          <div className="border border-card-border rounded-xl p-5 bg-card-bg">
            <DiscordSettings
              settingKey="webhook_clips"
              label="Clips channel"
              helpText="On-demand OBS replay clips (captured via the plugin's clip hotkey) are posted here when small enough for Discord. Requires OBS + replay buffer set up by the member."
            />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Sign-up approvals webhook</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          When an admin approves a sign-up, a post here pings the member and nudges them to pay their
          entry fee — turning approvals into committed, paid seats. Leave blank to disable.
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg">
          <DiscordSettings
            settingKey="discord_webhook_signups"
            label="Sign-up approvals channel"
            helpText="Posts a fee-payment nudge (pinging the member) each time a sign-up is approved."
          />
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Discord roles &amp; nicknames</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Bot-driven sync (separate from the webhooks above): give linked members their rank + default
          Discord roles, and optionally set their nickname to their linked RSN(s). Needs a bot token in
          the environment plus the server ID. Rank→role-ID maps and default/guest role lists are still
          settings-driven (no picker UI yet).
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg">
          <DiscordRoleSyncSettings />
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Discord team channels</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Bot-driven per-team Discord setup. Once enabled, each event&apos;s Teams tab gets a panel to
          create a private voice + text channel per team (locked to that team&apos;s role), assign the
          captain role, and — when the draft completes — give every contestant their bingo + team role.
          Reuses the bot token and Server ID from the section above.
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg">
          <DiscordTeamChannelSettings />
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
        <div className="border border-card-border rounded-xl p-5 bg-card-bg mt-4">
          <KillCountToggle />
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          <h2 className="font-semibold">Difficulty tiers</h2>
        </div>
        <p className="text-sm text-text-muted mb-3">
          The difficulty bands that points map onto, used by the Tier filter on the board and in the
          plugin&apos;s collection-log tab. Rename, add, remove, or retune the point thresholds here —
          changes flow to the website immediately and to members on their next plugin login, with no
          plugin update needed.
        </p>
        <div className="border border-card-border rounded-xl p-5 bg-card-bg">
          <TierBandsSetting />
        </div>
      </section>

    </div>
  );
}
