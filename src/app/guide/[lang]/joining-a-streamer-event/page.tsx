import type { Metadata } from 'next';
import JoiningStreamGuide, { joiningStreamGuideMetadata } from '../../_pages/JoiningStreamGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return joiningStreamGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <JoiningStreamGuide lang={(await params).lang} />;
}
