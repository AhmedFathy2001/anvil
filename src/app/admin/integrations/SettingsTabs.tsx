'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
import WebhooksPanel from './WebhooksPanel';
import DiscordBotSettings from '@/components/DiscordBotSettings';
import DiscordLanguageSetting from '@/components/DiscordLanguageSetting';
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
// webhook field (which is why this isn't just a server component). The Webhooks tab is big enough to
// have its own tabs and its own search, so it lives in WebhooksPanel.
export default function SettingsTabs({ channels, botEnabled }: SettingsTabsProps) {
  // ?tab=fees opens straight on that group. The fee settings are the ones people are sent here FOR
  // (from the fees page, which is where the question "how many sign-offs?" actually comes up), and
  // landing on the bot tab with no idea which of six groups holds it is how a setting stays unfound.
  const params = useSearchParams();
  const requested = params.get('tab');
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === requested) ? (requested as TabId) : 'bot',
  );

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
          <div className="border-t border-card-border pt-5">
            <DiscordLanguageSetting />
          </div>
        </Card>
      )}

      {tab === 'webhooks' && <WebhooksPanel channels={channels} botEnabled={botEnabled} />}

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
            <div className="border-t border-card-border pt-4">
              <LineListSetting
                settingKey="guaranteed_drops"
                label="Drops that are guaranteed"
                helpText="Items the source hands over every time, so the post skips the lucky-drop line — nobody was spooned by a kit they were always getting. Most are already known from the wiki drop tables; this is for the ones it can't be asked about, like a raid chest's. One per line: an item name, or `item name | source, source` to limit it."
                placeholder={'One per line, e.g.\nMenaphite ornament kit | Tombs of Amascut\nAncient blood ornament kit'}
              />
            </div>
          </Card>
          <Card>
            <FieldHeader title="Moments feed">
              What the clan&apos;s <b>Lately</b> feed keeps when no competition and no board is running.
              Pets are always kept and never need a floor. During a competition or a board those
              decide instead — these only catch what would otherwise have been thrown away.
            </FieldHeader>
            <PlainSetting
              settingKey="moments_clan_min_loot_gp"
              label="Keep drops worth at least (gp)"
              placeholder="5000000"
              helpText="A drop the wiki calls genuinely rare is kept whatever it's worth, so this is the bar for everything else. Blank = 5,000,000. Lower it and the feed fills with ordinary hauls."
            />
            <div className="border-t border-card-border pt-4">
              <PlainSetting
                settingKey="moments_clan_min_ca_tier"
                label="Keep combat tasks from tier"
                placeholder="Master"
                helpText="Easy, Medium, Hard, Elite, Master or Grandmaster. Blank = Master. Type 'none' to keep combat tasks out of the feed entirely."
              />
            </div>
            <div className="border-t border-card-border pt-4">
              <ToggleSetting
                settingKey="moments_clan_deaths"
                label="Keep deaths too"
                helpText="Off by default. Inside an event a death is half the story; a clan-wide feed of everyone dying all week is a different and much worse thing to read."
              />
            </div>
            <div className="border-t border-card-border pt-4">
              <PlainSetting
                settingKey="moments_min_loot_gp"
                label="During a board, keep hauls worth at least (gp)"
                placeholder="1000000"
                helpText="A board's own floor, kept separate because a board is a week of content people chose — context worth keeping there is noise on an always-on feed. Blank = 1,000,000."
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
            helpText="How many different staff must confirm a paid fee before it's marked settled. 1 = a single admin confirm (default); the collector can never confirm their own. Set 2+ to require several sign-offs. Set 0 if you are the only person handling money — marking a fee paid then settles it outright, with no second signature to wait for."
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
          <Card>
            <FieldHeader title="House rules">
              Your clan&apos;s own rules, in your words — what the Discord bot lays out on{' '}
              <code className="text-gold">/bingo rules</code>. How each board scores (points, lockout, reveals,
              starting shot) is read off the event itself and never typed here, so this is only the prose:
              screenshots, plugin use, what counts as cheating.
            </FieldHeader>
            <PlainSetting
              settingKey="board_rules"
              label="House rules"
              multiline
              rows={12}
              markdownPreview
              placeholder={'Keep a screenshot of every drop.\nRun the plugin if you can.\nDon\'t cheat — it\'s for fun.'}
              helpText="Markdown works — **bold**, *italic*, `code`, - bullets, 1. numbers, > quotes, # headings, and links. The same dialect Discord uses, so one ruleset reads right in both places. Long rulesets are trimmed to fit an embed, so put the essentials first and link the rest below."
            />
            <div className="border-t border-card-border pt-4 mt-4">
              <PlainSetting
                settingKey="board_rules_url"
                label="Full rules link"
                placeholder="https://…"
                helpText="Where the complete ruleset lives. Shown under the house rules in Discord, and the fallback when they're too long to post in full."
              />
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
