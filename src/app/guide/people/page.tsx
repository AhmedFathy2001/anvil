import type { Metadata } from 'next';
import PeopleGuide, { peopleGuideMetadata } from '../_pages/PeopleGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return peopleGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <PeopleGuide lang={DEFAULT_LOCALE} />;
}
