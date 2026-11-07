import type { Metadata } from 'next';
import GuideIndex, { guideIndexMetadata } from './_pages/GuideIndex';
import { DEFAULT_LOCALE } from './_i18n';
import { GUIDE_TAB_PARAM, parseGuideTab } from './_i18n/guideTabs';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return guideIndexMetadata(DEFAULT_LOCALE, parseGuideTab((await searchParams)[GUIDE_TAB_PARAM]));
}

export default async function GuidesPage({ searchParams }: Props) {
  return <GuideIndex lang={DEFAULT_LOCALE} tab={parseGuideTab((await searchParams)[GUIDE_TAB_PARAM])} />;
}
