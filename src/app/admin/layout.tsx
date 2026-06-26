import { db } from '@/db';
import { clanMembers, users } from '@/db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { avatarUrl } from '@/lib/discord-oauth';
import AdminSidebar, { type SidebarGroup } from './_components/AdminSidebar';

// Admin shell — wraps every page under /admin (including the login page).
// On the login page there's no session yet, so the sidebar is skipped and the
// child renders centered as before. Authenticated admin/mod pages get the
// two-column layout with a contextual sidebar.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyUser();
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    // No session (or wrong role) — render plain children. /admin itself is the
    // login page, so this is the expected path for unauthed users.
    return <>{children}</>;
  }

  const userRow = session.userId > 0
    ? await db.query.users.findFirst({
        where: eq(users.id, session.userId),
        columns: { displayName: true, discordId: true, discordAvatar: true },
      })
    : null;

  const provisionalCount = await db
    .select({ c: count() })
    .from(clanMembers)
    .where(and(eq(clanMembers.provisional, 1), isNull(clanMembers.leftAt)))
    .then((r) => r[0]?.c ?? 0);

  const isAdmin = session.role === 'admin';
  const isMod = session.role === 'moderator';

  const groups: SidebarGroup[] = [];

  // Overview is everyone's landing tile.
  groups.push({
    label: 'Overview',
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: '⌂' }],
  });

  // Bingo events — admin only (mods don't manage events).
  if (isAdmin) {
    groups.push({
      label: 'Events',
      items: [
        { href: '/admin/events', label: 'All events', icon: '🎯', matchPrefix: true },
        { href: '/admin/schedule', label: 'Schedule', icon: '📅' },
      ],
    });
  } else if (isMod) {
    groups.push({
      label: 'Events',
      items: [{ href: '/admin/schedule', label: 'Schedule', icon: '📅' }],
    });
  }

  // Weekly is shared
  groups.push({
    label: 'Weekly',
    items: [{ href: '/admin/weekly', label: 'Competitions', icon: '🏆', matchPrefix: true }],
  });

  // Clan management — both roles.
  groups.push({
    label: 'Clan',
    items: [
      { href: '/admin/clan', label: 'Roster', icon: '🛡️' },
      { href: '/admin/clan/audit', label: 'Audit log', icon: '📜' },
      {
        href: '/admin/verifications',
        label: 'Verifications',
        icon: '✓',
        badge: provisionalCount,
      },
    ],
  });

  // Fee collection queue — visible to admin + moderator (treasurer routing is
  // gated downstream). Sign-up fees flow through here.
  groups.push({
    label: 'Money',
    items: [{ href: '/admin/fees', label: 'Fees', icon: '💰' }],
  });

  // Players + staff — admin only.
  if (isAdmin) {
    groups.push({
      label: 'People',
      items: [
        { href: '/admin/users', label: 'Staff', icon: '🔑' },
      ],
    });
    groups.push({
      label: 'System',
      items: [{ href: '/admin/integrations', label: 'Integrations', icon: '🔌' }],
    });
  }

  const user = {
    displayName: userRow?.displayName ?? session.username ?? 'Admin',
    role: session.role,
    avatarUrl: userRow?.discordId ? avatarUrl(userRow.discordId, userRow.discordAvatar) : null,
  };

  return (
    <div className="lg:flex lg:gap-6">
      <AdminSidebar groups={groups} user={user} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
