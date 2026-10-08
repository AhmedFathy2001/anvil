import type { Metadata } from 'next';
import { GuideShell, Note, Rows, Section } from '../_components/GuideUI';
import { localeChrome } from '../_components/LanguageBar';
import { getDict } from '../_i18n';
import { guideMetadata } from '../_i18n/meta';
import { paragraphs, rows, rt } from '../_i18n/rich';
import { guideCommands, type GuideCommand } from '@/lib/discordCommandGuide';

export async function commandsGuideMetadata(lang: string): Promise<Metadata> {
  const t = await getDict(lang);
  return guideMetadata(lang, 'commands', t.commands.metaTitle, t.commands.metaDescription);
}

// Section ids, in page order. lib/discordGuides mirrors this list for `/guide topic:commands`.
export const COMMANDS_SECTIONS = ['using', 'bingo', 'clan', 'options', 'who', 'trouble'] as const;

type Dict = Awaited<ReturnType<typeof getDict>>;

function CommandCard({ cmd, c }: { cmd: GuideCommand; c: Dict['commands'] }) {
  const l = c.labels;
  const ex = c.examples[cmd.path];
  return (
    <div id={`cmd-${cmd.path.replace(/\s+/g, '-')}`} className="scroll-mt-24 rounded-xl border border-card-border bg-card-bg p-4">
      <div className="font-mono text-[14px] font-semibold text-gold break-words">{cmd.usage}</div>
      <p className="mt-1 text-sm text-text-muted">{cmd.description}</p>
      {ex?.tip && <p className="mt-2 text-sm">{rt(ex.tip)}</p>}

      {ex?.examples?.length ? (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-widest text-text-muted">
            {ex.examples.length > 1 ? l.examples : l.example}
          </div>
          <div className="mt-1 space-y-1">
            {ex.examples.map((e) => (
              <code key={e} className="block rounded-md bg-black/30 px-2.5 py-1.5 font-mono text-[13px]">
                {e}
              </code>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-widest text-text-muted">{l.options}</div>
        {cmd.options.length === 0 ? (
          <p className="mt-1 text-[13px] text-text-muted">{l.noOptions}</p>
        ) : (
          <ul className="mt-1 divide-y divide-card-border rounded-lg border border-card-border">
            {cmd.options.map((o) => (
              <li key={o.name} className="px-3 py-2 text-[13px]">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <code className="font-mono font-semibold">{o.name}</code>
                  <span className={o.required ? 'text-accent-red' : 'text-text-muted'}>
                    {o.required ? l.required : l.optional}
                  </span>
                  <span className="text-text-muted">· {l.kinds[o.kind]}</span>
                  {o.min != null && o.max != null && (
                    <span className="text-text-muted">
                      · {l.range.replace('{min}', String(o.min)).replace('{max}', String(o.max))}
                    </span>
                  )}
                </div>
                <div className="text-text-muted">{o.description}</div>
                {o.choices.length > 0 && o.name !== 'language' && (
                  <div className="mt-1 text-[12px] text-text-muted">
                    {l.choices}: {o.choices.join(' · ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Every slash command, generated from the definitions the bot registers (lib/discordCommandGuide), so
 * the reference can't drift from what Discord actually offers. The prose around it — how options
 * work, who may use what, what to check when it breaks — is the dictionary's, and translates.
 */
export default async function CommandsGuide({ lang }: { lang: string }) {
  const t = await getDict(lang);
  const c = t.commands;
  const { locale, languages, notice } = localeChrome(lang, 'commands', t.common);
  const all = guideCommands();
  const bingo = all.filter((x) => x.group === 'bingo');
  const clan = all.filter((x) => x.group === 'clan');

  const titles: Record<(typeof COMMANDS_SECTIONS)[number], string> = {
    using: c.using.title,
    bingo: c.bingo.title,
    clan: c.clan.title,
    options: c.options.title,
    who: c.who.title,
    trouble: c.trouble.title,
  };
  const SECTIONS = COMMANDS_SECTIONS.map((id, i) => ({ id, n: i + 1, title: titles[id] }));

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
      dek={rt(c.dek)}
      facts={c.facts}
      footnote={rt(c.footnote)}
    >
      <Section id="using" n={1} title={c.using.title} labels={t.common}>
        {paragraphs(c.using.body)}
        <Rows rows={rows(c.using.rows)} />
        <Note tag={c.using.note.tag}>
          <p>{rt(c.using.note.body)}</p>
        </Note>
      </Section>

      <Section id="bingo" n={2} title={c.bingo.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.bingo.intro)}</p>
        <div className="space-y-3">
          {bingo.map((cmd) => (
            <CommandCard key={cmd.path} cmd={cmd} c={c} />
          ))}
        </div>
      </Section>

      <Section id="clan" n={3} title={c.clan.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.clan.intro)}</p>
        <div className="space-y-3">
          {clan.map((cmd) => (
            <CommandCard key={cmd.path} cmd={cmd} c={c} />
          ))}
        </div>
      </Section>

      <Section id="options" n={4} title={c.options.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.options.intro)}</p>
        <Rows rows={rows(c.options.rows)} />
      </Section>

      <Section id="who" n={5} title={c.who.title} labels={t.common}>
        {paragraphs(c.who.body)}
        <Rows rows={rows(c.who.rows)} />
      </Section>

      <Section id="trouble" n={6} title={c.trouble.title} labels={t.common}>
        <p className="text-text-muted">{rt(c.trouble.intro)}</p>
        <Rows rows={rows(c.trouble.rows)} />
      </Section>
    </GuideShell>
  );
}
