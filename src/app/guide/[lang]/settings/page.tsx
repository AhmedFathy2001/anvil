import type { Metadata } from 'next';
import SettingsGuide, { settingsGuideMetadata } from '../../_pages/SettingsGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return settingsGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <SettingsGuide lang={(await params).lang} />;
}
