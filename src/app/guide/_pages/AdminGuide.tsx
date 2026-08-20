import type { Metadata } from 'next';
import { EVENT_MODES } from '@/lib/eventModes';
import { getClanDisplayName, getFederationEnabled } from '@/lib/pluginConfig';
import { isSharedLoginAvailable } from '@/lib/discord-oauth';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { paragraphs, rows, rt } from '../_i18n/rich';
import { BotConsentDiagram, ProvisioningStatesDiagram, SetupStepsDiagram } from '../_components/Diagrams';

export async function adminGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.admin.metaTitle, description: t.admin.metaDescription };
}

export default async function AdminGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const a = t.admin;
  const { locale, languages, notice } = localeChrome(lang, 'admin', t.common);

  const clanName = await getClanDisplayName('your clan');
  const federationEnabled = await getFederationEnabled();
  // Hosted instances are marked by the provisioner (ANVIL_SHARED_LOGIN + a broker URL); a self-host
  // can't declare it. Only they went through the purchase → setup → build path, so only they get the
  // paragraph about it.
  const hosted = isSharedLoginAvailable();

  const v = {
    clanName,
    pluginGuide: guideHref(locale.code, 'plugin'),
    clanVsClanGuide: guideHref(locale.code, 'clan-vs-clan'),
    boardGuide: guideHref(locale.code, 'board'),
    captainGuide: guideHref(locale.code, 'captain'),
    formatsGuide: guideHref(locale.code, 'formats'),
    feesGuide: guideHref(locale.code, 'fees'),
    moderatorGuide: guideHref(locale.code, 'moderator'),
  };

  // Format names come from the app, not the guide, so the picker and this table can't disagree.
  // The dictionary may override them: a Danish reader shouldn't hit an English table mid-page.
  const formatRows = EVENT_MODES.map((m) => {
    const override = a.board.formats[m.key as keyof typeof a.board.formats];
    return { term: override?.label || m.label, body: rt(override?.blurb || m.blurb) };
  });

  const SECTIONS = [
    { id: 'access', n: 1, title: a.access.title },
    { id: 'setup', n: 2, title: a.setup.title },
    { id: 'channels', n: 3, title: a.channels.title },
    { id: 'roster', n: 4, title: a.roster.title },
    { id: 'board', n: 5, title: a.board.title },
    { id: 'tiles', n: 6, title: a.tiles.title },
    { id: 'teams', n: 7, title: a.teams.title },
    { id: 'launch', n: 8, title: a.launch.title },
    { id: 'after', n: 9, title: a.after.title },
  ];

  return (
    <GuideShell
      eyebrow={a.eyebrow}
      title={a.title}
      sections={SECTIONS}
      minutes={8}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(a.dek, v)}
      facts={a.facts}
      footnote={rt(a.footnote, v)}
    >
      {/* ------------------------------------------------------------------ 1 */}
      <Section id="access" n={1} title={a.access.title} labels={t.common}>
        <p className="text-text-muted">{rt(a.access.intro, v)}</p>
        <Rows rows={rows(a.access.rows, v)} />
        <p className="text-text-muted">{rt(a.access.seeAlso, v)}</p>
        <Note tag={a.access.ownerNote.tag}>
          <p>{rt(a.access.ownerNote.body, v)}</p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 2 */}
      <Section id="setup" n={2} title={a.setup.title} labels={t.common}>
        <p className="text-text-muted">{rt(a.setup.intro, v)}</p>
        <SetupStepsDiagram />
        <p className="text-text-muted">{rt(a.setup.discord, v)}</p>
        <BotConsentDiagram />
        <Note tag={a.setup.permsNote.tag}>
          <p>{rt(a.setup.permsNote.body, v)}</p>
        </Note>
        {hosted && (
          <>
            <p className="text-text-muted">{rt(a.setup.hosted, v)}</p>
            <ProvisioningStatesDiagram />
          </>
        )}
      </Section>

      {/* ------------------------------------------------------------------ 3 */}
      <Section id="channels" n={3} title={a.channels.title} labels={t.common}>
        {paragraphs(a.channels.body, v)}
        <Note tag={a.channels.clipsNote.tag}>
          <p>{rt(a.channels.clipsNote.body, v)}</p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 4 */}
      <Section id="roster" n={4} title={a.roster.title} labels={t.common}>
        {paragraphs(a.roster.body, v)}
      </Section>

      {/* ------------------------------------------------------------------ 5 */}
      <Section id="board" n={5} title={a.board.title} labels={t.common}>
        <p className="text-text-muted">{rt(a.board.intro, v)}</p>
        <Rows rows={formatRows} />
        <p className="text-text-muted">{rt(a.board.outro, v)}</p>
        <p className="text-text-muted">{rt(a.board.seeAlso, v)}</p>
        <Note tag={a.board.utcNote.tag}>
          <p>{rt(a.board.utcNote.body, v)}</p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 6 */}
      <Section id="tiles" n={6} title={a.tiles.title} labels={t.common}>
        {paragraphs(a.tiles.body, v)}
        <Rows rows={rows(a.tiles.rows, v)} />
        <p className="text-text-muted">{rt(a.tiles.seeAlso, v)}</p>
      </Section>

      {/* ------------------------------------------------------------------ 7 */}
      <Section id="teams" n={7} title={a.teams.title} labels={t.common}>
        {paragraphs(a.teams.body, v)}
        <Note tag={a.teams.lockNote.tag}>
          <p>{rt(a.teams.lockNote.body, v)}</p>
        </Note>
        <p className="text-text-muted">{rt(a.teams.seeAlso, v)}</p>
        <p className="text-text-muted">{rt(a.teams.visitingClans, v)}</p>
      </Section>

      {/* ------------------------------------------------------------------ 8 */}
      <Section id="launch" n={8} title={a.launch.title} labels={t.common}>
        {paragraphs(a.launch.body, v)}
        <Rows rows={rows(a.launch.rows, v)} />
        <Note tag={a.launch.missionNote.tag}>
          <p>{rt(a.launch.missionNote.body, v)}</p>
        </Note>
        <Note tag={a.launch.startProofNote.tag}>{paragraphs(a.launch.startProofNote.body, v, '')}</Note>
      </Section>

      {/* ------------------------------------------------------------------ 9 */}
      <Section id="after" n={9} title={a.after.title} labels={t.common}>
        <p className="text-text-muted">{rt(a.after.intro, v)}</p>
        <Rows rows={rows(a.after.rows, v)} />
        {federationEnabled && <p className="text-text-muted">{rt(a.after.federation, v)}</p>}
        <p className="text-text-muted">{rt(a.after.outro, v)}</p>
      </Section>
    </GuideShell>
  );
}
