import type { Metadata } from 'next';
import { AccessTable, GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict, guideHref } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { items, rows, rt } from '../_i18n/rich';

// Who can do what in a clan, for the owner or admin handing jobs out. The rules it describes live in
// lib/clanRoles (canGrantRole, canModify), lib/adminAccess (which admin pages a grant reaches), the
// admin layout's sidebar, api/admin/users/[userId] (role changes) and the per-event grants in
// lib/eventEditors and lib/teamStaff. When one of those changes, the access table here has to too.
//
// Section ids are also the Discord /setup outline (lib/discordGuides GUIDE_OUTLINES.staffroles).
export const STAFF_SECTIONS = ['roles', 'assign', 'who', 'table', 'event', 'safety'] as const;

export async function staffRolesGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'staff-roles', t.staffRoles.metaTitle, t.staffRoles.metaDescription);
}

export default async function StaffRolesGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const s = t.staffRoles;
  const { locale, languages, notice } = localeChrome(lang, 'staff-roles', t.common);
  const v = {
    peopleGuide: guideHref(locale.code, 'people'),
    moderatorGuide: guideHref(locale.code, 'moderator'),
  };

  const SECTIONS = STAFF_SECTIONS.map((id, i) => ({ id, n: i + 1, title: s[id].title }));

  return (
    <GuideShell
      eyebrow={s.eyebrow}
      title={s.title}
      sections={SECTIONS}
      minutes={6}
      locale={{ code: locale.code, dir: locale.dir }}
      labels={t.common}
      languages={languages}
      notice={notice}
      dek={rt(s.dek, v)}
      facts={s.facts}
      footnote={rt(s.footnote, v)}
    >
      <Section id="roles" n={1} title={s.roles.title} labels={t.common}>
        <p className="text-text-muted">{rt(s.roles.intro, v)}</p>
        <Rows rows={rows(s.roles.rows, v)} />
        <p className="text-text-muted">{rt(s.roles.outro, v)}</p>
      </Section>

      <Section id="assign" n={2} title={s.assign.title} labels={t.common}>
        <p className="text-text-muted">{rt(s.assign.intro, v)}</p>
        <ol className="list-decimal space-y-1.5 ps-5 text-sm text-text-muted">{items(s.assign.steps, v)}</ol>
        <p className="text-text-muted">{rt(s.assign.outro, v)}</p>
        <Note tag={s.assign.note.tag}>
          <p>{rt(s.assign.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="who" n={3} title={s.who.title} labels={t.common}>
        <p className="text-text-muted">{rt(s.who.intro, v)}</p>
        <Rows rows={rows(s.who.rows, v)} />
        <Note tag={s.who.note.tag}>
          <p>{rt(s.who.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="table" n={4} title={s.table.title} labels={t.common}>
        <p className="text-text-muted">{rt(s.table.intro, v)}</p>
        <AccessTable
          areaLabel={s.table.areaLabel}
          columns={s.table.columns}
          rows={s.table.rows.map((r) => ({ area: rt(r.area, v), cells: r.cells.map((c) => rt(c, v)) }))}
        />
        <Note tag={s.table.note.tag}>
          <p>{rt(s.table.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="event" n={5} title={s.event.title} labels={t.common}>
        <p className="text-text-muted">{rt(s.event.intro, v)}</p>
        <Rows rows={rows(s.event.rows, v)} />
        <Note tag={s.event.note.tag}>
          <p>{rt(s.event.note.body, v)}</p>
        </Note>
      </Section>

      <Section id="safety" n={6} title={s.safety.title} labels={t.common}>
        <p className="text-text-muted">{rt(s.safety.intro, v)}</p>
        <Rows rows={rows(s.safety.rows, v)} />
      </Section>
    </GuideShell>
  );
}
