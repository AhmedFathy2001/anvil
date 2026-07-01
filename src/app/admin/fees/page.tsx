import { redirect } from 'next/navigation';

// The standalone fee queue is retired — fees are now collected inline on each event's
// Sign-ups tab. Kept as a redirect so old links / bookmarks land somewhere sensible.
export default function FeesRedirect() {
  redirect('/admin/events');
}
