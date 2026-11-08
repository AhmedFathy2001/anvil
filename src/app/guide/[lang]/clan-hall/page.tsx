import type { Metadata } from 'next';
import ClanHallGuide, { clanHallGuideMetadata } from '../../_pages/ClanHallGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return clanHallGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <ClanHallGuide lang={(await params).lang} />;
}
