import { verifyUser } from '@/lib/auth';
import ClanRosterClient from './ClanRosterClient';
import { atLeast } from '@/lib/clanRoles';

export const dynamic = 'force-dynamic';

export default async function AdminClanPage() {
  const session = await verifyUser();
  const isAdmin = atLeast(session?.role, 'admin');
  return <ClanRosterClient isAdmin={isAdmin} />;
}
