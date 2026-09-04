import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { GuideShell, Figure, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict } from '../_i18n';
import { items, legend, paragraphs, rows, rt } from '../_i18n/rich';

// The host-side guide for a clan-v-clan: one invite link per visiting team, and a staff seat so
// that clan's own moderator runs their half. Both features live in lib/teamInvites and lib/teamStaff;
// this page is the only place that explains how they fit together in the order a host does them.

/** Only ever displayed (never redirected to), so a Host fallback is fine — same as the plugin guide. */
async function siteOrigin(): Promise<string> {
  const fromEnv = (u: string | undefined): string | null => {
    if (!u) return null;
    try {
      return new URL(u).origin;
    } catch {
      return null;
    }
  };
  const configured = fromEnv(process.env.APP_URL) || fromEnv(process.env.DISCORD_REDIRECT_URI);
  if (configured) return configured;
  const h = await headers();
  const host = h.get('host');
  // The platform's own address. Only reached when neither APP_URL nor a Host header is set,
  // which is a build-time render rather than a real request — one site now, not a URL per clan.
  return host ? `https://${host}` : 'https://anvilosrs.com';
}

export async function clanVsClanGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return { title: t.clanVsClan.metaTitle, description: t.clanVsClan.metaDescription };
}

export default async function ClanVsClanGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const c = t.clanVsClan;
  const { locale, languages, notice } = localeChrome(lang, 'clan-vs-clan', t.common);

  const origin = await siteOrigin();

  // Shape-of-the-URL and banner examples. Deliberately fake: a real token in a public guide would be
  // a live seat on someone's team, and the point here is the shape, not a working link.
  const v = { origin, eventId: '12', token: 'k7m2qp4rt9wx3n6b', teamExample: 'Ironforge' };

  const SECTIONS = [
    { id: 'shape', n: 1, title: c.shape.title },
    { id: 'team', n: 2, title: c.team.title },
    { id: 'staff', n: 3, title: c.staff.title },
    { id: 'link', n: 4, title: c.link.title },
    { id: 'captains', n: 5, title: c.captains.title },
    { id: 'player', n: 6, title: c.player.title },
    { id: 'dead', n: 7, title: c.dead.title },
  ];

  return (
    <GuideShell
      eyebrow={c.eyebrow}
      title={c.title}
      sections={SECTIONS}
      minutes={6}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(c.dek, v)}
      facts={c.facts}
      footnote={rt(c.footnote, v)}
    >
      {/* ------------------------------------------------------------------ 1 */}
      <Section id="shape" n={1} title={c.shape.title} labels={t.common}>
        {paragraphs(c.shape.body, v)}
        <Rows rows={rows(c.shape.rows, v)} />
        <Note tag={c.shape.note.tag}>
          <p>{rt(c.shape.note.body, v)}</p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 2 */}
      <Section id="team" n={2} title={c.team.title} labels={t.common}>
        {paragraphs(c.team.body, v)}
        <Note tag={c.team.captainNote.tag}>
          <p>{rt(c.team.captainNote.body, v)}</p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 3 */}
      <Section id="staff" n={3} title={c.staff.title} labels={t.common}>
        {paragraphs(c.staff.body, v)}

        <Figure
          src="/guide/cvc-team-staff.png"
          width={1038}
          height={234}
          alt={c.staff.figure.alt}
          caption={c.staff.figure.caption}
          legend={legend(c.staff.figure.legend, v)}
        />

        <p className="text-text-muted">{rt(c.staff.canDo, v)}</p>
        <ul className="list-disc pl-5 text-text-muted space-y-1.5 text-sm">{items(c.staff.canDoList, v)}</ul>
        <p className="text-text-muted">{rt(c.staff.cantDo, v)}</p>
        <ul className="list-disc pl-5 text-text-muted space-y-1.5 text-sm">{items(c.staff.cantDoList, v)}</ul>

        <Note tag={c.staff.note.tag}>
          <p>{rt(c.staff.note.body, v)}</p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 4 */}
      <Section id="link" n={4} title={c.link.title} labels={t.common}>
        {paragraphs(c.link.body, v)}

        <Figure
          src="/guide/cvc-invite-links.png"
          width={1038}
          height={277}
          alt={c.link.figure.alt}
          caption={c.link.figure.caption}
          legend={legend(c.link.figure.legend, v)}
        />

        <p className="text-text-muted">{rt(c.link.shape, v)}</p>
        <Note tag={c.link.note.tag}>
          <p>{rt(c.link.note.body, v)}</p>
        </Note>
        <p className="text-text-muted">{rt(c.link.revoke, v)}</p>
      </Section>

      {/* ------------------------------------------------------------------ 5 */}
      <Section id="captains" n={5} title={c.captains.title} optional labels={t.common}>
        {paragraphs(c.captains.body, v)}

        <Figure
          src="/guide/cvc-captain-invites.png"
          width={1275}
          height={295}
          alt={c.captains.figure.alt}
          caption={c.captains.figure.caption}
          legend={legend(c.captains.figure.legend, v)}
        />
      </Section>

      {/* ------------------------------------------------------------------ 6 */}
      <Section id="player" n={6} title={c.player.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.player.intro, v)}</p>
        <ol className="list-decimal pl-5 text-text-muted space-y-1.5 text-sm">{items(c.player.steps, v)}</ol>

        <Figure
          src="/guide/cvc-signup-invite.png"
          width={736}
          height={395}
          alt={c.player.figure.alt}
          caption={c.player.figure.caption}
          legend={legend(c.player.figure.legend, v)}
        />

        <Note tag={c.player.note.tag}>
          <p>{rt(c.player.note.body, v)}</p>
        </Note>
      </Section>

      {/* ------------------------------------------------------------------ 7 */}
      <Section id="dead" n={7} title={c.dead.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.dead.intro, v)}</p>
        <Rows rows={rows(c.dead.rows, v)} />

        <p className="text-text-muted">{rt(c.dead.checklist, v)}</p>
        <ul className="list-disc pl-5 text-text-muted space-y-1.5 text-sm">{items(c.dead.checklistItems, v)}</ul>

        <Note tag={c.dead.note.tag}>
          <p>{rt(c.dead.note.body, v)}</p>
        </Note>
      </Section>
    </GuideShell>
  );
}
