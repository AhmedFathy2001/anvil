import type { Metadata } from 'next';
import TilesGuide, { tilesGuideMetadata } from '../../_pages/TilesGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return tilesGuideMetadata((await params).lang);
}

export default async function LocalisedTilesGuidePage({ params }: { params: Promise<{ lang: string }> }) {
  return <TilesGuide lang={(await params).lang} />;
}
