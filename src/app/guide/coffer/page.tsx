import type { Metadata } from 'next';
import CofferGuide, { cofferGuideMetadata } from '../_pages/CofferGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return cofferGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <CofferGuide lang={DEFAULT_LOCALE} />;
}
