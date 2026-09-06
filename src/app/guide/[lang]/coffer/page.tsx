import type { Metadata } from 'next';
import CofferGuide, { cofferGuideMetadata } from '../../_pages/CofferGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return cofferGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <CofferGuide lang={(await params).lang} />;
}
