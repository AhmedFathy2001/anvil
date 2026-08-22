import type { Metadata } from 'next';
import BoardGuide, { boardGuideMetadata } from '../../_pages/BoardGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return boardGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <BoardGuide lang={(await params).lang} />;
}
