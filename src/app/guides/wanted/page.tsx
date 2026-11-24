import type { Metadata } from 'next';

import WantedBoard from '@/components/guides/WantedBoard';
import { verifyUser } from '@/lib/auth';
import { currentClan } from '@/lib/clanContext';
import { canCurateUser, listWanted } from '@/lib/guideCommunity';
import { publicGuides } from '@/lib/guides';

export const metadata: Metadata = { title: 'Wanted · Guides' };

export default async function WantedPage() {
  const clan = await currentClan();
  const user = await verifyUser();
  const [open, filled, guides, curate] = await Promise.all([listWanted(), listWanted({ status: 'filled', limit: 10 }), publicGuides(clan?.id ?? null), user ? canCurateUser(user.userId) : Promise.resolve(false)]);
  return (
    <WantedBoard
      open={open}
      filled={filled}
      guides={guides.filter((g) => g.origin === 'library' || g.guide.sourceGuideId).map((g) => ({ id: g.guide.id, title: g.guide.title }))}
      signedIn={!!user}
      canCurate={curate}
    />
  );
}
