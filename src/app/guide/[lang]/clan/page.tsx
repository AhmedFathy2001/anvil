import type { Metadata } from 'next';
import ClanGuide, { clanGuideMetadata } from '../../_pages/ClanGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return clanGuideMetadata((await params).lang);
}

export default async function LocalisedClanGuidePage({ params }: { params: Promise<{ lang: string }> }) {
  return <ClanGuide lang={(await params).lang} />;
}
