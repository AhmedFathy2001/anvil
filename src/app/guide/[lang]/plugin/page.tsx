import type { Metadata } from 'next';
import PluginGuide, { pluginGuideMetadata } from '../../_pages/PluginGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return pluginGuideMetadata((await params).lang);
}

export default async function LocalisedPluginGuidePage({ params }: { params: Promise<{ lang: string }> }) {
  return <PluginGuide lang={(await params).lang} />;
}
