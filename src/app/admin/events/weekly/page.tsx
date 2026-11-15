import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// There is no list at /admin/events/weekly: competitions are listed with every other event, and the
// create form is /admin/weekly. Typed or bookmarked, this lands on the events list.
export default async function WeeklyIndexRedirect() {
  redirect(await clanHref('/admin/events'));
}
