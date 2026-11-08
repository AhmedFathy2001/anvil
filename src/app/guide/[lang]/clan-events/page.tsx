import type { Metadata } from 'next';
import ClanEventsGuide, { clanEventsGuideMetadata } from '../../_pages/ClanEventsGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return clanEventsGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <ClanEventsGuide lang={(await params).lang} />;
}
