import LanguagePicker from './LanguagePicker';
import { LOCALES, findLocale, guideHref, type GuideLocale, type GuidePage } from '../_i18n';
import { rt } from '../_i18n/rich';

// The language row above every guide, and the note that admits when a translation is unfinished.
//
// Plain links, no client JS and no cookie: each language is its own URL, so a Danish player can
// paste /guide/da/plugin into their clan chat and everyone who opens it gets Danish. English keeps
// the bare /guide/plugin path it has always had, because that one is already out there in Discord
// messages and shouldn't start redirecting.

export type { GuidePage };

export function LanguageBar({ current, page, label }: { current: string; page: GuidePage; label: string }) {
  return (
    <LanguagePicker
      current={current}
      label={label}
      locales={LOCALES.map((l) => ({
        code: l.code,
        label: l.label,
        english: l.english,
        dir: l.dir,
        complete: l.complete,
        href: guideHref(l.code, page),
      }))}
    />
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

/**
 * Shown on a translation no speaker of the language has checked yet.
 *
 * Carries the English page's address, because the useful thing for a reader who hits a sentence
 * that doesn't parse is the original — not an apology.
 */
export function UnreviewedNotice({
  locale,
  template,
  englishHref,
}: {
  locale: GuideLocale;
  template: string;
  englishHref: string;
}) {
  return (
    <div className="border border-card-border border-l-2 border-l-gold/50 rounded-r-lg bg-card-bg px-4 py-3 mb-10 text-sm text-text-muted">
      {rt(template, { language: locale.label, englishHref })}
    </div>
  );
}

/** Everything a page needs to render the bits above, resolved from a URL segment. */
export function localeChrome(
  code: string,
  page: GuidePage,
  common: { language: string; partialNotice: string; unreviewedNotice: string },
) {
  const locale = findLocale(code) ?? LOCALES[0];
  const notices = [
    locale.complete ? null : (
      <PartialNotice key="partial" locale={locale} template={common.partialNotice} />
    ),
    locale.reviewed ? null : (
      <UnreviewedNotice
        key="unreviewed"
        locale={locale}
        template={common.unreviewedNotice}
        englishHref={guideHref('en', page)}
      />
    ),
  ].filter(Boolean);
  return {
    locale,
    languages: <LanguageBar current={locale.code} page={page} label={common.language} />,
    notice: notices.length ? <>{notices}</> : null,
  };
}
