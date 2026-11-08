import type { Metadata } from 'next';
import WeeklyGuide, { weeklyGuideMetadata } from '../../_pages/WeeklyGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return weeklyGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <WeeklyGuide lang={(await params).lang} />;
}
