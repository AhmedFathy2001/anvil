import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { isApexHost } from '@/lib/clanContext';
import { listPublishedReleases } from '@/lib/releases';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'What’s new in Anvil',
  description: 'New features, improvements and fixes to the Anvil site and RuneLite plugin.',
  alternates: { canonical: '/changelog' },
};

const SECTIONS = [
  ['added', 'New'],
  ['improved', 'Improved'],
  ['fixed', 'Fixed'],
] as const;

/** Every Anvil release, newest first: site and plugin together, in players' words. */
export default async function ChangelogPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const releases = await listPublishedReleases(100);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="display display-lg text-[clamp(1.8rem,4vw,2.4rem)] font-semibold">What&rsquo;s new in Anvil</h1>
        <p className="mt-2 text-[15px] text-text-muted">
          New features, improvements and fixes, for the site and the RuneLite plugin.{' '}
          <a href={SITE.supportDiscord} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light">
            Follow #anvil-announcements
          </a>{' '}
          to get them in Discord.
        </p>
      </header>
      {releases.length === 0 ? (
        <p className="text-text-muted">The first release notes land here soon.</p>
      ) : (
        <ol className="grid gap-8">
          {releases.map((r) => (
            <li key={r.version} id={`v${r.version}`} className="scroll-mt-24 rounded-2xl border border-card-border bg-card-bg p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">
                  <span className="font-mono text-gold">{r.version}</span> · {r.note.title}
                </h2>
                <span className="text-[13px] text-text-dim">{r.publishedAt.slice(0, 10)}</span>
              </div>
              {r.note.highlights.length > 0 && (
                <ul className="mt-3 grid gap-1 text-[14.5px]">
                  {r.note.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              {SECTIONS.map(([key, label]) =>
                r.note[key].length ? (
                  <section key={key} className="mt-4">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-dim">{label}</h3>
                    <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-[14px] text-text-muted">
                      {r.note[key].map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </section>
                ) : null,
              )}
              {r.note.pluginVersion && (
                <p className="mt-4 text-[12.5px] text-text-dim">Plugin {r.note.pluginVersion}: RuneLite updates it for you.</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
