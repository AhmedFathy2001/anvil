import type { Metadata } from 'next';
import StreamingClansGuide, { streamingClansGuideMetadata } from '../../_pages/StreamingClansGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return streamingClansGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <StreamingClansGuide lang={(await params).lang} />;
}
