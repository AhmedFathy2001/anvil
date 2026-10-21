import type { Metadata } from 'next';
import SwitchingGuide, { switchingGuideMetadata } from '../../_pages/SwitchingGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return switchingGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <SwitchingGuide lang={(await params).lang} />;
}
