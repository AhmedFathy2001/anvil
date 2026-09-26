import { notFound } from 'next/navigation';

import { libraryActor } from '@/lib/guideAccess';
import { getScopedGuide } from '@/lib/guides';
import { guideSiteUrl } from '@/lib/guidePosting';
import { configuredOrigin } from '@/lib/request-origin';
import GuideEditor from '@/components/guides/GuideEditor';

export const metadata = { title: 'Edit library guide' };

export default async function StaffGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await libraryActor();
  if (!actor) notFound();
  const guide = await getScopedGuide(Number((await params).id), null);
  if (!guide) notFound();
  return (
    <GuideEditor
      scope="library"
      guideId={guide.id}
      listHref="/staff/guides"
      origin={configuredOrigin()}
      siteHref={`/guides/${guide.slug}`}
      siteUrl={guideSiteUrl(null, guide.slug)}
    />
  );
}
