import type { Metadata } from 'next';
import SidePanelGuide, { sidePanelGuideMetadata } from '../_pages/SidePanelGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return sidePanelGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <SidePanelGuide lang={DEFAULT_LOCALE} />;
}
