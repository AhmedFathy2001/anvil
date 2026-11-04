import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { supporterForUser } from '@/lib/supporter';
import { canUseProfileMedia, displayCaseSlots, profileMediaForUser } from '@/lib/profileMedia';
import { readDisplayCase } from '@/lib/displayCase';
import ClanLink from '@/components/ClanLink';
import ProfileLookEditor from '@/components/ProfileLookEditor';
import DisplayCaseEditor from '@/components/DisplayCaseEditor';
import { SettingsBlock, SettingsGroup, SettingsTitle, TierChip } from '../_ui';

/**
 * Profile look: the Supporter perks that dress the PUBLIC profile — your own avatar and banner
 * (Champion+, animated) and the display case of your best drops (Supporter 4 / Champion 8 /
 * Patron 12 slots). Both are checked against the tier on every read, so a lapse keeps what was set.
 */
export default async function LookSettingsPage() {
  const session = (await verifyUser())!;
  const [user, supporter] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    supporterForUser(session.userId),
  ]);
  const tier = supporter?.tier.id ?? null;
  const [media, pins] = await Promise.all([
    profileMediaForUser(session.userId, { tier }),
    session.playerId ? readDisplayCase(session.userId, session.playerId).catch(() => []) : Promise.resolve([]),
  ]);
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
        note="Shown on your own card, your person page, and your shared characters’ pages if you show your characters as one person."
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
