import type { Metadata } from 'next';
import ClanBoostsGuide, { clanBoostsGuideMetadata } from '../../_pages/ClanBoostsGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return clanBoostsGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <ClanBoostsGuide lang={(await params).lang} />;
}
