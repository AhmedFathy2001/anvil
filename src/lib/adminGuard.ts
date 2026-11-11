// A page-level copy of the admin layout's gate, for the pages where being wrong is expensive.
//
// The layout decides from the path middleware forwarded. When that path is unknown it now fails
// closed (lib/adminAccess adminGateTarget), but a single gate is still a single point of failure:
// a matcher change or a new rewrite branch that forgets to sign the path and the layout is all
// that's left. A page that knows its own address can ask the same question about it directly.
//
// 404 rather than a redirect: the layout already redirects people to where they belong, so
// reaching this check with no grant means something upstream let them through. Saying nothing
// about the page is the right answer to that.

import { notFound } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import { redirectFor } from '@/lib/adminAccess';

/** 404 unless the signed-in user may open `path` (the page's own address, e.g. `/admin/events/5`). */
export async function requireAdminPath(path: string): Promise<void> {
  const session = await verifyUser();
  if (!session) notFound();
  const target = redirectFor(path, {
    role: session.role,
    canEditTiles: session.canEditTiles,
    editorScope: session.editorScope,
    canEditGuides: session.canEditGuides,
    treasurerScope: session.treasurerScope,
  });
  if (target && target !== path) notFound();
}
