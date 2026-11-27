import { notFound, redirect } from 'next/navigation';

import { verifyUser } from '@/lib/auth';
import { getItemMapping } from '@/lib/osrsItems';
import { setupOfUser } from '@/lib/tripSetups';
import { cardOf } from '../cards';
import SetupDetailClient from './SetupDetailClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Setup', robots: { index: false } };

/** One of the person's saved setups: the full doll, inventory and pouch, and its actions. Owner only. */
export default async function SetupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifyUser();
  if (!session) redirect(`/login?return=${encodeURIComponent(`/profile/setups/${id}`)}`);
  const row = await setupOfUser(session.userId, Number(id));
  if (!row) notFound();
  const mapping = await getItemMapping().catch(() => []);
  const byId = new Map(mapping.map((m) => [m.id, m.gameName ?? m.name]));
  const names: Record<number, string> = {};
  // Server component: Date.now() runs once per request.
  // eslint-disable-next-line react-hooks/purity
  const card = cardOf(row, byId, names, Date.now());
  return (
    <div className="max-w-4xl mx-auto">
      <SetupDetailClient setup={card} names={names} />
    </div>
  );
}
