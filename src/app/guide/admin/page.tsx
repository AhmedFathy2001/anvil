import type { Metadata } from 'next';
import AdminGuide, { adminGuideMetadata } from '../_pages/AdminGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Instance-specific copy (clan name), so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return adminGuideMetadata(DEFAULT_LOCALE);
}

export default function AdminGuidePage() {
  return <AdminGuide lang={DEFAULT_LOCALE} />;
}
