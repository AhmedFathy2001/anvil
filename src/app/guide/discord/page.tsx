import type { Metadata } from 'next';
import DiscordGuide, { discordGuideMetadata } from '../_pages/DiscordGuide';
import { DEFAULT_LOCALE } from '../_i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return discordGuideMetadata(DEFAULT_LOCALE);
}

export default function DiscordGuidePage() {
  return <DiscordGuide lang={DEFAULT_LOCALE} />;
}
