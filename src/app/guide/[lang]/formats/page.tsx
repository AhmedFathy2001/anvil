import type { Metadata } from 'next';
import FormatsGuide, { formatsGuideMetadata } from '../../_pages/FormatsGuide';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return formatsGuideMetadata((await params).lang);
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <FormatsGuide lang={(await params).lang} />;
}
