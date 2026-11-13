import { desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import { parseSupporterStyle, supporterForUser, tierForStyle, tryTier } from '@/lib/supporter';
import { accountMediaRows, canAnimateProfileMedia, displayCaseSlots, profileMediaRow, shownProfileMedia } from '@/lib/profileMedia';
import { readDisplayCase } from '@/lib/displayCase';
import { getChatFeedPrefs } from '@/lib/chatFeed';
import ProfileLookEditor from '@/components/ProfileLookEditor';
import CharacterLookOverrides from '@/components/CharacterLookOverrides';
import DisplayCaseEditor from '@/components/DisplayCaseEditor';
import SupporterNameLooks from '@/components/SupporterNameLooks';
import ChatFeedPanel from '../ChatFeedPanel';
import { LookPreview, LookPreviewProvider } from '../_preview';
import { SettingsBlock, SettingsGroup } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

/**
 * Profile & look: everything that dresses you, with a live preview. Every Supporter perk here can be
 * picked and saved by anyone (try before you subscribe); the controls show the OWNER their choice,
 * motion included. What everyone else sees is gated on every read by the tier in force:
 * shownProfileMedia / mediaForCharacter (motion), displayCaseFor (slots), effectiveSupporterStyle and
 * the flair reads in lib/supporter (name colours), effectiveLook (chat line colours). A lapse falls
 * back to the free look and keeps every choice.
 */
export async function LookGroups() {
  const session = await settingsSession();
  const [user, supporter, row, chatPrefs] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    supporterForUser(session.userId),
    profileMediaRow(session.userId).catch(() => null),
    getChatFeedPrefs(session.userId).catch(() => null),
  ]);
  const held = supporter?.tier.id ?? null;
  const [pins, characters] = await Promise.all([
    session.playerId ? readDisplayCase(session.userId, session.playerId).catch(() => []) : Promise.resolve([]),
    session.playerId
      ? db
          .select({ accountId: accounts.id, rsn: accounts.rsn, style: accounts.supporterStyle })
          .from(accounts)
          .where(eq(accounts.playerId, session.playerId))
          .orderBy(desc(accounts.isPrimary), accounts.rsn)
      : Promise.resolve([]),
  ]);
  // The OWNER's own view: their pictures as uploaded (moving), whatever their tier. Public pages
  // gate them separately (the still frame until Champion).
  const media = shownProfileMedia(row, 'patron');
  const overrides = session.playerId
    ? await accountMediaRows(characters.map((c) => c.accountId), session.playerId).catch(() => new Map())
    : new Map();
  const characterLooks = characters.map((c) => ({ accountId: c.accountId, rsn: c.rsn, own: shownProfileMedia(overrides.get(c.accountId), 'patron') }));
  const slots = displayCaseSlots(held);
  const canAnimate = canAnimateProfileMedia(held);

  // Name colours: the stored choice, raw (it may be a tier they're trying), and the tier it opens at.
  const accountStyle = parseSupporterStyle(user?.supporterStyle ?? null);
  const nameRows = characters.map((c) => ({ accountId: c.accountId, rsn: c.rsn, style: parseSupporterStyle(c.style) }));
  const tried = [accountStyle, ...nameRows.map((r) => r.style)].reduce<'supporter' | 'champion' | 'patron'>((m, st) => {
    const t = tierForStyle(st);
    return tryTier(m, t) ?? m;
  }, held ?? 'champion');
  const startTier = tryTier(held, tried) ?? 'champion';
  const name = user?.displayName ?? 'You';
  const main = nameRows[0] ?? null;

  return (
    <LookPreviewProvider
      initial={{
        media,
        flair: { tier: startTier, style: accountStyle },
        chatFlair: { tier: startTier, style: main?.style ?? accountStyle },
        chat: chatPrefs ? { palette: chatPrefs.palette, colors: chatPrefs.colors, tagColor: chatPrefs.tagColor } : null,
      }}
    >
      <div className="mb-7 lg:sticky lg:top-20 lg:z-20">
        <LookPreview name={name} rsn={main?.rsn ?? null} held={held} />
      </div>

      <SettingsGroup
        title="Avatar & banner"
        id="avatar-banner"
        note="Shown on your card, your person page and every character of yours, on the site and in the plugin. GIFs and animated WebP move for everyone once you're a Champion."
      >
        <SettingsBlock>
          <ProfileLookEditor initial={media} canUpload canAnimate={canAnimate} held={held} name={name} />
        </SettingsBlock>
      </SettingsGroup>

      {characterLooks.length > 0 && (
        <SettingsGroup
          title="Per character"
          id="look-per-character"
          note="Give a character its own banner or avatar (or both). It replaces your default on that character’s pages and plugin card only."
        >
          <SettingsBlock>
            <CharacterLookOverrides characters={characterLooks} fallback={media} canUpload canAnimate={canAnimate} held={held} />
          </SettingsBlock>
        </SettingsGroup>
      )}

      <SettingsGroup
        id="display-case"
        title="Display case"
        note="Your best drops, kill counts and times pinned to your profile. Supporter shows 4, Champion 8, Patron 12. Pins from characters you don’t share stay private."
      >
        <SettingsBlock>
          <DisplayCaseEditor initialPins={pins} slots={slots} held={held} />
        </SettingsBlock>
      </SettingsGroup>

      <SettingsGroup
        id="name-colours"
        title="Name colours"
        note="Your name on boards, rosters, Discord posts and other players’ game chat. Supporter is gold, Champion picks a gradient or one colour, Patron mixes their own."
      >
        <SettingsBlock>
          <SupporterNameLooks tier={startTier} held={held} name={name} accountStyle={accountStyle} characters={nameRows} />
        </SettingsBlock>
      </SettingsGroup>

      <SettingsGroup
        id="chat-colours"
        title="Chat colours"
        note="How Anvil’s lines look in your own RuneLite chatbox. Your own line colours are a Supporter perk; the [Anvil] tag colour is free."
      >
        <SettingsBlock>
          <ChatFeedPanel part="colours" />
        </SettingsBlock>
      </SettingsGroup>
    </LookPreviewProvider>
  );
}
