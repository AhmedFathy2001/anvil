import { verifyUser } from '@/lib/auth';
import UsersClient from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await verifyUser();
  return <UsersClient currentUserId={session?.userId ?? null} />;
}
