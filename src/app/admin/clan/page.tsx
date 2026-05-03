import { verifyUser } from '@/lib/auth';
import ClanRosterClient from './ClanRosterClient';

export const dynamic = 'force-dynamic';

export default async function AdminClanPage() {
  const session = await verifyUser();
  const isAdmin = session?.role === 'admin';
  return <ClanRosterClient isAdmin={isAdmin} />;
}
