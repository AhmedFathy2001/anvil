import type { Metadata } from 'next';
import TeamCompsGuide, { teamCompsGuideMetadata } from '../_pages/TeamCompsGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return teamCompsGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <TeamCompsGuide lang={DEFAULT_LOCALE} />;
}
