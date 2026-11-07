import type { Metadata } from 'next';
import PeopleGuide, { peopleGuideMetadata } from '../../_pages/PeopleGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return peopleGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <PeopleGuide lang={(await params).lang} />;
}
