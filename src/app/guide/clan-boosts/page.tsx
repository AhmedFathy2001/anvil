import type { Metadata } from 'next';
import ClanBoostsGuide, { clanBoostsGuideMetadata } from '../_pages/ClanBoostsGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return clanBoostsGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <ClanBoostsGuide lang={DEFAULT_LOCALE} />;
}
