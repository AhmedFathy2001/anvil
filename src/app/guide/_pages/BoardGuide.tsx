import type { Metadata } from 'next';
import { TILE_KIND_BADGES, TILE_KIND_FILTERS, type TileKindKey } from '@/lib/tileKinds';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { items, paragraphs, rows, rt } from '../_i18n/rich';

// Tile authoring, for whoever builds the board — which is often an `editor` with no other admin
// access at all. The kind table is read from lib/tileKinds rather than restated here, so a kind
// added to the picker can't quietly go missing from its own documentation.

export async function boardGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.board.metaTitle, description: t.board.metaDescription };
}

export default async function BoardGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const b = t.board;
  const { locale, languages, notice } = localeChrome(lang, 'board', t.common);

  const v = { formatsGuide: guideHref(locale.code, 'formats') };

  // 'all' is a filter option, not a kind. Everything else keeps the picker's order.
  const kindRows = TILE_KIND_FILTERS.filter((f) => f.key !== 'all').map((f) => {
    const key = f.key as TileKindKey;
    const override = b.kinds.kindLabels[key];
    const badge = TILE_KIND_BADGES[key];
    return { term: override?.label || badge.label, body: rt(override?.blurb || badge.blurb) };
  });

  const SECTIONS = [
    { id: 'kinds', n: 1, title: b.kinds.title },
    { id: 'pick', n: 2, title: b.pick.title },
    { id: 'bulk', n: 3, title: b.bulk.title },
    { id: 'traps', n: 4, title: b.traps.title },
    { id: 'points', n: 5, title: b.points.title },
    { id: 'reveal', n: 6, title: b.reveal.title },
    { id: 'check', n: 7, title: b.check.title },
  ];

  return (
    <GuideShell
      eyebrow={b.eyebrow}
      title={b.title}
      sections={SECTIONS}
      minutes={8}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(b.dek, v)}
      facts={b.facts}
      footnote={rt(b.footnote, v)}
    >
      <Section id="kinds" n={1} title={b.kinds.title} labels={t.common}>
        {paragraphs(b.kinds.body, v)}
        <Rows rows={rows(b.kinds.families, v)} />
        <p className="text-text-muted">{rt(b.kinds.kindsIntro, v)}</p>
        <Rows rows={kindRows} />
        <Note tag={b.kinds.note.tag}>
          <p>{rt(b.kinds.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="pick" n={2} title={b.pick.title} labels={t.common}>
        <p className="text-text-muted">{rt(b.pick.intro, v)}</p>
        <Rows rows={rows(b.pick.rows, v)} />
        <Note tag={b.pick.note.tag}>
          <p>{rt(b.pick.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="bulk" n={3} title={b.bulk.title} labels={t.common}>
        {paragraphs(b.bulk.body, v)}
        <ol className="list-decimal pl-5 text-text-muted space-y-1.5 text-sm">{items(b.bulk.steps, v)}</ol>
        <Rows rows={rows(b.bulk.rules, v)} />
      </Section>

      <Section id="traps" n={4} title={b.traps.title} labels={t.common}>
        <p className="text-text-muted">{rt(b.traps.intro, v)}</p>
        <Rows rows={rows(b.traps.rows, v)} />
        <Note tag={b.traps.note.tag}>
          <p>{rt(b.traps.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="points" n={5} title={b.points.title} labels={t.common}>
        {paragraphs(b.points.body, v)}
      </Section>

      <Section id="reveal" n={6} title={b.reveal.title} labels={t.common}>
        {paragraphs(b.reveal.body, v)}
      </Section>

      <Section id="check" n={7} title={b.check.title} labels={t.common}>
        <p className="text-text-muted">{rt(b.check.intro, v)}</p>
        <ul className="list-disc pl-5 text-text-muted space-y-1.5 text-sm">{items(b.check.items, v)}</ul>
        <Note tag={b.check.note.tag}>
          <p>{rt(b.check.note.body, v)}</p>
        </Note>
      </Section>
    </GuideShell>
  );
}
