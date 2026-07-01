import { verifyUser } from '@/lib/auth';
import UsersClient from '../../users/UsersClient';

export const dynamic = 'force-dynamic';

// "Staff" tab of the Clan hub — manage staff roles + ownership. Same client the standalone
// /admin/users page used; that route now redirects here. UsersClient's mutations are
// admin-gated at the API, so non-admins see an empty/blocked view as before.
export default async function ClanStaffPage() {
  const session = await verifyUser();
  return <UsersClient currentUserId={session?.userId ?? null} />;
}
