import type { Metadata } from 'next';
import GuideIndex, { guideIndexMetadata } from '../_pages/GuideIndex';
import { GUIDE_TAB_PARAM, parseGuideTab } from '../_i18n/guideTabs';

type Props = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return guideIndexMetadata((await params).lang, parseGuideTab((await searchParams)[GUIDE_TAB_PARAM]));
}

export default async function LocalisedGuidesPage({ params, searchParams }: Props) {
  return <GuideIndex lang={(await params).lang} tab={parseGuideTab((await searchParams)[GUIDE_TAB_PARAM])} />;
}
