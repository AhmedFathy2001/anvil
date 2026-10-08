import type { Metadata } from 'next';
import CommandsGuide, { commandsGuideMetadata } from '../../_pages/CommandsGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return commandsGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <CommandsGuide lang={(await params).lang} />;
}
