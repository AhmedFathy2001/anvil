import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import CuratorQueue from '@/components/guides/CuratorQueue';
import { verifyUser } from '@/lib/auth';
import { canCurateUser, curatorQueue } from '@/lib/guideCommunity';

export const metadata: Metadata = { title: 'Curator queue · Guides' };

/** The library's curator queue: platform staff, guide editors, and writers who earned it. */
export default async function CuratePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await verifyUser();
  if (!user || !(await canCurateUser(user.userId))) notFound();
  const { tab: raw } = await searchParams;
  const tab = raw === 'reported' || raw === 'promoted' ? raw : 'new';
  const [rows, fresh, reported] = await Promise.all([curatorQueue(tab), tab === 'new' ? Promise.resolve(null) : curatorQueue('new'), tab === 'reported' ? Promise.resolve(null) : curatorQueue('reported')]);
  return (
    <CuratorQueue
      tab={tab}
      rows={rows.map((r) => ({ id: r.id, kind: r.kind, name: r.name, guideTitle: r.guideTitle, guideSlug: r.guideSlug, tier: r.tier, author: r.author, createdAt: r.createdAt, voters: r.voters, avgKc: r.avgKc, reports: r.reports }))}
      counts={{ new: (tab === 'new' ? rows : fresh ?? []).length, reported: (tab === 'reported' ? rows : reported ?? []).length }}
    />
  );
}
