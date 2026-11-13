import ClanLink from '@/components/ClanLink';

import ChatFeedPanel from '../ChatFeedPanel';
import { PluginGroups } from '../_parts/plugin';
import { PartJumps, SettingsBlock, SettingsGroup, SettingsPart, SettingsTitle } from '../_ui';

/**
 * In game: what the RuneLite plugin signs in with and what it shows in your chatbox. Was Plugin
 * connection and every part of the in-game chat feed, including its colours.
 */
export default function InGameSettingsPage() {
  return (
    <>
      <SettingsTitle title="In game">
        The Anvil RuneLite plugin: how it signs in, and what it shows in your chat. These used to be in RuneLite, and now they follow you
        to every computer.
      </SettingsTitle>
      <PartJumps
        parts={[
          { id: 'plugin', label: 'Plugin connection' },
          { id: 'chat-feed', label: 'Chat feed & login brief' },
          { id: 'chat-colours', label: 'Chat colours' },
          { id: 'event-chat', label: 'Event chat' },
        ]}
      />

      <SettingsPart
        id="plugin"
        title="Plugin connection"
        intro={
          <>
            What the plugin signs in with. You rarely need it: <b className="text-foreground">Sign in with Discord</b> in the panel sets it
            for you.{' '}
            <ClanLink href="/guide/plugin" className="text-gold hover:text-gold-light">
              Plugin setup guide →
            </ClanLink>
          </>
        }
      >
        <PluginGroups />
      </SettingsPart>

      <SettingsPart
        id="chat-feed"
        title="Chat feed & login brief"
        intro="Other players’ drops and achievements in your RuneLite chat, and the brief when you log in. The plugin’s own switch (Configuration → Anvil → General → Anvil messages in chat) turns it all on or off."
      >
        <SettingsGroup title="What shows in your chat" id="chat-feed-what">
          <SettingsBlock>
            <ChatFeedPanel part="feed" />
          </SettingsBlock>
        </SettingsGroup>
      </SettingsPart>

      <SettingsPart
        id="chat-colours"
        title="Chat colours"
        intro="How Anvil’s own lines look in your RuneLite chatbox. The [Anvil] tag colour is free; choosing your own colour for each kind of line is a Supporter perk."
      >
        <SettingsGroup title="Line and tag colours" id="chat-colours-picker">
          <SettingsBlock>
            <ChatFeedPanel part="colours" />
          </SettingsBlock>
        </SettingsGroup>
      </SettingsPart>

      <SettingsPart id="event-chat" title="Event chat in the chatbox" intro="Per board: whether its event chat also prints in your game chatbox.">
        <SettingsGroup title="Your boards" id="event-chat-boards">
          <SettingsBlock>
            <ChatFeedPanel part="boards" />
          </SettingsBlock>
        </SettingsGroup>
      </SettingsPart>
    </>
  );
}
