import type { Metadata } from 'next';
import StaffRolesGuide, { staffRolesGuideMetadata } from '../../_pages/StaffRolesGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return staffRolesGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <StaffRolesGuide lang={(await params).lang} />;
}
