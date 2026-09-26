import { redirect } from 'next/navigation';

import { clanGuideActor } from '@/lib/guideAccess';
import { clanHref } from '@/lib/clanPath';
import GuidesAdminClient from './GuidesAdminClient';

export const metadata = { title: 'Guides' };

export default async function AdminGuidesPage() {
  const actor = await clanGuideActor();
  if (!actor) redirect(await clanHref('/admin/dashboard'));
  return <GuidesAdminClient clanName={actor.clan.name} />;
}
