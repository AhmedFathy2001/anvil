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
  // Staff roles that get the admin shell — must mirror src/middleware.ts (admin, treasurer,
  // moderator, editor). Treasurer was missing here, so a treasurer rendered admin pages with no
  // sidebar (middleware let them in, but the shell dropped them to plain children).
  const staffRoles = ['admin', 'treasurer', 'moderator', 'editor'];
  if (!session || !staffRoles.includes(session.role)) {
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
  // Who can open the event pages (/admin/events) — admins manage everything, editors open a
  // board's Tiles tab. Mirrors the middleware gate; mods/treasurers are blocked there, so we don't
  // show them an "All events" item that would just bounce back to the dashboard.
  const canManageEvents = isAdmin || session.role === 'editor';

  const groups: SidebarGroup[] = [];

  // Overview is everyone's landing tile.
  groups.push({
    label: 'Overview',
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: '⌂' }],
  });

  // Bingo events + schedule. Schedule is open to every staff role; the event list is admin/editor
  // only (see canManageEvents), so mods/treasurers see just Schedule here.
  groups.push({
    label: 'Events',
    items: [
      ...(canManageEvents
        ? [{ href: '/admin/events', label: 'All events', icon: '🎯', matchPrefix: true }]
        : []),
      { href: '/admin/schedule', label: 'Schedule', icon: '📅' },
    ],
  });

  // Weekly is shared
  groups.push({
    label: 'Weekly',
    items: [{ href: '/admin/weekly', label: 'Competitions', icon: '🏆', matchPrefix: true }],
  });

  // Clan management — one hub (Members · Needs review · Staff · History). The badge
  // surfaces the provisional-member count that used to live on the Verifications item.
  groups.push({
    label: 'Clan',
    items: [
      {
        href: '/admin/clan',
        label: 'Members & staff',
        icon: '🛡️',
        badge: provisionalCount,
        matchPrefix: true,
      },
    ],
  });

  // Fees now live on each event's Sign-ups tab (no standalone queue), so there's no Money
  // group. Treasurers/mods reach them via Events → an event → Sign-ups.

  // System — admin only. (Staff management now lives in the Clan hub.)
  if (isAdmin) {
    groups.push({
      label: 'System',
      items: [
        { href: '/admin/setup', label: 'Setup', icon: '🧭' },
        { href: '/admin/integrations', label: 'Advanced settings', icon: '🔌' },
      ],
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
