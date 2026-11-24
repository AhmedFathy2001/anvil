import { safeImageSrc } from '@/lib/guideMarkdown';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { verifyUser } from '@/lib/auth';
import { currentClan } from '@/lib/clanContext';
import { clanGuideActor } from '@/lib/guideAccess';
import { publicGuideBySlug } from '@/lib/guides';
import { categoryOf, readingMinutes } from '@/lib/guideCategories';
import { listCategories } from '@/lib/guideCategoryStore';
import { guideHeadings } from '@/lib/guideMarkdown';
import { TIERS, splitSegments, type TierKey } from '@/lib/guideTiers';
import GuideBody from '@/components/guides/GuideBody';
import GuidePage, { type SetupWire } from '@/components/guides/GuidePage';
import RouteView from '@/components/guides/RouteView';
import { parseStamp } from '@/lib/dbTime';
import { guideViewer, routeFacts, equivalentsFor, blockItemIds, EMPTY_VIEWER } from '@/lib/guideViewer';
import { ladderFor, loadGuideView } from '@/lib/guideView';
import { canCurateUser, followerCount, listWanted, ranksFor, recordView, followsOf } from '@/lib/guideCommunity';
import { copyCreditLine, helpedLine, writtenByLine } from '@/lib/guideCredit';
import { ownedCounts, ownership, slotOptions } from '@/lib/gearOwnership';
import { supporterForUsers } from '@/lib/supporter';
import { BOSSES } from '@/lib/constants';
import { routeProgress } from '@/lib/guideRoutes';
import type { Guide } from '@/db/schema';

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
  const { guide: g } = found;
  const user = await verifyUser();
  const viewer = user ? await guideViewer(user, { items: true }) : EMPTY_VIEWER;
  if (user) void recordView(user.userId, g.id);
  const cats = await listCategories(clan?.id ?? null);
  const cat = categoryOf(g.category, cats);

  if (g.kind === 'route') {
    const view = await loadGuideView(g, viewer);
    const follow = user ? (await followsOf(user.userId)).find((f) => f.guideId === g.id) : undefined;
    const ids = (view.route?.chapters ?? []).flatMap((c) => c.steps.map((s) => (s.goal.kind === 'item' || s.goal.kind === 'clog' ? s.goal.id : 0))).filter(Boolean);
    const facts = routeFacts(viewer, follow?.manualDone ?? [], equivalentsFor(ids));
    const progress = view.route ? routeProgress(view.route, facts, viewer.account) : null;
    return (
      <RouteView
        guide={{ id: g.id, slug: g.slug, title: g.title, summary: g.summary, categoryLabel: cat.label }}
        route={view.route}
        progress={progress}
        following={!!follow}
        followers={await followerCount(g.id)}
        signedIn={!!user}
        account={viewer.account}
        credit={writtenByLine(view.credits.library)}
      />
    );
  }

  const view = await loadGuideView(g, viewer);
  if (!view.block) return <LegacyGuide guide={g} clanName={clan?.name ?? null} origin={found.origin} catLabel={`${cat.icon} ${cat.label}`} />;

  // Ownership for the Alternatives list (owner-only: the snapshot is the viewer's own).
  const owned = viewer.snapshot ? ownership(ownedCounts(viewer.snapshot), equivalentsFor(blockItemIds(view.block))) : null;
  const setups: SetupWire[] = view.setups.map((s) => ({
    ...s,
    owned: owned ? [...new Set([...['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring', 'quiver'].flatMap((sl) => slotOptions(s.setup, sl as 'head'))])].filter((id) => owned.has(id)) : [],
  }));
  const ladders = Object.fromEntries(await Promise.all(view.setups.filter((s) => !s.community).map(async (s) => [s.key, await ladderFor(s, view.setups, view.block, view.prices)] as const)));

  const top = view.credits.library.slice(0, 3);
  const [ranks, supporters] = await Promise.all([ranksFor(top.map((c) => c.userId)), supporterForUsers(top.map((c) => c.userId)).catch(() => new Map())]);
  const helped = [...ranks.values()].reduce((a, r) => a + r.lifetime, 0);
  const isCopy = g.clanId != null && !!g.sourceGuideId;
  const curate = user ? await canCurateUser(user.userId) : false;
  const editor = clan ? await clanGuideActor() : null;
  const wanted = await listWanted({ guideId: view.libraryId });
  const kcLabel = view.kcKey ? BOSSES.find((b) => b.key === view.kcKey)?.label ?? null : null;

  return (
    <div className="mx-auto max-w-6xl">
      <GuidePage
        guide={{ id: g.id, slug: g.slug, title: g.title, summary: g.summary, body: g.body, updatedAt: g.updatedAt, staleNote: g.staleNote, categoryLabel: cat.label }}
        block={view.block}
        setups={setups}
        ladders={ladders}
        prices={view.prices}
        names={view.names}
        community={view.community}
        tips={view.tips}
        credit={{
          line: view.credits.library.length ? `Written by ${view.credits.library.length} player${view.credits.library.length === 1 ? '' : 's'}${helped ? ` · ${helpedLine(helped)}` : ''}` : '',
          top: top.map((c) => {
            const r = ranks.get(c.userId)?.rank ?? null;
            return { name: c.name, tone: r ? (r.quill as 'bronze' | 'silver' | 'gold') : null, supporter: supporters.has(c.userId), rank: r?.label ?? null };
          }),
          total: view.credits.library.length,
          copyLine: isCopy && !g.followsSource ? copyCreditLine(view.credits.library, view.credits.clan, clan?.name ?? 'the clan') : null,
        }}
        wanted={wanted.map((w) => ({ tier: w.tier, accountType: w.accountType, build: w.build, requesters: w.requesters }))}
        viewer={{
          signedIn: !!user,
          rsn: viewer.rsn,
          account: viewer.account,
          build: viewer.build,
          levels: viewer.levels,
          openTier: view.openTier,
          kc: view.kcKey ? viewer.kc[view.kcKey] ?? null : null,
          snapshotAt: viewer.snapshot ? Object.values(viewer.snapshot).map((c) => c?.readAt ?? '').sort().pop() ?? null : null,
          skipped: [...(viewer.prefs?.skipped.entries() ?? [])].map(([itemId, reason]) => ({ itemId, reason })),
          budgetCap: viewer.prefs?.budgetCap ?? null,
        }}
        canCurate={curate}
        kcLabel={kcLabel}
      />
      {editor?.canEdit && g.clanId === clan?.id && (
        <p className="mt-6 text-xs text-text-muted">
          <ClanLink href={`/admin/guides/${g.id}`} className="text-gold hover:underline">
            Edit this guide
          </ClanLink>{' '}
          · pin a clan-only setup from{' '}
          <ClanLink href={`/guides/${g.slug}/submit?clan=1`} className="text-gold hover:underline">
            Submit
          </ClanLink>
        </p>
      )}
    </div>
  );
}

