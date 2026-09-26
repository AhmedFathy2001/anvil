import { notFound } from 'next/navigation';

import { verifyUser } from '@/lib/auth';
import { getScopedGuide } from '@/lib/guides';
import { getProposal } from '@/lib/guideProposals';
import { configuredOrigin } from '@/lib/request-origin';
import ProposalEditor from '@/components/guides/ProposalEditor';
import { listCategories } from '@/lib/guideCategoryStore';

export const metadata = { title: 'Guide proposal' };

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await verifyUser();
  const p = user ? await getProposal(Number((await params).id)) : null;
  // Someone else's proposal is not found, not forbidden.
  if (!p || p.proposerUserId !== user!.userId) notFound();
  const target = p.targetGuideId ? await getScopedGuide(p.targetGuideId, null) : null;
  return (
    <ProposalEditor
      initial={{ title: p.title, summary: p.summary, category: p.category, coverUrl: p.coverUrl, body: p.body }}
      proposal={{ id: p.id, status: p.status, reviewNote: p.reviewNote, note: p.note }}
      target={target ? { id: target.id, title: target.title, summary: target.summary, body: target.body } : null}
      origin={configuredOrigin()}
      // Proposals are for the library: platform categories only.
      categories={(await listCategories(null)).filter((c) => !c.archived)}
    />
  );
}
