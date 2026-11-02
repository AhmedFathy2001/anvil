import type { Metadata } from 'next';
import { GUIDE_NEED_ENTRIES, NEED_GROUPS } from '@/lib/tileRequirements';
import { GuideShell, Note, Section } from '../_components/GuideUI';
import HeadingAnchor from '../_components/HeadingAnchor';
import { localeChrome } from '../_components/LanguageBar';
import { DEFAULT_LOCALE, getDict } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { rt } from '../_i18n/rich';

// "Tile rules & limitations" — the long form of every line a tile's "Before you start" shows.
//
// The entries are not dictionary copy: they come straight from lib/tileRequirements, the registry the
// tiles themselves read, so this page can't promise a rule the site doesn't enforce. Each entry sits
// under its registry id as an anchor (/guide/tiles#clog-chat-setting), which is where a tile's "Why?"
// link lands. That makes them English on every locale for now — the frame around them is translated,
// and a non-English page says so up front rather than switching language without a word.

export async function tilesGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'tiles', t.tiles.metaTitle, t.tiles.metaDescription);
}

export default async function TilesGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const g = t.tiles;
  const { locale, languages, notice } = localeChrome(lang, 'tiles', t.common);

  const groups = NEED_GROUPS.map((grp) => ({ ...grp, entries: GUIDE_NEED_ENTRIES.filter((e) => e.group === grp.key) })).filter(
    (grp) => grp.entries.length > 0,
  );
  const SECTIONS = groups.map((grp, i) => ({ id: grp.key, n: i + 1, title: grp.title }));

  return (
    <GuideShell
      eyebrow={g.eyebrow}
      title={g.title}
      sections={SECTIONS}
      minutes={4}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(g.dek)}
    >
      {locale.code !== DEFAULT_LOCALE && (
        <Note tag={locale.label}>
          <p>{g.englishOnly}</p>
        </Note>
      )}
      {groups.map((grp, i) => (
        <Section key={grp.key} id={grp.key} n={i + 1} title={grp.title} labels={t.common}>
          {/* English entries inside a translated frame: mark them so screen readers switch voice. */}
          <div lang="en" dir="ltr" className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {grp.entries.map((e) => (
              <article key={e.id} id={e.id} className="group scroll-mt-24 px-4 py-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-gold">{e.title}</h3>
                  <HeadingAnchor id={e.id} label={t.common.copyLink} copiedLabel={t.common.linkCopied} />
                  <span
                    lang={locale.code}
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      e.kind === 'requirement' ? 'bg-gold/15 text-gold' : 'bg-white/5 text-text-muted'
                    }`}
                  >
                    {e.kind === 'requirement' ? g.needs : g.limit}
                  </span>
                  {e.check && (
                    <span lang={locale.code} className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[10px] text-accent-green-light">
                      {g.checked}
                    </span>
                  )}
                </div>
                <p className="text-text-muted">{e.text}</p>
                {e.more && <p className="mt-1 text-text-muted/80">{e.more}</p>}
              </article>
            ))}
          </div>
        </Section>
      ))}
    </GuideShell>
  );
}
