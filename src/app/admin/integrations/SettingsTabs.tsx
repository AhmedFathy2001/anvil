'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
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
import ToggleSetting from '@/components/ToggleSetting';
import RoleSetting from '@/components/RoleSetting';
import FederationSettings from '@/components/FederationSettings';

interface SettingsTabsProps {
  channels: BroadcastChannel[];
  botEnabled: boolean;
}

const TABS = [
  { id: 'bot', label: 'Discord bot' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'roles', label: 'Roles & channels' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'fees', label: 'Fees' },
  { id: 'board', label: 'Board' },
  { id: 'federation', label: 'Federation' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Card({ children }: { children: ReactNode }) {
  return <section className="border border-card-border rounded-xl p-5 bg-card-bg space-y-6">{children}</section>;
}

function FieldHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium mb-1">{title}</p>
      {children && <p className="text-xs text-text-muted">{children}</p>}
    </div>
  );
}

// Advanced settings, grouped into tabs so it's walkable instead of one long scroll. Client so the
// tab state is interactive; `channels`/`botEnabled` are fetched server-side and passed to every
// WebhookField (which is why this isn't just a server component).
export default function SettingsTabs({ channels, botEnabled }: SettingsTabsProps) {
  const [tab, setTab] = useState<TabId>('bot');

  return (
    <div>
      <div
        className="flex gap-1 overflow-x-auto border-b border-card-border mb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-gold text-gold' : 'border-transparent text-text-muted hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bot' && (
        <Card>
          <div>
            <p className="text-sm text-text-muted mb-3">
              One bot powers webhook creation, role/nickname sync and team channels. Use the shared Anvil bot
              (when available) or bring your own — it needs <em>Manage Webhooks</em>, <em>Manage Roles</em>,{' '}
              <em>Manage Channels</em> and <em>Manage Nicknames</em>, with its role above the ones it manages.
              Whichever bot you use, it has to be <strong>invited to your server</strong> — the status below says
              whether it is, and the invite link asks Discord for exactly those permissions.
            </p>
            <DiscordBotSettings />
          </div>
          <div className="border-t border-card-border pt-5">
            <PlainSetting
              settingKey="discord_invite_url"
              label="Discord invite URL"
              placeholder="https://discord.gg/your-invite"
              helpText="Shown as the Discord link in the top nav and on the home page. Hidden when blank."
            />
          </div>
        </Card>
      )}

      {tab === 'webhooks' && (
        <div className="space-y-4">
          <Card>
            <FieldHeader title="Master announcements webhook">
              The one channel Anvil posts everything to by default — event start / end, draft, submissions, weekly
              results, sign-up nudges. Set only this for a simple single-channel setup, or split specific posts into
              their own channels below.
            </FieldHeader>
            <WebhookField channels={channels} botEnabled={botEnabled} />
          </Card>

          <Card>
            <FieldHeader title="Separate channels">
              Split bingo, weekly and sign-up posts into their own channels. Leave blank to fall back to the master
              webhook.
            </FieldHeader>
            <WebhookField
              settingKey="discord_webhook_bingo"
              label="Bingo events channel"
              helpText="Event start/end, draft, blackout, and submission notifications post here."
              channels={channels}
              botEnabled={botEnabled}
            />
            <div className="border-t border-card-border pt-4">
              <WebhookField
                settingKey="discord_webhook_weekly"
                label="SOTW / BOTW channel"
                helpText="Weekly competition start and results (winner) notifications post here."
                channels={channels}
                botEnabled={botEnabled}
              />
            </div>
            <div className="border-t border-card-border pt-4">
              <WebhookField
                settingKey="discord_webhook_signups"
                label="Sign-up approvals channel"
                helpText="Posts a fee-payment nudge (pinging the member) each time a sign-up is approved."
                channels={channels}
                botEnabled={botEnabled}
              />
            </div>
          </Card>

          <Card>
            <FieldHeader title="Plugin notifications">
              Channels the Anvil plugin posts to directly — drops, deaths, CA tiers, PvP kills, clips. Members fetch
              these on launch, so remapping takes effect on their next login. Leave blank to disable one.
            </FieldHeader>
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
          </Card>
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-4">
          <Card>
            <RoleSetting
              settingKey="discord_member_ping_role_id"
              label="Member ping role"
              helpText="Role pinged when a bingo event starts or finishes. Leave as “No role” for no ping."
            />
          </Card>
          <Card>
            <FieldHeader title="Roles & nicknames">
              Give linked members their rank + default roles, optionally set nicknames to their RSN. Needs the bot
              connected in the Discord bot tab.
            </FieldHeader>
            <DiscordRoleSyncSettings />
            <div className="border-t border-card-border pt-5 mt-5">
              <p className="text-sm font-medium mb-1">Roles the sync assigns</p>
              <DiscordAssignedRoles />
            </div>
          </Card>
          <Card>
            <FieldHeader title="Team channels">
              Per-team private voice + text channels, created from each event&apos;s Teams tab. Needs the bot
              connected in the Discord bot tab.
            </FieldHeader>
            <DiscordTeamChannelSettings />
          </Card>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="space-y-4">
          <Card>
            <FieldHeader title="Notification lines">
              Your clan&apos;s flavour text for plugin death / drop posts. Blank uses the built-in defaults.
            </FieldHeader>
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
          </Card>
          <Card>
            <FieldHeader title="Always-notify drops">
              Prestige items that always post regardless of value, plus the kill-count toggle.
            </FieldHeader>
            <AlwaysNotifyItems />
            <div className="border-t border-card-border pt-4">
              <KillCountToggle />
            </div>
            <div className="border-t border-card-border pt-4">
              <PlainSetting
                settingKey="drop_rarity_floor"
                label="Rarity floor for drop posts (1 in N)"
                placeholder="10000"
                helpText="Only drops rarer than 1-in-this post on rarity alone. Applies to every member: their plugin can be stricter, never looser. Blank = 10,000 (a lower number means more posts — 1/2000 fills the channel with herb rolls)."
              />
            </div>
          </Card>
        </div>
      )}

      {tab === 'fees' && (
        <Card>
          <PlainSetting
            settingKey="fee_confirmations_required"
            label="Confirmations required to settle a fee"
            placeholder="1"
            helpText="How many different staff must confirm a paid fee before it's marked settled. 1 = a single admin confirm (default). Set 2+ to require multiple sign-offs. The collector can never confirm their own."
          />
          <div className="border-t border-card-border pt-4 mt-4">
            <ToggleSetting
              settingKey="fee_autoconfirm_on_event_end"
              label="Settle collected fees when an event ends"
              helpText="When an event ends, mark its already-collected fees as settled without waiting for a second admin. Off by default: it skips the sign-off that stops one person both taking the money and marking it received. Fees nobody has collected are never touched — this only closes out ones a mod already said they had."
            />
          </div>
        </Card>
      )}

      {tab === 'board' && (
        <div className="space-y-4">
          <Card>
            <FieldHeader title="Difficulty tiers">
              The difficulty bands points map onto, used by the Tier filter on the board and plugin clog.
            </FieldHeader>
            <TierBandsSetting />
          </Card>
          <Card>
            <FieldHeader title="Board balance rates">
              Kill times, XP rates and skill floors behind the Tiles tab&apos;s effort model — tune them to your clan.
            </FieldHeader>
            <BalanceRatesSetting />
          </Card>
        </div>
      )}

      {tab === 'federation' && (
        <Card>
          <div>
            <p className="text-sm text-text-muted mb-3">
              Federation connects your clan with other Anvil clans. A member who plays in several of them shows up
              (and can earn) across all of them, and the plugin lists the clans they belong to. Everything here is
              optional — leave it off to keep this clan fully private.
            </p>
            <FederationSettings />
          </div>
        </Card>
      )}
    </div>
  );
}
