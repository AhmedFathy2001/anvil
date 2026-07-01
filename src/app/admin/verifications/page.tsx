import { redirect } from 'next/navigation';

// Verifications moved into the unified Clan hub as the "Needs review" tab. Kept as a
// redirect so old links / bookmarks / notifications still land in the right place.
export default function VerificationsRedirect() {
  redirect('/admin/clan/needs-review');
}
