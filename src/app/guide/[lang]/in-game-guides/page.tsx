import type { Metadata } from 'next';
import GuideLibraryGuide, { guideLibraryGuideMetadata } from '../../_pages/GuideLibraryGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return guideLibraryGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <GuideLibraryGuide lang={(await params).lang} />;
}
