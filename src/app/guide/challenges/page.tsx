import type { Metadata } from 'next';
import ChallengesGuide, { challengesGuideMetadata } from '../_pages/ChallengesGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return challengesGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <ChallengesGuide lang={DEFAULT_LOCALE} />;
}
