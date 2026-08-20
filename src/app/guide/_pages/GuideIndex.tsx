import type { Metadata } from 'next';
import Link from 'next/link';
import { LanguageBar } from '../_components/LanguageBar';
import { getDict, findLocale, guideHref, LOCALES } from '../_i18n';
import { rt } from '../_i18n/rich';

export async function guideIndexMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.index.metaTitle, description: t.index.metaDescription };
}

export default async function GuideIndex({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const locale = findLocale(lang) ?? LOCALES[0];

  const cards = [
    { page: 'plugin' as const, ...t.index.cards.plugin },
    { page: 'admin' as const, ...t.index.cards.admin },
  ];

  return (
    <div className="max-w-3xl" lang={locale.code} dir={locale.dir}>
      <LanguageBar current={locale.code} page="" label={t.common.language} />

      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-6 bg-gold rounded-full" />
        <h1 className="text-3xl font-bold">{t.index.title}</h1>
      </div>
      <p className="text-text-muted mb-8">{rt(t.index.dek)}</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((g) => (
          <Link
            key={g.page}
            href={guideHref(locale.code, g.page)}
            className="group border border-card-border rounded-xl bg-card-bg p-5 hover:border-gold/40 transition-colors"
          >
            <div className="text-[11px] uppercase tracking-widest text-gold mb-2">{g.eyebrow}</div>
            <div className="text-lg font-semibold mb-1 group-hover:text-gold-light transition-colors">
              {g.title}
            </div>
            <p className="text-sm text-text-muted mb-3">{g.blurb}</p>
            <div className="text-xs text-text-muted">{g.minutes}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
