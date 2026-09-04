import type { Metadata } from 'next';
import ClanGuide, { clanGuideMetadata } from '../_pages/ClanGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Public, but the copy names this deployment's own address, so it can't be built once and cached.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return clanGuideMetadata(DEFAULT_LOCALE);
}

export default function ClanGuidePage() {
  return <ClanGuide lang={DEFAULT_LOCALE} />;
}
