import type { Metadata } from 'next';
import CreatorsGuide, { creatorsGuideMetadata } from '../../_pages/CreatorsGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return creatorsGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <CreatorsGuide lang={(await params).lang} />;
}
