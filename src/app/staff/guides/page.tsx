import { notFound } from 'next/navigation';

import { libraryActor } from '@/lib/guideAccess';
import LibraryAdminClient from './LibraryAdminClient';

export const metadata = { title: 'Guide library' };

export default async function StaffGuidesPage() {
  const actor = await libraryActor();
  if (!actor) notFound();
  return <LibraryAdminClient canEdit={actor.canEdit} />;
}
