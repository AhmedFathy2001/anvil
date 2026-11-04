import ClanLink from '@/components/ClanLink';

import { verifyUser } from '@/lib/auth';
import { supporterForUser } from '@/lib/supporter';
import { canCustomColors, canShapeBrief, hasChatStar } from '@/lib/chatLook';
import ChatFeedPanel from '../ChatFeedPanel';
import { SettingsBlock, SettingsGroup, SettingsRow, SettingsTitle, Pill } from '../_ui';

/**
 * In-game chat: what the plugin shows in your RuneLite chatbox. Three of its options are Supporter
 * perks, so the page says up front which ones you have and which tier unlocks the rest, instead of
 * leaving people to discover a greyed-out control.
 */
export default async function ChatSettingsPage() {
  const session = (await verifyUser())!;
  const supporter = await supporterForUser(session.userId);
  const tier = supporter?.tier.id ?? null;
  const perks = [
    { label: 'Your own chat colours', tier: 'Supporter', on: canCustomColors(tier) },
    { label: 'Choose what your login brief covers', tier: 'Champion', on: canShapeBrief(tier) },
    { label: 'A star by your name in other players’ feeds', tier: 'Patron', on: hasChatStar(tier) },
  ];

  return (
    <>
      <SettingsTitle title="In-game chat">
        What the Anvil plugin shows in your RuneLite chat: other players&rsquo; drops and achievements, and the brief when you log in.
        The plugin&rsquo;s own switch (Configuration → Anvil → Chat feed) turns it all on or off.
      </SettingsTitle>

      <SettingsGroup
        title="Supporter perks"
        note={
          perks.some((p) => !p.on) ? (
            <ClanLink href="/settings/supporter" className="text-gold hover:text-gold-light">
              See Supporter tiers →
            </ClanLink>
          ) : null
        }
      >
        {perks.map((p) => (
          <SettingsRow key={p.label} label={p.label} locked={p.on ? null : p.tier}>
            {p.on ? <Pill tone="green">yours</Pill> : null}
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup title="Chat feed & login brief">
        <SettingsBlock>
          <ChatFeedPanel />
        </SettingsBlock>
      </SettingsGroup>
    </>
  );
}
