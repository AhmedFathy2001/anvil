import { notFound } from 'next/navigation';

import { libraryActor } from '@/lib/guideAccess';
import ProposalQueueClient from './ProposalQueueClient';

export const metadata = { title: 'Guide proposals' };

export default async function StaffProposalsPage() {
  if (!(await libraryActor())) notFound();
  return <ProposalQueueClient />;
}
