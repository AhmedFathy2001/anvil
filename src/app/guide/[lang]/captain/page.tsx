import type { Metadata } from 'next';
import CaptainGuide, { captainGuideMetadata } from '../../_pages/CaptainGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return captainGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <CaptainGuide lang={(await params).lang} />;
}
