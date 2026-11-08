import type { Metadata } from 'next';
import LuckRecordsGuide, { luckRecordsGuideMetadata } from '../_pages/LuckRecordsGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return luckRecordsGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <LuckRecordsGuide lang={DEFAULT_LOCALE} />;
}
