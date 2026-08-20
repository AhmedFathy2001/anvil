import type { Metadata } from 'next';
import ModeratorGuide, { moderatorGuideMetadata } from '../../_pages/ModeratorGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return moderatorGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <ModeratorGuide lang={(await params).lang} />;
}
