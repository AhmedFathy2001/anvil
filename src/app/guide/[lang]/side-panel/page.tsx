import type { Metadata } from 'next';
import SidePanelGuide, { sidePanelGuideMetadata } from '../../_pages/SidePanelGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return sidePanelGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <SidePanelGuide lang={(await params).lang} />;
}
