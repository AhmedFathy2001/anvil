import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import SubmitSetup from '@/components/guides/SubmitSetup';
import { verifyUser } from '@/lib/auth';
import { currentClan } from '@/lib/clanContext';
import { clanGuideActor } from '@/lib/guideAccess';
import { publicGuideBySlug } from '@/lib/guides';
import { firstGearBlock, tierOf } from '@/lib/guideTiers';

export const metadata: Metadata = { title: 'Submit a setup' };

export default async function SubmitSetupPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tier?: string; clan?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const clan = await currentClan();
  const found = await publicGuideBySlug(clan?.id ?? null, slug);
  if (!found || found.guide.kind === 'route') notFound();
  const user = await verifyUser();
  if (!user) {
    return (
      <p className="mx-auto max-w-xl rounded-xl border border-card-border bg-card-bg p-6 text-sm text-text-muted">
        Sign in to submit a setup.{' '}
        <ClanLink href={`/guides/${slug}`} className="text-gold hover:underline">
          Back to the guide
        </ClanLink>
      </p>
    );
  }
  // A clan pin: only that clan's guide editors, on its own copy.
  const actor = sp.clan === '1' ? await clanGuideActor() : null;
  const clanOnly = !!actor?.canEdit && found.guide.clanId === actor.clan.id;
  return (
    <SubmitSetup
      guide={{ id: found.guide.id, slug: found.guide.slug, title: found.guide.title.split(' — ')[0] }}
      block={firstGearBlock(found.guide.body)}
      initialTier={tierOf(sp.tier)?.key ?? 'intermediate'}
      clanOnly={clanOnly}
    />
  );
}
