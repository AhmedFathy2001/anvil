import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { isApexHost } from '@/lib/clanContext';
import { ANVIL_DEFINITION, FEATURE_PAGES, featurePage } from '@/lib/answers';
import { JsonLd, breadcrumbLd, faqLd } from '@/lib/jsonLd';
import { socialMetadata } from '@/lib/seo';
import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import Faq from '@/components/landing/Faq';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = featurePage((await params).slug);
  if (!page) return {};
  return socialMetadata({ title: page.title, description: page.summary, canonical: `/features/${page.slug}` });
}

/**
 * /features/<slug> — one page per search worth answering, apex only.
 *
 * The landing persuades; these state. Each answers one query in its own words ("osrs clan bingo",
 * "skill of the week tracker") with a summary a search engine can quote, three plain sections, and a
 * FAQ whose markup matches what is on the page. All copy is lib/answers.
 */
export default async function FeaturePageRoute({ params }: { params: Promise<{ slug: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const page = featurePage((await params).slug);
  if (!page) notFound();

  const others = FEATURE_PAGES.filter((p) => p.slug !== page.slug);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <JsonLd data={faqLd(page.faq)} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Anvil', path: '/' },
          { name: 'Features', path: '/features' },
          { name: page.h1, path: `/features/${page.slug}` },
        ])}
      />

      <header className="relative mb-10 overflow-hidden">
        <AnvilMark
          size={190}
          className="pointer-events-none absolute -top-10 right-0 hidden text-gold/[0.05] sm:block"
        />
        <p className="relative font-mono text-[10.5px] uppercase tracking-[0.22em] text-gold/85">
          <ClanLink href="/features" className="hover:text-gold-light">
            Features
          </ClanLink>
        </p>
        <h1 className="display display-lg relative mt-2 text-[clamp(1.8rem,4vw,2.4rem)] font-semibold [text-wrap:balance]">
          {page.h1}
        </h1>
        <p className="relative mt-3 max-w-[60ch] text-[16px] leading-relaxed text-text-muted">{page.summary}</p>
      </header>

      <div className="flex flex-col gap-9">
        {page.sections.map((s) => (
          <section key={s.heading}>
            <div className="mb-2 flex items-center gap-2.5">
              <span className="molten h-5 w-1 shrink-0 rounded-sm" />
              <h2 className="text-[17px] font-semibold">{s.heading}</h2>
            </div>
            <p className="ml-4 max-w-[64ch] text-[14.5px] leading-relaxed text-text-muted">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <ClanLink
          href="/clans/new"
          className="rounded-lg bg-gold px-5 py-3 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Start your clan
        </ClanLink>
        {page.guide && (
          <ClanLink
            href={page.guide.href}
            className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
          >
            {page.guide.label}
          </ClanLink>
        )}
        <ClanLink
          href="/pricing"
          className="rounded-lg border border-card-border px-5 py-3 transition-colors hover:border-gold-dark hover:bg-card-bg"
        >
          Pricing
        </ClanLink>
      </div>

      <section className="mt-14">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="molten h-5 w-1 shrink-0 rounded-sm" />
          <h2 className="text-[17px] font-semibold">Questions</h2>
        </div>
        <Faq items={page.faq} />
      </section>

      <section className="mt-14 border-t border-card-border pt-8">
        <p className="max-w-[64ch] text-[13.5px] leading-relaxed text-text-dim">{ANVIL_DEFINITION}</p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px]">
          {others.map((p) => (
            <li key={p.slug}>
              <ClanLink href={`/features/${p.slug}`} className="text-gold hover:text-gold-light">
                {p.h1}
              </ClanLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
