import type { Metadata } from 'next';
import CreatorsGuide, { creatorsGuideMetadata } from '../_pages/CreatorsGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return creatorsGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <CreatorsGuide lang={DEFAULT_LOCALE} />;
}
