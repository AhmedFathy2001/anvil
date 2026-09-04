import type { Metadata } from 'next';
import DiscordGuide, { discordGuideMetadata } from '../../_pages/DiscordGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return discordGuideMetadata((await params).lang);
}

export default async function LocalisedDiscordGuidePage({ params }: { params: Promise<{ lang: string }> }) {
  return <DiscordGuide lang={(await params).lang} />;
}
