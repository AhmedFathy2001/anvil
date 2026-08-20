import type { Metadata } from 'next';
import FormatsGuide, { formatsGuideMetadata } from '../_pages/FormatsGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return formatsGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <FormatsGuide lang={DEFAULT_LOCALE} />;
}
