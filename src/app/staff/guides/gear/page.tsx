import { notFound } from 'next/navigation';

import { libraryActor } from '@/lib/guideAccess';
import GearAdminClient from './GearAdminClient';

export const metadata = { title: 'Gear calculator data' };

export default async function GearAdminPage() {
  const actor = await libraryActor();
  if (!actor) notFound();
  return <GearAdminClient canEdit={actor.canEdit} />;
}
