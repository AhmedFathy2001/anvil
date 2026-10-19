import { redirect } from 'next/navigation';

import { verifyAdmin } from '@/lib/auth';
import { clanHref } from '@/lib/clanPath';
import PolicyClient from './PolicyClient';

export const dynamic = 'force-dynamic';

/**
 * "Who can join" tab of People — who may see the clan, and how somebody gets in.
 *
 * It used to sit in the Clan profile hub, so the question "who can join" lived one hub over from
 * the roster, the join requests and the staff it is about. Old links go through /admin/clan/policy.
 *
 * ADMIN ONLY, and the tab is hidden for everyone else. These three settings decide who can reach the
 * clan at all, which is the same class of decision as handing out a staff seat; a moderator running
 * an event has no business turning the clan private. The API asks the same question again, because
 * a hidden tab is not a permission.
 */
export default async function ClanPolicyPage() {
  // Through clanHref: a bare '/admin/clan' resolves against the apex, which has no admin area —
  // so a moderator would be bounced out of the clan entirely instead of back to its roster.
  // Not /admin/clan — that IS this page now that Profile is the hub's front door, so sending a
  // non-admin there would bounce them off it forever. People is the surface they can actually use.
  if (!(await verifyAdmin())) redirect(await clanHref('/admin/people'));
  return <PolicyClient />;
}
