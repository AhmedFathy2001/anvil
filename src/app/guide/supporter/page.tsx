import type { Metadata } from 'next';
import SupporterGuide, { supporterGuideMetadata } from '../_pages/SupporterGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return supporterGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <SupporterGuide lang={DEFAULT_LOCALE} />;
}
