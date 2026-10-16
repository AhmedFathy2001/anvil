'use client';

import type { ReactNode } from 'react';

import FoldSection from '@/components/FoldSection';
import GuideLink from '@/components/GuideLink';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
import WebhooksPanel from './WebhooksPanel';
import DiscordBotSettings from '@/components/DiscordBotSettings';
import BotIdentitySettings from '@/components/BotIdentitySettings';
import DiscordLanguageSetting from '@/components/DiscordLanguageSetting';
import DiscordWidgetSettings from '@/components/DiscordWidgetSettings';
import DiscordRoleSyncSettings from '@/components/DiscordRoleSyncSettings';
import DiscordAssignedRoles from '@/components/DiscordAssignedRoles';
import DiscordTeamChannelSettings from '@/components/DiscordTeamChannelSettings';
import AlwaysNotifyItems from '@/components/AlwaysNotifyItems';
import KillCountToggle from '@/components/KillCountToggle';
import LineListSetting from '@/components/LineListSetting';
import LevelMilestonesSetting from '@/components/LevelMilestonesSetting';
import PlainSetting from '@/components/PlainSetting';
import RoleSetting from '@/components/RoleSetting';

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

const COMMANDS: [string, string][] = [
  ['/bingo', 'the running board, leaderboard, rules, your team and what’s next'],
  ['/sotw, /botw', 'this week’s standings'],
  ['/stats', 'profiles, levels, collection log, PBs and luck'],
  ['/eff', 'the efficiency leaderboard'],
  ['/coffer', 'the clan’s balance (treasurers can add and remove)'],
  ['/guide', 'any setup guide, step by step'],
];

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
}: {
  channels: BroadcastChannel[];
  botEnabled: boolean;
  funMessagesOn: boolean;
  clanHallOn: boolean;
}) {
  return (
    <div className="space-y-3.5">
      <FoldSection
        sprite="teleport"
        title="Connection"
        summary={botEnabled ? 'The bot is in your server. Its name, language and permissions.' : 'Add the bot to your server first. Most of this page needs it.'}
        defaultOpen={!botEnabled}
      >
        <p className="text-sm text-text-muted">
          One bot creates channels’ webhooks, syncs roles and nicknames, and makes team channels. Use the shared Anvil bot
          or bring your own; either way it has to be <strong className="text-foreground">invited to your server</strong>. The
          status below says whether it is, and the invite asks Discord for exactly the permissions it needs.
        </p>
        <DiscordBotSettings />
        <Divider />
        <BotIdentitySettings />
        <Divider />
        <DiscordLanguageSetting />
        <Divider />
        <PlainSetting
          settingKey="discord_invite_url"
          label="Discord invite link"
          placeholder="https://discord.gg/your-invite"
          helpText="Shown as the Discord link in the top menu and on your clan's home page. Hidden when blank."
        />
      </FoldSection>

      <FoldSection
        sprite="clue"
        title="Where posts go"
        summary="Clan news and player highlights, and which channel each kind of post lands in."
        defaultOpen={botEnabled}
      >
        <WebhooksPanel channels={channels} botEnabled={botEnabled} />
      </FoldSection>

      <FoldSection
        sprite="casket"
        title="What’s worth posting"
        summary="Which drops, levels and achievements are big enough to post."
      >
        <Field title="Level milestones">
          Which level-ups and XP milestones post. Members can turn their own posts down, never up.
        </Field>
        <LevelMilestonesSetting />
        <Divider />
        <PlainSetting
          settingKey="drop_rarity_floor"
          label="Post drops rarer than 1 in…"
          placeholder="10000"
          helpText="Only drops rarer than this post on rarity alone. Members' plugins can be stricter, never looser. Blank = 10,000; a lower number means a lot more posts."
        />
        <Field title="Always post these items">Prestige items that post whatever their value.</Field>
        <AlwaysNotifyItems />
        <KillCountToggle />
        <LineListSetting
          settingKey="guaranteed_drops"
          label="Drops that are guaranteed"
          helpText="Items a source always hands over, so the post skips the lucky-drop line. Most are already known from the wiki; add the rest here. One per line: an item, or `item | source, source`."
          placeholder={'One per line, e.g.\nMenaphite ornament kit | Tombs of Amascut'}
        />
        {funMessagesOn && (
          <>
            <Divider />
            <Field title="Fun lines">Your clan&apos;s own lines for deaths and lucky drops. Blank uses ours.</Field>
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
            <LineListSetting
              settingKey="spoon_taunts"
              label="Lucky-drop reaction lines"
              helpText="Added to a rare or valuable drop post when “Funny lines” is on. One per line."
              placeholder={'One per line, e.g.\nSPOONED.'}
            />
          </>
        )}
      </FoldSection>

      <FoldSection sprite="bandos" title="Roles & nicknames" summary="Who gets pinged, and keeping Discord roles and names in step with the clan.">
        <RoleSetting
          settingKey="discord_member_ping_role_id"
          label="Ping this role for big news"
          helpText="Pinged when an event starts or finishes. “No role” means no ping."
        />
        <Divider />
        <Field title="Match Discord to the clan" aside={<GuideLink href="/guide/discord#roles">How role sync works</GuideLink>}>
          Give linked members their rank and default roles, and optionally set nicknames to their in-game name.
        </Field>
        <DiscordRoleSyncSettings />
        <div>
          <p className="font-medium mb-1">Roles the sync gives out</p>
          <DiscordAssignedRoles />
        </div>
      </FoldSection>

      <FoldSection sprite="emblem" title="Team channels" summary="A private channel for each team during an event.">
        <p className="text-sm text-text-muted">
          Private voice and text channels per team, made from each event’s Teams page and removed when it ends.
        </p>
        <DiscordTeamChannelSettings />
      </FoldSection>

      {clanHallOn && (
        <FoldSection sprite="petRock" title="Clan Hall card" summary="Shows who’s online in your Discord on your public clan page.">
          <DiscordWidgetSettings />
        </FoldSection>
      )}

      <FoldSection sprite="hammer" title="Commands" summary="Slash commands work by themselves. Nothing to set up.">
        <ul className="space-y-2">
          {COMMANDS.map(([cmd, what]) => (
            <li key={cmd} className="flex gap-3">
              <code className="text-gold shrink-0 w-28">{cmd}</code>
              <span className="text-sm text-text-muted">{what}</span>
            </li>
          ))}
        </ul>
      </FoldSection>
    </div>
  );
}
