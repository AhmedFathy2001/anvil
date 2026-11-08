import type { Metadata } from 'next';
import ProfileGuide, { profileGuideMetadata } from '../_pages/ProfileGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return profileGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <ProfileGuide lang={DEFAULT_LOCALE} />;
}
