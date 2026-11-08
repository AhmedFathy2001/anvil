import type { Metadata } from 'next';
import ChallengesGuide, { challengesGuideMetadata } from '../../_pages/ChallengesGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return challengesGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <ChallengesGuide lang={(await params).lang} />;
}
