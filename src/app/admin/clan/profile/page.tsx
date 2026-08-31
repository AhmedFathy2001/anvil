import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';

// Profile became the Clan hub's front door, so its old sub-path is one hop up.
export default async function ProfileRedirect() {
  redirect(await clanHref('/admin/clan'));
}
