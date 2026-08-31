import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// The review queue is People's, since it is about the people in the clan rather than the clan
// itself. Kept as a redirect: these links get pasted into Discord, and a 404 reads as "the thing is
// gone" rather than "it moved".
export default async function NeedsReviewRedirect() {
  redirect(await clanHref('/admin/people/needs-review'));
}
