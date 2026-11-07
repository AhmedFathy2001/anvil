import { desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import { supporterForUser } from '@/lib/supporter';
import { accountMediaRows, canUseProfileMedia, displayCaseSlots, profileMediaForUser, shownProfileMedia } from '@/lib/profileMedia';
import { readDisplayCase } from '@/lib/displayCase';
import ClanLink from '@/components/ClanLink';
import ProfileLookEditor from '@/components/ProfileLookEditor';
import CharacterLookOverrides from '@/components/CharacterLookOverrides';
import DisplayCaseEditor from '@/components/DisplayCaseEditor';
import { SettingsBlock, SettingsGroup, SettingsTitle, TierChip } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

/**
 * Profile look: the Supporter perks that dress the PUBLIC profile — your own avatar and banner
 * (Champion+, animated) and the display case of your best drops (Supporter 4 / Champion 8 /
 * Patron 12 slots). Both are checked against the tier on every read, so a lapse keeps what was set.
 */
export default async function LookSettingsPage() {
  const session = await settingsSession();
  const [user, supporter] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    supporterForUser(session.userId),
  ]);
  const tier = supporter?.tier.id ?? null;
  const [media, pins, characters] = await Promise.all([
    profileMediaForUser(session.userId, { tier }),
    session.playerId ? readDisplayCase(session.userId, session.playerId).catch(() => []) : Promise.resolve([]),
    session.playerId
      ? db.select({ accountId: accounts.id, rsn: accounts.rsn })
          .from(accounts).where(eq(accounts.playerId, session.playerId)).orderBy(desc(accounts.isPrimary), accounts.rsn)
      : Promise.resolve([]),
  ]);
  // Each character's OWN pictures only (account_media), gated like the default; null parts use it.
  const overrides = await accountMediaRows(characters.map((c) => c.accountId)).catch(() => new Map());
  const characterLooks = characters.map((c) => ({ ...c, own: shownProfileMedia(overrides.get(c.accountId), tier) }));
  const showPerCharacter = characterLooks.length > 0 && (canUseProfileMedia(tier) || characterLooks.some((c) => c.own.avatar || c.own.banner));
  const slots = displayCaseSlots(tier);

  return (
    <>
      <SettingsTitle title="Profile look">
        How your profile looks to everyone else. These are Supporter perks;{' '}
        <ClanLink href="/settings/supporter" className="text-gold hover:text-gold-light">
          see the tiers →
        </ClanLink>
      </SettingsTitle>

      <SettingsGroup
        title="Avatar & banner"
        note="Shown on your card, your person page and every character of yours, on the site and in the plugin."
      >
        <SettingsBlock>
          {!canUseProfileMedia(tier) && (
            <p className="mb-3 flex items-center gap-2 text-[12.5px] text-text-muted">
              Uploading your own, animated, is a <TierChip tier="Champion" /> perk.
            </p>
          )}
          <ProfileLookEditor initial={media} canUpload={canUseProfileMedia(tier)} name={user?.displayName ?? 'You'} />
        </SettingsBlock>
      </SettingsGroup>

      {showPerCharacter && (
        <SettingsGroup
          title="Per character"
          note="Give a character its own banner or avatar (or both). It replaces your default on that character’s pages and plugin card only."
        >
          <SettingsBlock>
            <CharacterLookOverrides characters={characterLooks} fallback={media} canUpload={canUseProfileMedia(tier)} />
          </SettingsBlock>
        </SettingsGroup>
      )}

      <SettingsGroup
        title={`Display case${slots ? ` · ${slots} slots` : ''}`}
        note="Your best drops, kill counts and times pinned to your profile. Pins from characters you don’t share stay private."
      >
        <SettingsBlock>
          {slots === 0 && (
            <p className="mb-3 flex items-center gap-2 text-[12.5px] text-text-muted">
              <TierChip tier="Supporter" /> 4 slots · <TierChip tier="Champion" /> 8 · <TierChip tier="Patron" /> 12
            </p>
          )}
          <DisplayCaseEditor initialPins={pins} slots={slots} />
        </SettingsBlock>
      </SettingsGroup>
    </>
  );
}
