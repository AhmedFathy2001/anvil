import { redirect } from 'next/navigation';

import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { getClanFeatures } from '@/lib/clanFeatures';
import { clanHref } from '@/lib/clanPath';
import { FEATURES } from '@/lib/features';
import FeaturesClient from './FeaturesClient';

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
  return <FeaturesClient initial={FEATURES.map((f) => ({ key: f.key, on: flags.on(f.key) }))} />;
}
