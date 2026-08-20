import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

export default async function AdminIndexPage() {
  redirect(await clanHref('/admin/dashboard'));
}
