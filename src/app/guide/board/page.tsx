import type { Metadata } from 'next';
import BoardGuide, { boardGuideMetadata } from '../_pages/BoardGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads clan-specific settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return boardGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <BoardGuide lang={DEFAULT_LOCALE} />;
}
