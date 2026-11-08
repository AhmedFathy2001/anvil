import type { Metadata } from 'next';
import GuideLibraryGuide, { guideLibraryGuideMetadata } from '../_pages/GuideLibraryGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return guideLibraryGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <GuideLibraryGuide lang={DEFAULT_LOCALE} />;
}
