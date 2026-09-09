import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Staff management moved into the unified Clan hub as the "Staff" tab. Kept as a redirect
// so old links / bookmarks still resolve.
//
// The client component this route used to render lives with the page that renders it now — it
// sat in here for months, imported across the tree as `../../users/UsersClient`, which made a
// folder containing one redirect look like a live route.
export default async function UsersRedirect() {
  redirect(await clanHref('/admin/people/staff'));
}
