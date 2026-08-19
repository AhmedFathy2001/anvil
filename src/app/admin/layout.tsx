import { headers } from 'next/headers';
import { redirectFor } from '@/lib/adminAccess';
import { atLeast, isStaffRole } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { clanRoster, users } from '@/db/schema';
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

  // THE GATE. It used to be ninety lines of middleware deciding from the role baked into the session
  // cookie; it runs here because only this layer can ask the database whose clan this host is and
  // what this person holds in it. Middleware still refuses an unsigned or stale session at the edge,
  // which is the most it can honestly judge.
  //
  // A REDIRECT, NOT plain children. Falling through to render the page was safe only while
  // middleware blocked the request first — every admin page would otherwise render for anyone with
  // a session, and most of them carry no guard of their own.
  const pathname = (await headers()).get('x-anvil-pathname') ?? '';
  if (!session) redirect('/login?return=' + encodeURIComponent(pathname || '/admin'));

  const access = { role: session.role, canEditTiles: session.canEditTiles, editorScope: session.editorScope };
  const target = redirectFor(pathname || '/admin/dashboard', access);
  if (target && target !== pathname) redirect(target);

  // Moderator-or-better, or the authoring capability: anything less was turned away above.
  const isStaffHere = isStaffRole(session.role) || session.canEditTiles;
  if (!isStaffHere) redirect('/');

  const userRow = session.userId > 0
    ? await db.query.users.findFirst({
        where: eq(users.id, session.userId),
        columns: { displayName: true, discordId: true, discordAvatar: true },
      })
    : null;

  const clan = await requireClan();
  const provisionalCount = await db
    .select({ c: count() })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.provisional, 1), isNull(clanRoster.leftAt)))
    .then((r) => r[0]?.c ?? 0);

  const isAdmin = atLeast(session.role, 'admin');
  // An authoring grant without a tier: their whole world is the boards they hold. Give them ONLY
  // "My boards"; no dashboard, weekly, clan or schedule. The path gate above already enforced it.
  const isScopedEditor = !isStaffRole(session.role) && session.canEditTiles;
  if (isScopedEditor) {
    const scopedGroups: SidebarGroup[] = [
      {
        label: 'Events',
        items: [{ href: '/admin/events', label: 'My boards', icon: '🎯', matchPrefix: true }],
      },
    ];
    const scopedUser = {
      displayName: userRow?.displayName ?? session.username ?? 'Editor',
      role: 'board editor',
      avatarUrl: userRow?.discordId ? avatarUrl(userRow.discordId, userRow.discordAvatar) : null,
    };
    return (
      <div className="lg:flex lg:gap-6">
        <AdminSidebar groups={scopedGroups} user={scopedUser} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  }

  // Who can open the event pages (/admin/events) — admins manage everything, editors open a
  // board's Tiles tab. Mirrors the middleware gate; mods/treasurers are blocked there, so we don't
  // show them an "All events" item that would just bounce back to the dashboard.
  const canManageEvents = isAdmin || session.canEditTiles;

  const groups: SidebarGroup[] = [];

  // Overview is everyone's landing tile.
  groups.push({
    label: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: '⌂' },
      { href: '/admin/feedback', label: 'Feedback', icon: '💬', matchPrefix: true },
    ],
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
      // The task catalogue boards are generated from — same authority as tile authoring, so every
      // editor (scoped ones included) gets it.
      ...(canManageEvents ? [{ href: '/admin/tile-library', label: 'Task library', icon: '📚' }] : []),
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
        { href: '/admin/announce', label: 'Announce', icon: '📣' },
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
      <div className="flex-1 min-w-0">
        {session.actingAs && (
          // Borrowed authority, said out loud. An operator working inside someone else's clan should
          // never be able to forget that is what they are doing — and the clan's own audit log
          // already carries the same fact, so this is the half the operator sees.
          <div className="mb-4 rounded-xl border border-amber-700 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            You are acting as staff of <span className="font-semibold">{clan.name}</span> on a
            temporary platform grant, not a role in this clan. It expires{' '}
            {session.actingAs.expiresAt.replace('T', ' ').slice(0, 16)} UTC and this clan can see it
            in their history.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
