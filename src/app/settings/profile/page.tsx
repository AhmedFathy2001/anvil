import { LookGroups } from '../_parts/look';
import { BoostsGroups } from '../_parts/boosts';
import ClanLink from '@/components/ClanLink';
import { PartJumps, SettingsPart, SettingsTitle } from '../_ui';

export const dynamic = 'force-dynamic';

/**
 * Profile & look: your boosts at the top, then everything that dresses you (pictures,
 * display case, name colours) with a live preview. Was four pages: Profile look,
 * Supporter & name colours, Clan boosts and the colour half of In-game chat.
 */
export default function ProfileSettingsPage() {
  return (
    <>
      <SettingsTitle title="Profile & look">
        How you look on Anvil, on Discord and in game. Try any look, Supporter ones included: it&rsquo;s saved, you see it here, and
        everyone else sees it once your tier covers it. Perks are looks only: nothing changes tracking, scoring or what an event counts.
      </SettingsTitle>
      <PartJumps
        parts={[
          { id: 'boosts', label: 'Clan boosts' },
          { id: 'look', label: 'Your look' },
          { id: 'name-colours', label: 'Name colours' },
        ]}
      />

      {/* The plan and its billing moved to Account. The anchor stays so every old #plan link still lands. */}
      <p id="plan" className="mb-8 scroll-mt-24 text-[13.5px] text-text-muted">
        Your Supporter plan and billing are under{' '}
        <ClanLink href="/settings/account#plan" className="text-gold hover:text-gold-light">
          Account
        </ClanLink>
        .
      </p>

      <SettingsPart
        id="boosts"
        title="Clan boosts"
        intro="Put your boosts on clans you’re a member of. A boosted clan gets a badge, a coloured name and a better spot in the Clan Hall; you get a Booster mark there. Boosts never change a rank, a score or a seat."
      >
        <BoostsGroups />
      </SettingsPart>

      <SettingsPart
        id="look"
        title="Your look"
        intro="Your pictures, display case and colours. The preview shows your choices as you make them."
      >
        <LookGroups />
      </SettingsPart>
    </>
  );
}
