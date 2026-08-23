import type { Metadata } from 'next';
import GuideIndex, { guideIndexMetadata } from './_pages/GuideIndex';
import { DEFAULT_LOCALE } from './_i18n';

export async function generateMetadata(): Promise<Metadata> {
  return guideIndexMetadata(DEFAULT_LOCALE);
}

export default function GuidesPage() {
  return <GuideIndex lang={DEFAULT_LOCALE} />;
}
