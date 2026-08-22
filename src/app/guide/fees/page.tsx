import type { Metadata } from 'next';
import FeesGuide, { feesGuideMetadata } from '../_pages/FeesGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return feesGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <FeesGuide lang={DEFAULT_LOCALE} />;
}
