import type { Metadata } from 'next';
import TilesGuide, { tilesGuideMetadata } from '../_pages/TilesGuide';
import { DEFAULT_LOCALE } from '../_i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return tilesGuideMetadata(DEFAULT_LOCALE);
}

export default function TilesGuidePage() {
  return <TilesGuide lang={DEFAULT_LOCALE} />;
}
