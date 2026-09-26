import type { Metadata } from 'next';

import ClanLink from '@/components/ClanLink';
import { currentClan } from '@/lib/clanContext';
import { clanGuideActor } from '@/lib/guideAccess';
import { publicGuides } from '@/lib/guides';
import { GUIDE_CATEGORIES, categoryOf, readingMinutes } from '@/lib/guideCategories';

export async function generateMetadata(): Promise<Metadata> {
  const clan = await currentClan();
  return {
    title: clan ? `Guides · ${clan.name}` : 'OSRS guides',
    description: clan
      ? `In-game guides from ${clan.name}: raids, bosses, money makers and more.`
      : 'Old School RuneScape guides from the Anvil library: raids, bosses, skilling and money makers.',
  };
}

/**
 * In-game guides. On a clan: its own guides and copies, plus the Anvil library guides it hasn't
 * copied. On the apex: the library. The setup guides for Anvil itself live at /guide.
 */
export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const [clan, { cat }] = await Promise.all([currentClan(), searchParams]);
  const all = await publicGuides(clan?.id ?? null);
  const editor = clan ? await clanGuideActor() : null;
  const present = GUIDE_CATEGORIES.filter((c) => all.some((g) => g.guide.category === c.key));
  const shown = cat ? all.filter((g) => g.guide.category === cat) : all;
  const groups = GUIDE_CATEGORIES.map((c) => ({ c, items: shown.filter((g) => g.guide.category === c.key) })).filter((g) => g.items.length);

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gold sm:text-3xl">{clan ? `${clan.name} guides` : 'OSRS guides'}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Raids, bosses, skilling and money makers{clan ? ', written and kept up to date by your clan' : ' from the Anvil library'}.{' '}
            Looking for how to use Anvil itself?{' '}
            <ClanLink href="/guide" className="text-gold hover:underline">
              Setup guides →
            </ClanLink>
          </p>
        </div>
        {editor?.canEdit && (
          <ClanLink href="/admin/guides" className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:text-gold">
            Manage guides
          </ClanLink>
        )}
      </header>

      {present.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Categories">
          <ClanLink
            href="/guides"
            className={`rounded-full border px-3 py-1 text-xs ${!cat ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`}
          >
            All
          </ClanLink>
          {present.map((c) => (
            <ClanLink
              key={c.key}
              href={`/guides?cat=${c.key}`}
              className={`rounded-full border px-3 py-1 text-xs ${cat === c.key ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`}
            >
              {c.icon} {c.label}
            </ClanLink>
          ))}
        </nav>
      )}

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-card-border p-10 text-center text-sm text-text-muted">No guides here yet.</p>
      ) : (
        <div className="space-y-8">
          {groups.map(({ c, items }) => (
            <section key={c.key}>
              <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold">
                <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gold" />
                {c.icon} {c.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ guide: g, origin }) => (
                  <ClanLink
                    key={g.id}
                    href={`/guides/${g.slug}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-card-border bg-card-bg transition-colors hover:border-gold/40"
                  >
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" loading="lazy" className="h-32 w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
                    ) : (
                      <div className="flex h-20 items-center justify-center bg-gradient-to-br from-brown-light/30 to-transparent text-3xl opacity-60">
                        {categoryOf(g.category).icon}
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="mb-1 text-[15px] font-bold group-hover:text-gold-light">{g.title}</div>
                      {g.summary && <p className="mb-3 line-clamp-3 text-[13px] text-text-muted">{g.summary}</p>}
                      <div className="mt-auto flex items-center gap-2 text-[11px] text-text-muted/80">
                        <span>{readingMinutes(g.body)} min read</span>
                        {clan && origin === 'library' && <span className="rounded-full bg-white/5 px-2 py-0.5">Anvil library</span>}
                      </div>
                    </div>
                  </ClanLink>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
