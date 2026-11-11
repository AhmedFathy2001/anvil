'use client';

import { useState, type ReactNode } from 'react';

import FoldSection from '@/components/FoldSection';
import GuideLink from '@/components/GuideLink';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
import WebhooksPanel from './WebhooksPanel';
import DiscordFeedsPanel from './DiscordFeedsPanel';
import EventPostDefaultsPanel from './EventPostDefaultsPanel';
import DiscordQuickSetup, { FeedRulesHint } from './DiscordQuickSetup';
import { invalidateSettings } from '@/lib/settingsClient';
import DiscordBotSettings from '@/components/DiscordBotSettings';
import BotIdentitySettings from '@/components/BotIdentitySettings';
import DiscordLanguageSetting from '@/components/DiscordLanguageSetting';
import DiscordWidgetSettings from '@/components/DiscordWidgetSettings';
import DiscordRoleSyncSettings from '@/components/DiscordRoleSyncSettings';
import DiscordAssignedRoles from '@/components/DiscordAssignedRoles';
import DiscordTeamChannelSettings from '@/components/DiscordTeamChannelSettings';
import AlwaysNotifyItems from '@/components/AlwaysNotifyItems';
import KillCountToggle from '@/components/KillCountToggle';
import DropModeToggle from '@/components/DropModeToggle';
import ClanKindDefaults from '@/components/ClanKindDefaults';
import LineListSetting from '@/components/LineListSetting';
import LevelMilestonesSetting from '@/components/LevelMilestonesSetting';
import PlainSetting from '@/components/PlainSetting';
import RoleSetting from '@/components/RoleSetting';
import DiscordCommandToggles from '@/components/DiscordCommandToggles';
import RankRulesPanel from '@/components/RankRulesPanel';
import { creatorHidesDiscordSection } from '@/lib/creatorSpaces';

