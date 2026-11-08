import type { Metadata } from 'next';
import ClanEventsGuide, { clanEventsGuideMetadata } from '../_pages/ClanEventsGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return clanEventsGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <ClanEventsGuide lang={DEFAULT_LOCALE} />;
}
