import type { Metadata } from 'next';
import SupporterGuide, { supporterGuideMetadata } from '../../_pages/SupporterGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return supporterGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <SupporterGuide lang={(await params).lang} />;
}
