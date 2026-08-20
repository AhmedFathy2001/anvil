import type { Metadata } from 'next';
import AdminGuide, { adminGuideMetadata } from '../../_pages/AdminGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return adminGuideMetadata((await params).lang);
}

export default async function LocalisedAdminGuidePage({ params }: { params: Promise<{ lang: string }> }) {
  return <AdminGuide lang={(await params).lang} />;
}
