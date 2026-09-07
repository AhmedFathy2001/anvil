import type { Metadata } from 'next';

import { socialMetadata } from '@/lib/seo';
import { DEFAULT_LOCALE, GUIDE_PAGES, LOCALES, guideHref, type GuidePage } from './index';

/**
 * Title, description, canonical and hreflang for one guide page in one language.
 *
 * THE HREFLANG SET IS THE POINT. Twelve guides were translated into sixteen languages and every one
 * of them shipped with a bare title and description — so to a crawler `/guide/board` and
 * `/guide/de/board` were two unrelated pages with the same layout, competing with each other, and
 * a German reader searching in German was served the English one. Declaring them as translations of
 * a single page is what turns 192 near-duplicates into one page that exists in sixteen languages.
 *
 * `x-default` points at English, which is the source of truth and the only complete-by-definition
 * locale — it is what a reader whose language we do not have should land on.
 */
export function guideMetadata(
  lang: string,
  page: GuidePage,
  title: string,
  description: string,
): Metadata {
  const languages: Record<string, string> = Object.fromEntries([
    ...LOCALES.map((l) => [l.code, guideHref(l.code, page)]),
    ['x-default', guideHref(DEFAULT_LOCALE, page)],
  ]);

  // An unknown segment falls back to English exactly as `getDict` does, so a canonical is never
  // minted for a locale that does not exist.
  const code = LOCALES.some((l) => l.code === lang) ? lang : DEFAULT_LOCALE;

  return socialMetadata({
    title,
    description,
    canonical: guideHref(code, page),
    languages,
  });
}

/** Every guide URL, for the sitemap. One list, so a language cannot fall off it silently. */
export function allGuideHrefs(): { href: string; locale: string }[] {
  return LOCALES.flatMap((l) => GUIDE_PAGES.map((p) => ({ href: guideHref(l.code, p), locale: l.code })));
}
