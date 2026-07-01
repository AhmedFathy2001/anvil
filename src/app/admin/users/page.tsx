import { redirect } from 'next/navigation';

// Staff management moved into the unified Clan hub as the "Staff" tab. Kept as a redirect
// so old links / bookmarks still resolve.
export default function UsersRedirect() {
  redirect('/admin/clan/staff');
}
