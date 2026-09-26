import { notFound } from 'next/navigation';

import { libraryActor } from '@/lib/guideAccess';
import { configuredOrigin } from '@/lib/request-origin';
import ProposalReviewClient from './ProposalReviewClient';

export const metadata = { title: 'Review proposal' };

export default async function ReviewProposalPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await libraryActor())) notFound();
  return <ProposalReviewClient id={Number((await params).id)} origin={configuredOrigin()} />;
}
