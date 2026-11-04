import type { Metadata } from 'next';
import JoiningStreamGuide, { joiningStreamGuideMetadata } from '../_pages/JoiningStreamGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return joiningStreamGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <JoiningStreamGuide lang={DEFAULT_LOCALE} />;
}
