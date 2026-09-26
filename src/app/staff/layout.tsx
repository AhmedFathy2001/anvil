import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { requirePlatformPage } from '@/lib/platformAccess';
import { libraryActor } from '@/lib/guideAccess';
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
  if (!actor) {
    // A LIBRARY GUIDE EDITOR holds no platform role — the grant is lateral, and on purpose. They get
    // /staff/guides and nothing else: this shell is the only thing standing between them and every
    // other /staff page, most of which do not guard themselves, so anything else is still a 404.
    const guides = await libraryActor();
    const pathname = (await headers()).get('x-anvil-pathname') ?? '';
    if (!guides?.canEdit || !(pathname === '/staff/guides' || pathname.startsWith('/staff/guides/'))) notFound();
    const me = await db.query.users.findFirst({
      where: eq(users.id, guides.user.userId),
      columns: { displayName: true, discordId: true, discordAvatar: true },
    });
    return (
      <div className="lg:flex lg:gap-6">
        <AdminSidebar
          groups={[{ label: 'Platform', items: [{ href: '/staff/guides', label: 'Guide library', icon: '📖', matchPrefix: true }] }]}
          user={{
            displayName: me?.displayName ?? guides.user.username ?? 'Editor',
            role: 'library guide editor',
            avatarUrl: me?.discordId ? avatarUrl(me.discordId, me.discordAvatar) : null,
          }}
        />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  }

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
        // Read-only, and shown to support too: seeing what was done is the least dangerous thing an
        // operator can do, and the one most often needed when somebody asks why.
        // Reports about the product, from every clan. Was a triage queue in each clan's own admin
        // area, which asked every clan admin to look after a queue that was never theirs.
        { href: '/staff/feedback', label: 'Feedback', icon: '💬', matchPrefix: true },
        // What broke, across every clan. The platform had no way to learn it was failing except a
        // member posting in Discord; this is the surface the hourly digest links back to.
        { href: '/staff/errors', label: 'Errors', icon: '⚠', matchPrefix: true },
        { href: '/staff/audit', label: 'Operator log', icon: '⧉', matchPrefix: true },
        // The Anvil guide library every clan sees and copies from.
        { href: '/staff/guides', label: 'Guide library', icon: '📖', matchPrefix: true },
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
