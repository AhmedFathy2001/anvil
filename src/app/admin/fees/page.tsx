import { redirect } from 'next/navigation';
import { verifyAdminOrModerator } from '@/lib/auth';
import FeesQueueClient from './FeesQueueClient';

export const dynamic = 'force-dynamic';

export default async function FeesQueuePage() {
  const session = await verifyAdminOrModerator();
  if (!session) {
    redirect('/admin');
  }

  return <FeesQueueClient viewerRole={session.role} viewerId={session.userId} />;
}
