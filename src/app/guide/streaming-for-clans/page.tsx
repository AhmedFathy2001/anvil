import type { Metadata } from 'next';
import StreamingClansGuide, { streamingClansGuideMetadata } from '../_pages/StreamingClansGuide';
import { DEFAULT_LOCALE } from '../_i18n';

// Reads this deployment's own address and settings through the shared dictionary path, so no static render.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return streamingClansGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <StreamingClansGuide lang={DEFAULT_LOCALE} />;
}
