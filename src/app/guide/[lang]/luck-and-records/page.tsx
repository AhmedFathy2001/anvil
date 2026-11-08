import type { Metadata } from 'next';
import LuckRecordsGuide, { luckRecordsGuideMetadata } from '../../_pages/LuckRecordsGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return luckRecordsGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <LuckRecordsGuide lang={(await params).lang} />;
}
