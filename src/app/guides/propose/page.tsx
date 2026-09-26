import type { Metadata } from 'next';

import ClanLink from '@/components/ClanLink';
import { verifyUser } from '@/lib/auth';
import { clanGuideActor } from '@/lib/guideAccess';
import { getScopedGuide } from '@/lib/guides';
import { configuredOrigin } from '@/lib/request-origin';
import ProposalEditor from '@/components/guides/ProposalEditor';
import { listCategories } from '@/lib/guideCategoryStore';

export const metadata: Metadata = { title: 'Propose a guide' };

/**
 * Write a guide for the Anvil library — or, with ?edit=<library guide>, suggest an edit to one.
 * ?from=<clan guide> starts from a clan's own guide, so a clan that improved its copy (or wrote
 * something good) can send it upstream in one click.
 */
export default async function ProposePage({ searchParams }: { searchParams: Promise<{ edit?: string; from?: string }> }) {
  const { edit, from } = await searchParams;
  const user = await verifyUser();
  if (!user) {
    return (
      <div className="max-w-xl rounded-xl border border-card-border bg-card-bg p-6">
        <h1 className="text-xl font-bold text-gold">Sign in to propose a guide</h1>
        <p className="mt-2 text-sm text-text-muted">Proposals carry your name, so the guide team knows who to thank.</p>
        <ClanLink href={`/login?return=${encodeURIComponent('/guides/propose')}`} className="mt-4 inline-block text-gold hover:underline">
          Sign in with Discord →
        </ClanLink>
      </div>
    );
  }

  const target = edit ? await getScopedGuide(Number(edit), null) : null;
  // A clan guide to start from: only one this person may read as clan staff here.
  const actor = from ? await clanGuideActor() : null;
  const source = from && actor ? await getScopedGuide(Number(from), actor.clan.id) : null;
  const start = source ?? (target?.status === 'published' ? target : null);

  return (
    <ProposalEditor
      initial={{
        title: start?.title ?? '',
        summary: start?.summary ?? '',
        category: start?.category ?? 'general',
        coverUrl: start?.coverUrl ?? null,
        body: start?.body ?? '',
      }}
      target={target && target.status === 'published' ? { id: target.id, title: target.title, summary: target.summary, body: target.body } : null}
      origin={configuredOrigin()}
      // Proposals are for the library: platform categories only.
      categories={(await listCategories(null)).filter((c) => !c.archived)}
    />
  );
}
