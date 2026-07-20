import Link from 'next/link';
import WebhookField from '@/components/WebhookField';
import DiscordBotSettings from '@/components/DiscordBotSettings';
import DiscordRoleSyncSettings from '@/components/DiscordRoleSyncSettings';
import DiscordAssignedRoles from '@/components/DiscordAssignedRoles';
import DiscordTeamChannelSettings from '@/components/DiscordTeamChannelSettings';
import AlwaysNotifyItems from '@/components/AlwaysNotifyItems';
import KillCountToggle from '@/components/KillCountToggle';
import LineListSetting from '@/components/LineListSetting';
import TierBandsSetting from '@/components/TierBandsSetting';
import BalanceRatesSetting from '@/components/BalanceRatesSetting';
import PlainSetting from '@/components/PlainSetting';
import RoleSetting from '@/components/RoleSetting';
import CollapsibleSection from '@/components/CollapsibleSection';
import FederationSettings from '@/components/FederationSettings';
import { listBotChannels } from '@/lib/discord-broadcast';

export const dynamic = 'force-dynamic';

export default async function AdminIntegrationsPage() {
  // Fetch the bot's channel list once, server-side, and pass it to every WebhookField so the
  // channel pickers don't each fire their own request. `botEnabled` is false with no bot token.
  const { enabled: botEnabled, channels } = await listBotChannels();
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Advanced settings</h1>
        <p className="text-text-muted text-sm">
          Every external service Anvil can talk to. Only the <span className="text-foreground/80">Essentials</span>{' '}
          below are needed to start — everything under <span className="text-foreground/80">Advanced</span> is optional.
        </p>
      </header>

      {/* New-user nudge back to the guided flow */}
      <Link
        href="/admin/setup"
        className="flex items-center justify-between gap-3 mb-8 px-4 py-3 rounded-xl border border-gold/30 bg-gold/5 hover:bg-gold/10 transition-colors"
      >
        <span className="text-sm">
          <span className="text-gold font-medium">New here?</span>{' '}
          <span className="text-text-muted">Run the guided setup instead of the raw settings below.</span>
        </span>
        <span className="text-gold text-sm shrink-0">Setup wizard →</span>
      </Link>

      {/* ---------- ESSENTIALS ---------- */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="font-semibold text-lg">Essentials</h2>
      </div>

      <section className="mb-4 border border-card-border rounded-xl p-5 bg-card-bg space-y-6">
        <PlainSetting
          settingKey="discord_invite_url"
          label="Discord invite URL"
          placeholder="https://discord.gg/your-invite"
          helpText="Shown as the Discord link in the top nav and on the home page. Hidden when blank."
        />
        <RoleSetting
          settingKey="discord_member_ping_role_id"
          label="Member ping role"
          helpText="Role pinged when a bingo event starts or finishes. Leave as “No role” for no ping."
        />
        <div className="border-t border-card-border pt-5">
          <p className="text-sm font-medium mb-1">Master announcements webhook</p>
          <p className="text-xs text-text-muted mb-3">
            The one channel Anvil posts everything to by default — event start / end, draft, submissions, weekly
            results, sign-up nudges. Set only this for a simple single-channel setup; the Advanced options below let
            you split specific posts into their own channels. Tip: paste several webhook URLs separated by spaces to
            rotate across them and dodge Discord rate limits.
          </p>
          <WebhookField channels={channels} botEnabled={botEnabled} />
        </div>
      </section>

      <p className="text-xs text-text-muted mb-8">
        The clan name and clan-roster sync settings live under <span className="text-foreground/80">Clan → Roster</span>.
      </p>

      {/* ---------- ADVANCED ---------- */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold/50 rounded-full" />
        <h2 className="font-semibold text-lg">Advanced <span className="text-text-muted font-normal text-sm">(optional)</span></h2>
      </div>

      <div className="space-y-3">
        <CollapsibleSection
          title="Discord bot"
          summary="Connect a bot so Anvil can create webhooks, sync roles + nicknames, and make team channels. Managed clans use the shared Anvil bot by default; self-hosters bring their own."
        >
          <p className="text-sm text-text-muted -mt-1">
            One bot powers webhook creation, role/nickname sync and team channels. Use the shared Anvil bot (when
            available) or bring your own — it needs <em>Manage Webhooks</em>, <em>Manage Roles</em>,{' '}
            <em>Manage Channels</em> and <em>Manage Nicknames</em>, with its role above the ones it manages.
          </p>
          <DiscordBotSettings />
        </CollapsibleSection>

        <CollapsibleSection
          title="Separate Discord channels"
          summary="Split bingo, weekly and sign-up posts into their own channels. Leave blank to use the master webhook. Each accepts multiple space-separated URLs (rotated to avoid rate limits)."
        >
          <div>
            <p className="text-sm font-medium mb-1">Bingo events channel</p>
            <p className="text-xs text-text-muted mb-3">
              Event start / end, draft, blackout, and drop submissions. Falls back to the main webhook when blank.
            </p>
            <WebhookField
              settingKey="discord_webhook_bingo"
              label="Bingo events channel"
              helpText="Event start/end, draft, blackout, and submission notifications post here."
              channels={channels}
              botEnabled={botEnabled}
            />
          </div>
          <div className="border-t border-card-border pt-4">
            <p className="text-sm font-medium mb-1">Weekly competitions channel</p>
            <p className="text-xs text-text-muted mb-3">
              Skill / Boss of the Week start announcements and results. Leave blank to disable weekly posts.
            </p>
            <WebhookField
              settingKey="discord_webhook_weekly"
              label="SOTW / BOTW channel"
              helpText="Weekly competition start and results (winner) notifications post here."
              channels={channels}
              botEnabled={botEnabled}
            />
          </div>
          <div className="border-t border-card-border pt-4">
            <p className="text-sm font-medium mb-1">Sign-up approvals channel</p>
            <p className="text-xs text-text-muted mb-3">
              When an admin approves a sign-up, a post here pings the member to pay their entry fee. Leave blank to
              disable.
            </p>
            <WebhookField
              settingKey="discord_webhook_signups"
              label="Sign-up approvals channel"
              helpText="Posts a fee-payment nudge (pinging the member) each time a sign-up is approved."
              channels={channels}
              botEnabled={botEnabled}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Plugin notifications"
          summary="Channels the Anvil plugin posts to directly — drops, deaths, CA tiers, PvP kills, clips."
        >
          <p className="text-sm text-text-muted -mt-1">
            Members fetch these on launch, so remapping a channel here takes effect on their next login — no plugin
            update needed. Leave blank to disable a notification.
          </p>
          <WebhookField
            settingKey="webhook_rare_drops"
            label="Rare drops channel"
            helpText="Valuable drops and pets are posted here by the plugin."
            channels={channels}
            botEnabled={botEnabled}
          />
          <WebhookField
            settingKey="webhook_deaths"
            label="Deaths channel"
            helpText="Death notifications (and the occasional surprise) are posted here by the plugin."
            channels={channels}
            botEnabled={botEnabled}
          />
          <WebhookField
            settingKey="webhook_combat_achievements"
            label="Combat achievements channel"
            helpText="CA tier clears (and high-tier task completions) are posted here by the plugin."
            channels={channels}
            botEnabled={botEnabled}
          />
          <WebhookField
            settingKey="webhook_pvp_kills"
            label="PvP kills channel"
            helpText="When 'Notify on PvP kill' is enabled in the plugin, a screenshot of the kill is posted here."
            channels={channels}
            botEnabled={botEnabled}
          />
          <WebhookField
            settingKey="webhook_clips"
            label="Clips channel"
            helpText="On-demand OBS replay clips (captured via the plugin's clip hotkey) are posted here when small enough for Discord."
            channels={channels}
            botEnabled={botEnabled}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Discord roles & nicknames"
          summary="Bot-driven: give linked members their rank + default roles, optionally set nicknames to RSN."
        >
          <p className="text-sm text-text-muted -mt-1">
            Needs the bot connected in the Discord bot section above. Turn on sync + nicknames below,
            then pick which roles the sync hands out.
          </p>
          <DiscordRoleSyncSettings />
          <div className="border-t border-card-border pt-5 mt-5">
            <p className="text-sm font-medium mb-1">Roles the sync assigns</p>
            <DiscordAssignedRoles />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Discord team channels"
          summary="Bot-driven per-team private voice + text channels, created from each event's Teams tab."
        >
          <p className="text-sm text-text-muted -mt-1">
            Once enabled, each event&apos;s Teams tab gets a panel to create a private voice + text channel per team,
            assign the captain role, and give every contestant their bingo + team role when the draft completes.
          </p>
          <DiscordTeamChannelSettings />
        </CollapsibleSection>

        <CollapsibleSection
          title="Notification lines"
          summary="Your clan's flavour text for plugin death/drop posts. Blank uses the built-in defaults."
        >
          <LineListSetting
            settingKey="fun_death_messages"
            label="Death one-liners (1 in 100 chance)"
            helpText="Replaces the whole death message on a rare roll. Use {name} for the player's RSN. One per line."
            placeholder={'One line per entry, e.g.\n{name} got sent to Lumbridge.\nPress F for {name}.'}
          />
          <LineListSetting
            settingKey="death_taunts"
            label="Death reaction lines"
            helpText='Appended to every death post when "Funny lines" is on in the plugin. One per line.'
            placeholder={'One line per entry, e.g.\nSit.\nL + ratio.\nSkill issue.'}
          />
          <LineListSetting
            settingKey="spoon_taunts"
            label="Lucky-drop (spoon) reaction lines"
            helpText='Appended to a rare / high-value drop post when "Funny lines" is on. One per line.'
            placeholder={'One line per entry, e.g.\nSPOONED.\nWay under rate.'}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Always-notify drops"
          summary="Prestige items that always post regardless of value, plus the kill-count toggle."
        >
          <AlwaysNotifyItems />
          <div className="border-t border-card-border pt-4">
            <KillCountToggle />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Fee collection"
          summary="How entry fees are confirmed. Fees are collected on each event's Sign-ups tab."
        >
          <PlainSetting
            settingKey="fee_confirmations_required"
            label="Confirmations required to settle a fee"
            placeholder="1"
            helpText="How many different staff must confirm a paid fee before it's marked settled. 1 = a single admin confirm (default). Set 2+ to require multiple sign-offs. The collector can never confirm their own."
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Difficulty tiers"
          summary="The difficulty bands points map onto, used by the Tier filter on the board and plugin clog."
        >
          <TierBandsSetting />
        </CollapsibleSection>

        <CollapsibleSection
          title="Board balance rates"
          summary="Kill times, XP rates and skill floors behind the Tiles tab's effort model — tune them to your clan."
        >
          <BalanceRatesSetting />
        </CollapsibleSection>

        <CollapsibleSection
          title="Federation"
          summary="Link up with other Anvil clans so members' drops can count across the clans they play in. All optional, off until you turn it on."
        >
          <p className="text-sm text-text-muted -mt-1">
            Federation connects your clan with other Anvil clans. A member who plays in several of them
            shows up (and can earn) across all of them, and the plugin lists the clans they belong to.
            Everything here is optional — leave it off to keep this clan fully private.
          </p>
          <FederationSettings />
        </CollapsibleSection>
      </div>
    </div>
  );
}
