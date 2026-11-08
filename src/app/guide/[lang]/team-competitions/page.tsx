import type { Metadata } from 'next';
import TeamCompsGuide, { teamCompsGuideMetadata } from '../../_pages/TeamCompsGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return teamCompsGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <TeamCompsGuide lang={(await params).lang} />;
}
