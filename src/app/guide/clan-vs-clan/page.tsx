import type { Metadata } from 'next';
import ClanVsClanGuide, { clanVsClanGuideMetadata } from '../_pages/ClanVsClanGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Shows this instance's own origin in the example invite URL, so it can't be built ahead of time.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return clanVsClanGuideMetadata(DEFAULT_LOCALE);
}

export default function ClanVsClanGuidePage() {
  return <ClanVsClanGuide lang={DEFAULT_LOCALE} />;
}
