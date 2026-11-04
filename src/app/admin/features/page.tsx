import { redirect } from 'next/navigation';

import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { getClanFeatures } from '@/lib/clanFeatures';
import { clanHref } from '@/lib/clanPath';
import { FEATURES } from '@/lib/features';
import { CREATOR_ONLY_OFF, isCreatorSpace } from '@/lib/creatorSpaces';
import FeaturesClient from './FeaturesClient';
import ClanSettingsHeader from '../clan/ClanSettingsHeader';

export const dynamic = 'force-dynamic';

/**
 * Admin → Features: switch on only what the clan uses.
 *
 * ADMIN only — turning a feature off hides it for every member. The API checks again.
 */
export default async function FeaturesPage() {
  if (!(await verifyAdmin())) redirect(await clanHref('/admin/dashboard'));
  const clan = await requireClan();
  const flags = await getClanFeatures(clan.id);
  // Tabbed with the rest of the clan settings (see ClanSettingsHeader), which names the page.
  return (
    <div>
      <ClanSettingsHeader isAdmin />
      {/* A creator space never sees the switches for modules it cannot have (lib/creatorSpaces). */}
      <FeaturesClient
        initial={FEATURES.filter((f) => !isCreatorSpace(clan) || !CREATOR_ONLY_OFF.includes(f.key)).map((f) => ({
          key: f.key,
          on: flags.on(f.key),
        }))}
      />
    </div>
  );
}