/** A guide with no setups (clan info, general notes): the original reading layout. */
function LegacyGuide({ guide: g, clanName, origin, catLabel }: { guide: Guide; clanName: string | null; origin: 'clan' | 'library'; catLabel: string }) {
  const segs = splitSegments(g.body);
  const toc = [
    ...segs.filter((s) => !s.tier && s.kind === 'text').flatMap((s) => guideHeadings(s.text).filter((h) => h.level === 2)),
    ...TIERS.filter((t) => segs.some((s) => s.tier === (t.key as TierKey))).map((t) => ({ id: `tier-${t.key}`, text: `${t.emoji} ${t.label}`, level: 2 as const })),
  ];
  const updatedMs = parseStamp(g.updatedAt);
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-8">
      <article className="min-w-0 max-w-3xl">
        <ClanLink href="/guides" className="text-xs text-text-muted hover:text-gold">
          ← All guides
        </ClanLink>
        {g.coverUrl && safeImageSrc(g.coverUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.coverUrl} alt="" referrerPolicy="no-referrer" className="mt-3 max-h-80 w-full rounded-xl border border-card-border object-cover" />
        )}
        <header className="mt-4 mb-5 border-b border-card-border pb-4">
          <div className="mb-1 text-[11px] uppercase tracking-widest text-gold/80">{catLabel}</div>
          <h1 className="text-2xl font-bold text-gold sm:text-3xl">{g.title}</h1>
          {g.summary && <p className="mt-2 text-[15px] text-text-muted">{g.summary}</p>}
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted/80">
            <span>{readingMinutes(g.body)} min read</span>
            {updatedMs != null && <span>Updated {new Date(updatedMs).toISOString().slice(0, 10)}</span>}
            {origin === 'library' && <span className="rounded-full bg-white/5 px-2 py-0.5">From the Anvil library</span>}
            {origin === 'clan' && g.sourceGuideId && <span className="rounded-full bg-white/5 px-2 py-0.5">{g.followsSource ? 'From the Anvil library' : `Adapted from the Anvil library by ${clanName ?? 'the clan'}`}</span>}
            {(origin === 'library' || (g.sourceGuideId && g.followsSource)) && (
              <ClanLink href={`/guides/propose?edit=${origin === 'library' ? g.id : g.sourceGuideId}`} className="text-gold hover:underline">
                Suggest an edit
              </ClanLink>
            )}
          </p>
        </header>
        <div className="text-[15px] leading-relaxed text-gray-200">
          <GuideBody body={g.body} storageKey={`guide:${g.id}`} />
        </div>
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
