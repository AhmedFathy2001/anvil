import type { Metadata } from 'next';
import WeeklyGuide, { weeklyGuideMetadata } from '../_pages/WeeklyGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return weeklyGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <WeeklyGuide lang={DEFAULT_LOCALE} />;
}
