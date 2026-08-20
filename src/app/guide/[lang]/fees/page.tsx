import type { Metadata } from 'next';
import FeesGuide, { feesGuideMetadata } from '../../_pages/FeesGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return feesGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <FeesGuide lang={(await params).lang} />;
}
