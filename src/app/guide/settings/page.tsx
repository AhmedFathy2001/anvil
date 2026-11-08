import type { Metadata } from 'next';
import SettingsGuide, { settingsGuideMetadata } from '../_pages/SettingsGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return settingsGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <SettingsGuide lang={DEFAULT_LOCALE} />;
}
