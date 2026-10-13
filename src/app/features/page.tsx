import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { isApexHost } from '@/lib/clanContext';
import { ANVIL_DEFINITION, FEATURE_PAGES, GENERAL_FAQ } from '@/lib/answers';
import { JsonLd, faqLd } from '@/lib/jsonLd';
import { socialMetadata } from '@/lib/seo';
import ClanLink from '@/components/ClanLink';
import Faq from '@/components/landing/Faq';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = socialMetadata({
  title: 'Features — OSRS Clan Bingo, SOTW/BOTW & Clan vs Clan — Anvil',
  description: ANVIL_DEFINITION,
  canonical: '/features',
});

/** /features — the index of lib/answers' pages, and the full FAQ. Apex only. */
export default async function FeaturesIndex() {
  if (!isApexHost((await headers()).get('host'))) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <JsonLd data={faqLd(GENERAL_FAQ)} />
      <header className="mb-10">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-gold/85">Features</p>
        <h1 className="display display-lg mt-2 text-[clamp(1.8rem,4vw,2.4rem)] font-semibold [text-wrap:balance]">
          What Anvil does
        </h1>
        <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-text-muted">{ANVIL_DEFINITION}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURE_PAGES.map((p) => (
          <ClanLink
            key={p.slug}
            href={`/features/${p.slug}`}
            className="rounded-xl border border-card-border bg-card-bg p-5 transition-colors hover:border-gold-dark"
          >
            <h2 className="text-[15.5px] font-semibold">{p.h1}</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-muted">{p.summary}</p>
          </ClanLink>
        ))}
      </div>

      <section className="mt-14">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="molten h-5 w-1 shrink-0 rounded-sm" />
          <h2 className="text-[17px] font-semibold">Questions</h2>
        </div>
        <Faq items={GENERAL_FAQ} />
      </section>
    </div>
  );
}
