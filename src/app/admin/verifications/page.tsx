import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Verifications moved into the unified Clan hub as the "Needs review" tab. Kept as a
// redirect so old links / bookmarks / notifications still land in the right place.
//
// The client component this route used to render lives with the page that renders it now — it
// sat in here for months, imported across the tree as `../../users/UsersClient`, which made a
// folder containing one redirect look like a live route.
export default async function VerificationsRedirect() {
  redirect(await clanHref('/admin/people/needs-review'));
}
