import Link from 'next/link';
import { LOCALES, findLocale, guideHref, type GuideLocale } from '../_i18n';
import { rt } from '../_i18n/rich';

// The language row above every guide, and the note that admits when a translation is unfinished.
//
// Plain links, no client JS and no cookie: each language is its own URL, so a Danish player can
// paste /guide/da/plugin into their clan chat and everyone who opens it gets Danish. English keeps
// the bare /guide/plugin path it has always had, because that one is already out there in Discord
// messages and shouldn't start redirecting.

export type GuidePage = '' | 'plugin' | 'admin' | 'clan-vs-clan';

export function LanguageBar({ current, page, label }: { current: string; page: GuidePage; label: string }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs" aria-label={label}>
      <span className="uppercase tracking-widest text-text-muted/70 mr-1">{label}</span>
      {LOCALES.map((l) => {
        const active = l.code === current;
        return (
          <Link
            key={l.code}
            href={guideHref(l.code, page)}
            hrefLang={l.code}
            lang={l.code}
            dir={l.dir}
            title={l.english}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'px-2 py-0.5 rounded-full border border-gold/40 bg-gold/10 text-gold'
                : 'px-2 py-0.5 rounded-full border border-card-border text-text-muted hover:text-foreground hover:border-gold/30 transition-colors'
            }
          >
            {l.label}
            {!l.complete && (
              <span className="text-text-muted/50" aria-hidden>
                {' '}
                ·
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Shown on a locale that hasn't translated everything.
 *
 * Missing keys fall back to English silently, which is the right rendering and the wrong experience
 * if nobody says why the page changes language halfway down.
 */
export function PartialNotice({ locale, template }: { locale: GuideLocale; template: string }) {
  return (
    <div className="border border-card-border border-l-2 border-l-gold/50 rounded-r-lg bg-card-bg px-4 py-3 mb-10 text-sm text-text-muted">
      {rt(template, { language: locale.label })}
    </div>
  );
}

/** Everything a page needs to render the two bits above, resolved from a URL segment. */
export function localeChrome(code: string, page: GuidePage, common: { language: string; partialNotice: string }) {
  const locale = findLocale(code) ?? LOCALES[0];
  return {
    locale,
    languages: <LanguageBar current={locale.code} page={page} label={common.language} />,
    notice: locale.complete ? null : <PartialNotice locale={locale} template={common.partialNotice} />,
  };
}
