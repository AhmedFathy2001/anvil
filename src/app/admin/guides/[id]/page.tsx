import { notFound, redirect } from 'next/navigation';

import { clanGuideActor } from '@/lib/guideAccess';
import { clanHref } from '@/lib/clanPath';
import { getScopedGuide } from '@/lib/guides';
import { guideSiteUrl } from '@/lib/guidePosting';
import { configuredOrigin } from '@/lib/request-origin';
import GuideEditor from '@/components/guides/GuideEditor';

export const metadata = { title: 'Edit guide' };

export default async function AdminGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await clanGuideActor();
  if (!actor) redirect(await clanHref('/admin/dashboard'));
  const guide = await getScopedGuide(Number((await params).id), actor.clan.id);
  if (!guide) notFound();
  return (
    <GuideEditor
      scope="clan"
      guideId={guide.id}
      listHref="/admin/guides"
      origin={configuredOrigin()}
      siteHref={`/guides/${guide.slug}`}
      siteUrl={guideSiteUrl(actor.clan.slug, guide.slug)}
    />
  );
}
