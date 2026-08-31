import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Verifications moved into the unified Clan hub as the "Needs review" tab. Kept as a
// redirect so old links / bookmarks / notifications still land in the right place.
export default async function VerificationsRedirect() {
  redirect(await clanHref('/admin/people/needs-review'));
}
