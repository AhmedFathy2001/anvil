import { notFound } from 'next/navigation';
import { findLocale, DEFAULT_LOCALE } from '../_i18n';

// `/guide/da/plugin` and friends. Static segments win in the App Router, so `/guide/plugin` still
// matches the English page above and never lands here — `[lang]` only ever catches a language code.
//
// The check lives in the layout so all four pages under it get it for free: anything that isn't a
// registered locale is a 404, not a page rendered silently in English under a made-up URL.
export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = findLocale(lang);
  // English lives at /guide/*; a second URL for it would just split the links people share.
  if (!locale || locale.code === DEFAULT_LOCALE) notFound();
  return <>{children}</>;
}
