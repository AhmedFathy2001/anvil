import type { Metadata } from 'next';
import SwitchingGuide, { switchingGuideMetadata } from '../_pages/SwitchingGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return switchingGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <SwitchingGuide lang={DEFAULT_LOCALE} />;
}
