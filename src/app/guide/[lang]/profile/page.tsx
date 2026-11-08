import type { Metadata } from 'next';
import ProfileGuide, { profileGuideMetadata } from '../../_pages/ProfileGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return profileGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <ProfileGuide lang={(await params).lang} />;
}
