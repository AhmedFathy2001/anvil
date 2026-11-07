import type { Metadata } from 'next';
import StaffRolesGuide, { staffRolesGuideMetadata } from '../_pages/StaffRolesGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return staffRolesGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <StaffRolesGuide lang={DEFAULT_LOCALE} />;
}
