import { redirect } from 'next/navigation';

import { verifyAdmin } from '@/lib/auth';
import { clanHref } from '@/lib/clanPath';
import PolicyClient from './PolicyClient';

export const dynamic = 'force-dynamic';

/**
 * "Access" tab of the Clan hub — who may see the clan, and how somebody gets in.
 *
 * ADMIN ONLY, and the tab is hidden for everyone else. These three settings decide who can reach the
 * clan at all, which is the same class of decision as handing out a staff seat; a moderator running
 * an event has no business turning the clan private. The API asks the same question again, because
 * a hidden tab is not a permission.
 */
export default async function ClanPolicyPage() {
  // Through clanHref: a bare '/admin/clan' resolves against the apex, which has no admin area —
  // so a moderator would be bounced out of the clan entirely instead of back to its roster.
  if (!(await verifyAdmin())) redirect(await clanHref('/admin/clan'));
  return <PolicyClient />;
}
