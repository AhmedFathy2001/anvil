import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Staff seats moved to People — who may act for the clan is a fact about people.
export default async function StaffRedirect() {
  redirect(await clanHref('/admin/people/staff'));
}
