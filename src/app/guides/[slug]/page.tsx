import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { currentClan } from '@/lib/clanContext';
import { clanGuideActor } from '@/lib/guideAccess';
import { publicGuideBySlug } from '@/lib/guides';
import { categoryOf, readingMinutes } from '@/lib/guideCategories';
import { guideHeadings, renderGuide } from '@/lib/guideMarkdown';
import { parseStamp } from '@/lib/dbTime';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const clan = await currentClan();
  const found = await publicGuideBySlug(clan?.id ?? null, slug);
  return { clan, found };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { clan, found } = await load((await params).slug);
  if (!found) return { title: 'Guide not found' };
  const g = found.guide;
  return {
    title: clan ? `${g.title} · ${clan.name}` : g.title,
    description: g.summary || undefined,
    openGraph: { title: g.title, description: g.summary || undefined, images: g.coverUrl ? [g.coverUrl] : undefined },
  };
}

export default async function GuideReadPage({ params }: Props) {
  const { slug } = await params;
  const { clan, found } = await load(slug);
  if (!found) notFound();
  const { guide: g, origin } = found;
  const cat = categoryOf(g.category);
  const toc = guideHeadings(g.body).filter((h) => h.level === 2);
  const editor = clan ? await clanGuideActor() : null;
  const updatedMs = parseStamp(g.updatedAt);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-8">
      <article className="min-w-0 max-w-3xl">
        <ClanLink href="/guides" className="text-xs text-text-muted hover:text-gold">
          ← All guides
        </ClanLink>
        {g.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.coverUrl} alt="" className="mt-3 max-h-80 w-full rounded-xl border border-card-border object-cover" />
        )}
        <header className="mt-4 mb-5 border-b border-card-border pb-4">
          <div className="mb-1 text-[11px] uppercase tracking-widest text-gold/80">
            {cat.icon} {cat.label}
          </div>
          <h1 className="text-2xl font-bold text-gold sm:text-3xl">{g.title}</h1>
          {g.summary && <p className="mt-2 text-[15px] text-text-muted">{g.summary}</p>}
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted/80">
            <span>{readingMinutes(g.body)} min read</span>
            {updatedMs != null && <span>Updated {new Date(updatedMs).toISOString().slice(0, 10)}</span>}
            {origin === 'library' && <span className="rounded-full bg-white/5 px-2 py-0.5">From the Anvil library</span>}
            {origin === 'clan' && g.sourceGuideId && (
              <span className="rounded-full bg-white/5 px-2 py-0.5">
                {g.followsSource ? 'From the Anvil library' : `Adapted from the Anvil library by ${clan?.name ?? 'the clan'}`}
              </span>
            )}
            {editor?.canEdit && origin === 'clan' && (
              <ClanLink href={`/admin/guides/${g.id}`} className="text-gold hover:underline">
                Edit
              </ClanLink>
            )}
          </p>
        </header>
        <div className="text-[15px] leading-relaxed text-gray-200">{renderGuide(g.body)}</div>
      </article>

      {toc.length > 1 && (
        <aside className="hidden lg:block">
          <nav className="sticky top-6 rounded-xl border border-card-border bg-card-bg p-4 text-sm" aria-label="On this page">
            <div className="mb-2 text-[11px] uppercase tracking-widest text-text-muted">On this page</div>
            <ul className="space-y-1.5">
              {toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="text-text-muted hover:text-gold">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      )}
    </div>
  );
}
