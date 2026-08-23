import type { Metadata } from 'next';
import CaptainGuide, { captainGuideMetadata } from '../_pages/CaptainGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return captainGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <CaptainGuide lang={DEFAULT_LOCALE} />;
}
