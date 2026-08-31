import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Staff management moved into the unified Clan hub as the "Staff" tab. Kept as a redirect
// so old links / bookmarks still resolve.
export default async function UsersRedirect() {
  redirect(await clanHref('/admin/people/staff'));
}
