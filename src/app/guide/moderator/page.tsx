import type { Metadata } from 'next';
import ModeratorGuide, { moderatorGuideMetadata } from '../_pages/ModeratorGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return moderatorGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <ModeratorGuide lang={DEFAULT_LOCALE} />;
}