function Field({ title, children, aside }: { title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-medium">{title}</p>
        {children && <p className="text-sm text-text-muted mt-0.5">{children}</p>}
      </div>
      {aside}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[#2a221b]" />;
}


/**
 * Admin → Discord: everything Anvil does in the clan's server, on one page, each part folded to a
 * line. It replaces "Advanced settings", whose six tabs mixed Discord with fees and board rules —
 * those now live on Rules & scoring.
 */
export default function DiscordSettings({
  channels,
  botEnabled,
  funMessagesOn,
  clanHallOn,
  siteUrl,
  creator = false,
}: {
  channels: BroadcastChannel[];
  botEnabled: boolean;
  funMessagesOn: boolean;
  clanHallOn: boolean;
  siteUrl: string;
  /**
   * A creator space (lib/creatorSpaces): no members-vs-guests settings, no role or nickname sync,
   * commands or Clan Hall card, and no clan-only feeds.
   */
  creator?: boolean;
}) {
  // Bumped after quick setup rewrites the routing, so the by-hand fields remount and re-read it.
  const [panelKey, setPanelKey] = useState(0);

  return (
    <div className="space-y-3.5">
      {botEnabled ? (
        <p className="text-sm">
          <span className="text-gold">✓</span> The bot is in your server.
        </p>
      ) : (
        <section className="border border-card-border rounded-xl p-5 bg-card-bg space-y-4">
          <h2 className="display text-lg font-semibold">Connect your bot</h2>
          <p className="text-sm text-text-muted">
            Once your server is connected, Anvil sets up the channels and posts for you. Can&rsquo;t add a
            bot? See <strong className="text-foreground">Post without a bot</strong> at the bottom of this page.
          </p>
          <DiscordBotSettings />
        </section>
      )}

      {botEnabled && (
        <DiscordQuickSetup
          channels={channels}
          siteUrl={siteUrl}
          feedRulesHint={!creator}
          modes={!creator}
          onRoutingChanged={() => {
            invalidateSettings();
            setPanelKey((k) => k + 1);
          }}
        />
      )}

      <h2 className="display text-lg font-semibold pt-6">More settings</h2>

      <FoldSection
        id="discord-connection"
        sprite="discord"
        title="Connection"
        summary={botEnabled ? 'The bot is in your server. Its name, language and permissions.' : 'The bot’s name, language and invite link.'}
      >
        {botEnabled && (
          <>
            <p className="text-sm text-text-muted">
              {creator
                ? 'One bot connects your channels, checks Discord roles for your entry rules, and makes team channels.'
                : 'One bot connects your channels, syncs roles and nicknames, and makes team channels.'}{' '}
              Use the shared Anvil
              bot or bring your own; either way it has to be <strong className="text-foreground">invited to your server</strong>.
              The status below says whether it is, and the invite asks Discord for exactly the permissions it needs.
            </p>
            <DiscordBotSettings />
            <Divider />
          </>
        )}
        <BotIdentitySettings />
        <Divider />
        <DiscordLanguageSetting />
        <Divider />
        <PlainSetting
          settingKey="discord_invite_url"
          label="Discord invite link"
          placeholder="https://discord.gg/your-invite"
          helpText={`Shown as the Discord link in the top menu and on your ${creator ? 'space' : "clan's"} home page. Hidden when blank.`}
        />
      </FoldSection>

      <FoldSection
        id="discord-feeds"
        sprite="clue"
        title="What goes where"
        summary="Every kind of post: on or off, and which channel it lands in."
        defaultOpen
      >
        <DiscordFeedsPanel
          key={panelKey}
          creator={creator}
          filters={{
            milestones: <ClanKindDefaults />,
            drops: (
              <>
                <PlainSetting
                  settingKey="drop_default_value"
                  label="Default minimum drop value (gp)"
                  placeholder="1000000"
                  helpText="The default for your members: drops worth at least this post. Each member can set their own number in /settings; until they do, they follow this one. Blank = Anvil's default, 1,000,000 (and never below it)."
                />
                <PlainSetting
                  settingKey="drop_default_rarity"
                  label="Default: post drops rarer than 1 in…"
                  placeholder="1000"
                  helpText="The default for your members, on rarity alone. Members can override it for themselves. Blank = Anvil's default, 1 in 1,000 (never looser)."
                />
                <DropModeToggle />
                <PlainSetting
                  settingKey="drop_rarity_floor"
                  label="Hard floor: never post drops more common than 1 in… (optional)"
                  placeholder="none"
                  helpText="Optional. A limit for your clan's own channels that a member's own number can't loosen, to keep spam out. Blank = no hard floor; members can go as loose as 1 in 1,000."
                />
                <Field title="Always post these items">Items that post whatever their value or rarity. Starts with Anvil’s defaults; add or remove any.</Field>
                <AlwaysNotifyItems />
                <KillCountToggle />
                <LineListSetting
                  settingKey="guaranteed_drops"
                  label="Drops that are guaranteed"
                  helpText="Items a source always hands over, so the post skips the lucky-drop line. Most are already known from the wiki; add the rest here. One per line: an item, or `item | source, source`."
                  placeholder={'One per line, e.g.\nMenaphite ornament kit | Tombs of Amascut'}
                />
                {funMessagesOn && (
                  <LineListSetting
                    settingKey="spoon_taunts"
                    label="Lucky-drop reaction lines"
                    helpText="Added to a rare or valuable drop post when “Funny lines” is on. One per line."
                    placeholder={'One per line, e.g.\nSPOONED.'}
                  />
                )}
              </>
            ),
            levels: (
              <>
                <Field title="Level milestones">
                  Which level-ups and XP milestones post. Members can turn their own posts down, never up.
                </Field>
                <LevelMilestonesSetting />
              </>
            ),
            ...(funMessagesOn
              ? {
                  deaths: (
                    <>
                      <LineListSetting
                        settingKey="fun_death_messages"
                        label="Death one-liners (1 in 100 chance)"
                        helpText="Replaces the whole death message on a rare roll. Use {name} for the player. One per line."
                        placeholder={'One per line, e.g.\n{name} got sent to Lumbridge.'}
                      />
                      <LineListSetting
                        settingKey="death_taunts"
                        label="Death reaction lines"
                        helpText="Added to every death post when a member has “Funny lines” on in the plugin. One per line."
                        placeholder={'One per line, e.g.\nSit.\nSkill issue.'}
                      />
                    </>
                  ),
                }
              : {}),
          }}
        />
        {!creator && <FeedRulesHint />}
      </FoldSection>

      <FoldSection
        id="discord-event-posts"
        sprite="casket"
        title="Event posts"
        summary="Which event posts go out by default, who they ping, and the player role and cleanup timing."
      >
        <EventPostDefaultsPanel />
      </FoldSection>

      {/* A creator space has no roster to sync roles or nicknames from: it keeps the ping role only. */}
      <FoldSection
        id="discord-roles"
        sprite="bandos"
        title={creator ? 'Ping role' : 'Roles & nicknames'}
        summary={creator ? 'The role pinged when one of your events starts or finishes.' : 'Who gets pinged, and keeping Discord roles and names in step with the clan.'}
      >
        <div id="discord-ping-role" className="scroll-mt-24">
          <RoleSetting
            settingKey="discord_member_ping_role_id"
            label="Ping this role for big news"
            helpText="Pinged when an event starts or finishes. “No role” means no ping."
          />
        </div>
        {!creator && (
          <>
            <Divider />
            <div id="discord-role-sync" className="scroll-mt-24 space-y-6">
              <Field title="Match Discord to the clan" aside={<GuideLink href="/guide/discord#roles">How role sync works</GuideLink>}>
                Give linked members their rank and default roles, and optionally set nicknames to their in-game name.
              </Field>
              <DiscordRoleSyncSettings />
              <div>
                <p className="font-medium mb-1">Roles the sync gives out</p>
                <DiscordAssignedRoles />
              </div>
            </div>
            <Divider />
            <div id="discord-rank-rules" className="scroll-mt-24 space-y-6">
              <Field title="Rank rules">
                Give Discord roles from in-game rank, adding up as people climb. Runs with the role sync above, so keep that on.
              </Field>
              <RankRulesPanel />
            </div>
          </>
        )}
      </FoldSection>

      <FoldSection id="discord-team-channels" sprite="emblem" title="Team channels" summary="A private channel for each team during an event.">
        <p className="text-sm text-text-muted">
          Private voice and text channels per team, made from each event’s Teams page and removed when it ends.
        </p>
        <DiscordTeamChannelSettings />
      </FoldSection>

      {/* Not in a creator space (lib/creatorSpaces CREATOR_HIDDEN_DISCORD_SECTIONS): no public clan page, no clan commands. */}
      {clanHallOn && !(creator && creatorHidesDiscordSection('discord-clan-hall')) && (
        <FoldSection id="discord-clan-hall" sprite="petRock" title="Clan Hall card" summary="Shows who’s online in your Discord on your public clan page.">
          <DiscordWidgetSettings />
        </FoldSection>
      )}

      {!(creator && creatorHidesDiscordSection('discord-commands')) && (
        <FoldSection id="discord-commands" sprite="hammer" title="Commands" summary="Slash commands work by themselves. Switch off any your server doesn’t need.">
          <DiscordCommandToggles />
        </FoldSection>
      )}

      {/* Last on purpose: pasting channel links by hand is the fallback for a server that can't take
          the bot, not a step anyone should start with. */}
      <FoldSection
        id="discord-by-hand"
        sprite="clue"
        title="Post without a bot"
        summary={
          creator
            ? 'Can’t add the bot? Paste a channel’s link from Discord instead.'
            : 'Can’t add the bot? Paste a channel’s link from Discord instead. Also guests’ posts and the Leagues icon.'
        }
      >
        <WebhooksPanel key={panelKey} channels={channels} botEnabled={botEnabled} creator={creator} />
      </FoldSection>
    </div>
  );
}
