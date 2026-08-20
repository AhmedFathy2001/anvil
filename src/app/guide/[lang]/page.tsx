import type { Metadata } from 'next';
import GuideIndex, { guideIndexMetadata } from '../_pages/GuideIndex';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return guideIndexMetadata((await params).lang);
}

export default async function LocalisedGuidesPage({ params }: { params: Promise<{ lang: string }> }) {
  return <GuideIndex lang={(await params).lang} />;
}
