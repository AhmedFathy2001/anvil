import { LookGroups } from '../_parts/look';
import { PlanGroups } from '../_parts/supporter';
import { BoostsGroups } from '../_parts/boosts';
import { PartJumps, SettingsPart, SettingsTitle } from '../_ui';

export const dynamic = 'force-dynamic';

/**
 * Profile & look: your plan and boosts at the top, then everything that dresses you (pictures,
 * display case, name colours, chat colours) with a live preview. Was four pages: Profile look,
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
          { id: 'plan', label: 'Your plan' },
          { id: 'boosts', label: 'Clan boosts' },
          { id: 'look', label: 'Your look' },
          { id: 'name-colours', label: 'Name colours' },
          { id: 'chat-colours', label: 'Chat colours' },
        ]}
      />

      <SettingsPart id="plan" title="Your plan" intro="Supporters pay for Anvil’s servers, and their name says so.">
        <PlanGroups />
      </SettingsPart>

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
