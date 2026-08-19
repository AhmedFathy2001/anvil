import { notFound } from 'next/navigation';

import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';
import { avatarUrl } from '@/lib/discord-oauth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import AdminSidebar, { type SidebarGroup } from '../admin/_components/AdminSidebar';

/**
 * The platform shell — /staff, on the apex only.
 *
 * THE GATE IS HERE AND ALSO ON EVERY ROUTE. This layout keeps a non-operator from rendering any
 * page beneath it, but it protects pages only: middleware never covers /api/*, so each
 * /api/staff/* handler runs `requirePlatformApi` for itself. A guard that exists in one place and
 * is assumed everywhere else is how 18 admin pages ended up relying on a token claim.
 *
 * 404, not 403, and not a redirect to a login. Someone without the role has no business knowing
 * this surface exists, and there is no flow that lands a normal member here by accident.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();

  const row = await db.query.users.findFirst({
    where: eq(users.id, actor.user.userId),
    columns: { displayName: true, discordId: true, discordAvatar: true },
  });

  const canWrite = hasPlatformRole(actor.role, 'staff');

  const groups: SidebarGroup[] = [
    {
      label: 'Platform',
      items: [
        { href: '/staff', label: 'Overview', icon: '◎' },
        { href: '/staff/clans', label: 'Clans', icon: '🏰', matchPrefix: true },
        { href: '/staff/people', label: 'People', icon: '👤', matchPrefix: true },
      ],
    },
  ];

  return (
    <div className="lg:flex lg:gap-6">
      <AdminSidebar
        groups={groups}
        user={{
          displayName: row?.displayName ?? actor.user.username ?? 'Operator',
          // The PLATFORM role, deliberately — this shell must never display a clan role, or the two
          // axes start looking like one ladder.
          role: `platform ${actor.role}`,
          avatarUrl: row?.discordId ? avatarUrl(row.discordId, row.discordAvatar) : null,
        }}
      />
      <div className="flex-1 min-w-0">
        {!canWrite && (
          // Support is read-only. Saying so up front beats letting someone find out by having a
          // button do nothing.
          <div className="mb-4 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm text-gray-300">
            You have <span className="text-gold">support</span> access: everything here is read-only.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
