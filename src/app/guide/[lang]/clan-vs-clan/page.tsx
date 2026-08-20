import type { Metadata } from 'next';
import ClanVsClanGuide, { clanVsClanGuideMetadata } from '../../_pages/ClanVsClanGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return clanVsClanGuideMetadata((await params).lang);
}

export default async function LocalisedClanVsClanGuidePage({ params }: { params: Promise<{ lang: string }> }) {
  return <ClanVsClanGuide lang={(await params).lang} />;
}
