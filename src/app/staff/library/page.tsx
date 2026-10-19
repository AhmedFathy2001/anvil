import { notFound } from 'next/navigation';

import { libraryActor } from '@/lib/guideAccess';
import StaffLibraryClient from './StaffLibraryClient';

export const metadata = { title: 'Task & board library' };

// Anvil's task and board library: curate tasks, look after boards, and review what clans suggest.
// Same authority as the guide library (lib/guideAccess) — staff, or a library editor.
export default async function StaffLibraryPage() {
  const actor = await libraryActor();
  if (!actor) notFound();
  return <StaffLibraryClient canEdit={actor.canEdit} />;
}
