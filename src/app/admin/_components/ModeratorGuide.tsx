'use client';

import { usePathname } from 'next/navigation';

import GuidedFlow from '@/components/GuidedFlow';
import { moderatorFlow } from '@/lib/guidedFlows/moderator';

/**
 * The moderator's guide strip (lib/guidedFlows/moderator), drawn by the admin layout from the two
 * counts its sidebar already badges. Client-side only because one step depends on the page: being on
 * the proof queue is what "open the queue" means.
 */
export default function ModeratorGuide({ flaggedProofs, peopleWaiting }: { flaggedProofs: number; peopleWaiting: number }) {
  const pathname = usePathname() ?? '';
  const onQueue = /\/admin\/proofs(\/|$)/.test(pathname);
  return <GuidedFlow view={moderatorFlow({ flaggedProofs, peopleWaiting, onQueue })} />;
}
