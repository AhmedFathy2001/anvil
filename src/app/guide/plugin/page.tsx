import type { Metadata } from 'next';
import PluginGuide, { pluginGuideMetadata } from '../_pages/PluginGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Public page, but the copy is instance-specific (site URL, clan name, which login this instance
// uses), so it can't be statically rendered at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pluginGuideMetadata(DEFAULT_LOCALE);
}

export default function PluginGuidePage() {
  return <PluginGuide lang={DEFAULT_LOCALE} />;
}
