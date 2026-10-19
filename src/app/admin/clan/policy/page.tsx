import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Moved to People → Who can join. Kept so bookmarks and older guide links still land.
export default async function ClanPolicyRedirect() {
  redirect(await clanHref('/admin/people/access'));
}
