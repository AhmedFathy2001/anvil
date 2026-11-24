import type { Metadata } from 'next';

import GuidesHome, { type HomeCard, type HomePick } from '@/components/guides/GuidesHome';
import { verifyUser } from '@/lib/auth';
import { currentClan } from '@/lib/clanContext';
import { clanGuideActor } from '@/lib/guideAccess';
import { publicGuides } from '@/lib/guides';
import { categoryOf } from '@/lib/guideCategories';
import { listCategories } from '@/lib/guideCategoryStore';
import { firstGearBlock, TIERS } from '@/lib/guideTiers';
import { guideViewer, kcKeyOf, EMPTY_VIEWER } from '@/lib/guideViewer';
import { bylines, communityCounts, libraryIdOf } from '@/lib/guideCommunity';
import { setupFit, viewerTier } from '@/lib/guideSetups';

export async function generateMetadata(): Promise<Metadata> {
  const clan = await currentClan();
  return {
    title: clan ? `Guides · ${clan.name}` : 'OSRS guides',
    description: clan
      ? `Gear setups for every level from ${clan.name} and the Anvil library: bosses, raids, slayer and skilling.`
      : 'Old School RuneScape gear setups for every level, written by staff and tested by the community. Copy any setup into RuneLite.',
  };
}

/**
 * The Guides home. Without a clan (the apex, or anyone with no clan): the Anvil library. On a clan:
 * its own guides and copies, plus the library guides it hasn't copied (lib/guides publicGuides).
 * The help docs for Anvil itself live at /guide and are linked from the footer.
 */
export default async function GuidesPage() {
  const clan = await currentClan();
  const [all, cats, user] = await Promise.all([publicGuides(clan?.id ?? null), listCategories(clan?.id ?? null), verifyUser()]);
  const viewer = user ? await guideViewer(user) : EMPTY_VIEWER;
  const editor = clan ? await clanGuideActor() : null;
  const libIds = all.map(({ guide }) => libraryIdOf(guide));
  const [counts, by] = await Promise.all([communityCounts([...new Set(libIds)]), bylines(all.map(({ guide }) => guide.id))]);

  const cards: HomeCard[] = all.map(({ guide: g, origin }) => {
    const block = firstGearBlock(g.body);
    const b = by.get(g.id);
    return {
      id: g.id,
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      category: g.category,
      kind: g.kind,
      icon: block?.setups.find((s) => s.pick)?.gear.weapon ?? block?.setups[0]?.gear.weapon ?? null,
      setups: (block?.setups ?? []).map((s) => ({ tier: s.tier, accounts: s.accounts, builds: s.builds, req: s.req, name: s.name, stats: s.stats })),
      community: counts.get(libraryIdOf(g)) ?? 0,
      by: b?.first ? `by ${b.first}${b.count > 1 ? ` +${b.count - 1}` : ''}` : '',
      origin,
    };
  });

  // Picked for you: guides whose boss the reader already kills, most kc first; then ones whose
  // setups they meet for a level. Only for a reader we know something about.
  const picks: HomePick[] = [];
  if (viewer.levels) {
    const scored = all
      .map(({ guide: g }) => {
        const block = firstGearBlock(g.body);
        if (!block) return null;
        const key = kcKeyOf(block);
        const kc = key ? viewer.kc[key] ?? 0 : 0;
        const tier = viewerTier(block.setups, viewer.levels);
        const fits = block.setups.filter((s) => s.tier === tier && setupFit(s, { account: viewer.account, build: viewer.build, levels: viewer.levels }).ok);
        if (!fits.length) return null;
        const s = fits.find((x) => x.pick) ?? fits[0];
        const style = s.stats.ranged >= Math.max(s.stats.attack, s.stats.magic) ? 'Ranged' : s.stats.magic > s.stats.attack ? 'Magic' : 'Melee';
        const main = style === 'Ranged' ? 'ranged' : style === 'Magic' ? 'magic' : 'attack';
        return {
          kc,
          pick: {
            slug: g.slug,
            title: g.title.split(' — ')[0],
            icon: s.gear.weapon ?? null,
            level: `${TIERS.find((t) => t.key === tier)?.label} · ${style}`,
            stat: s.name,
            why: [viewer.levels?.[main] ? `${viewer.levels[main]} ${style === 'Melee' ? 'Attack' : style}` : null, viewer.levels?.defence ? `${viewer.levels.defence} Def` : null, kc ? `${kc.toLocaleString('en-US')} kc so far` : null].filter(Boolean).join(' · '),
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.kc - a.kc);
    picks.push(...scored.slice(0, 4).map((x) => x.pick));
  }

  const known = new Set(cats.map((c) => c.key));
  const categories = [...cats, ...[...new Set(all.map((g) => g.guide.category))].filter((k) => !known.has(k)).map((k) => categoryOf(k))].map((c) => ({ key: c.key, label: c.label, icon: c.icon }));

  return (
    <GuidesHome
      title={clan ? `${clan.name} guides` : 'Guides'}
      intro={`Gear setups for every level, written by ${clan ? 'your clan, the Anvil library' : 'staff'} and tested by the community. Copy any setup straight into RuneLite.`}
      cards={cards}
      categories={categories}
      picks={picks}
      pickedFrom={viewer.rsn}
      level={viewer.levels ? viewerTier([], viewer.levels) : null}
      account={viewer.account}
      build={viewer.build}
      canManage={!!editor?.canEdit}
    />
  );
}
