import type { Metadata } from 'next';
import CommandsGuide, { commandsGuideMetadata } from '../_pages/CommandsGuide';
import { DEFAULT_LOCALE } from '../_i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return commandsGuideMetadata(DEFAULT_LOCALE);
}

export default function Page() {
  return <CommandsGuide lang={DEFAULT_LOCALE} />;
}
