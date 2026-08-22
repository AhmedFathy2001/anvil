import type { Metadata } from "next";
import { clanPrefix, currentClan } from '@/lib/clanContext';
import { Geist, Geist_Mono } from "next/font/google";
import { verifyUser } from "@/lib/auth";
import { db } from "@/db";
import { users as usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { avatarUrl } from "@/lib/discord-oauth";
import { getDiscordInviteUrl } from "@/lib/pluginConfig";
import { APP_VERSION, GIT_SHA } from "@/lib/serverInfo";
import { Analytics } from "@vercel/analytics/next";
import SiteNav from "@/components/SiteNav";
import { countLiveTeamInvolvements } from "@/lib/myTeamNav";
import { clansOfPerson } from "@/lib/myClans";
import PlatformRail, { type RailClan } from "@/components/PlatformRail";
import "./globals.css";
import ClanLink, { ClanPrefixProvider } from '@/components/ClanLink';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anvil — OSRS Clan Events",
  description: "Where your clan's bingos, SotW/BotW, and roster all come together. Built for Old School RuneScape clans.",
  icons: { icon: [{ url: "/favicon-32.png", sizes: "32x32" }, { url: "/icon-192.png", sizes: "192x192" }] },
};

/**
 * Which of a person's clans to show first.
 *
 * A member seat is the clan they belong to; the rest are places they visit. Guesting into other
 * clans' events is meant to be ordinary, so this list can be long, and the ordering is what keeps it
 * usable: your own clan, then staff seats, then everything else alphabetically.
 */
function railOrder(clans: { slug: string; name: string; seat: string | null; staff: boolean }[]): RailClan[] {
  const rank = (c: { seat: string | null; staff: boolean }) =>
    c.seat === 'member' ? 0 : c.staff ? 1 : 2;
  return [...clans]
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .map((c) => ({ slug: c.slug, name: c.name }));
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Null on the apex, which is a legitimate place to be: the directory and the platform surfaces
  // belong to no clan. The shell renders without clan branding rather than failing.
  const clan = await currentClan();
  const session = await verifyUser();
  let userRow: { displayName: string; discordId: string | null; discordAvatar: string | null; role: string } | null = null;
  if (session?.userId) {
    const found = await db.query.users.findFirst({
      where: eq(usersTable.id, session.userId),
      columns: { displayName: true, discordId: true, discordAvatar: true, role: true },
    });
    if (found) userRow = found;
  }
  // "My Team" only appears when there's something of theirs to reach — a live team, a captain seat,
  // or an open sign-up. Between events that's nobody, and a nav item whose page says "you're not on
  // a team" isn't navigation.
  const myTeams = session?.userId && clan ? await countLiveTeamInvolvements(clan.id, session.userId) : 0;

  const avatar = userRow?.discordId ? avatarUrl(userRow.discordId, userRow.discordAvatar) : null;
  // Any staff role gets the Admin link — it lands on /admin/dashboard, which every staff role can
  // reach; middleware + the admin sidebar scope what each sees from there. Must mirror the role set
  // gated in src/middleware.ts (admin, treasurer, moderator, editor) or a role with access would
  // have no visible way in (the bug this fixes: treasurers and editors were silently link-less).
  const staffRoles = ['admin', 'treasurer', 'moderator', 'editor'];
  const isStaff = !!session?.role && staffRoles.includes(session.role);

  // Clan-specific Discord invite: admin-configurable (settings) with an env fallback. The link is
  // hidden entirely when neither is set, so a fresh self-hosted instance shows no dead link.
  const discordInvite = clan ? await getDiscordInviteUrl(clan.id) : null;

  // Awaited HERE rather than inline in the JSX below. `<ClanPrefixProvider prefix={await …}>` put a
  // suspend point in the middle of the element tree, and the server then streamed the shell in a
  // different shape than the client rebuilt it — the hydration diff showed <main> on the client
  // where the server had already opened the page's own <div>. React responds to that by throwing the
  // server HTML away and re-rendering the whole tree, which is why the FIRST click on any link did
  // nothing: it landed on markup that was being replaced. Awaiting before the return keeps the tree
  // synchronous once it starts.
  const prefix = await clanPrefix();

  // The person's clans, so the header can say where you are and offer the rest of what is yours.
  // Only for someone signed in — a stranger has none, and asking costs two queries.
  const myClans = session ? await clansOfPerson(session.playerId, session.userId) : [];
  const otherClans = myClans
    .filter((c) => c.slug !== clan?.slug)
    .map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <html lang="en">
      <body
        // Extensions write attributes onto <body> before React hydrates — ColorZilla's
        // `cz-shortcut-listen`, and password managers and grammar checkers do the same. React counts
        // that as a mismatch, throws the server HTML away and regenerates the tree, and the first
        // click on any link lands on markup being replaced and does nothing. Suppression is scoped
        // to THIS element's attributes; children are still checked normally, so a real mismatch
        // inside the page is not hidden by it.
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen flex-col`}
      >
        {/* The clan prefix, read from the header middleware set and handed to every ClanLink below.
            It cannot be recovered further down: middleware rewrites /c/<slug>/x to /x before Next
            routes it, so by render time the framework's path no longer has it. */}
        <ClanPrefixProvider prefix={prefix}>
        {/* ONE NAV PER PLACE. The apex gets a rail of what the PLATFORM has; a clan keeps the top
            nav it always had. They were the same component until now, which is why the apex offered
            Events and Members — clan pages that 404 there because the apex has no roster. */}
        {!clan ? (
          <div className="flex flex-1 flex-col md:flex-row">
            <PlatformRail
              clans={railOrder(myClans)}
              signedIn={!!session}
              displayName={userRow?.displayName ?? null}
            />
            {/* Padding lives HERE, not on each page. Moving it onto the pages left every apex
                surface I did not personally touch — guides, records, profile, /u, /p — jammed
                against the rail with no margin at all. The landing bleeds out of it deliberately. */}
            <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
          </div>
        ) : (
        <>
        <nav className="border-b-2 border-gold/20 bg-gradient-to-b from-card-bg to-background sticky top-0 z-50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between relative">
            {/* The wordmark goes to the clan you are in, not the apex. Pointing it at '/' made the
                one control every site puts you "home" with the one that ejected you from the clan. */}
            <ClanLink href={clan ? `/c/${clan.slug}` : '/'} className="flex items-center gap-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-48.png" alt="" width={24} height={24} className="rounded" />
              <span className="text-gold font-bold text-lg group-hover:text-gold-light transition-colors">
                Anvil
              </span>
            </ClanLink>
            <SiteNav
              clan={clan ? { slug: clan.slug, name: clan.name } : null}
              otherClans={otherClans}
              signedIn={!!session}
              myTeams={myTeams}
              isStaff={isStaff}
              discordInvite={discordInvite}
              user={session && userRow ? { displayName: userRow.displayName, avatarUrl: avatar } : null}
            />
          </div>
        </nav>
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex-1">
          {children}
        </main>
        </>
        )}
        {/*
          AUTHOR ATTRIBUTION — required by LICENSE (PolyForm Noncommercial 1.0.0 + Attribution).
          The "Built by Ahmed Fathy" credit and its link must remain visible in any deployment or
          derivative work. There is no longer any donation-link carve-out: nothing in this footer
          block is optional.
        */}
        <footer className="border-t border-card-border mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-text-muted">
            <p>
              Built by{" "}
              <a
                href="https://github.com/AhmedFathy2001"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:text-gold-light font-medium transition-colors"
              >
                Ahmed Fathy
              </a>
              {" · "}
              <a
                href="https://github.com/AhmedFathy2001/anvil"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Anvil is source-available
              </a>
              {" · "}
              <span title={`build ${GIT_SHA}`}>v{APP_VERSION}</span>
            </p>
            <div className="flex items-center gap-4">
              <ClanLink href="/guide" className="hover:text-foreground transition-colors">
                Guides
              </ClanLink>
              <ClanLink href="/feedback" className="hover:text-foreground transition-colors">
                Feedback &amp; bug reports
              </ClanLink>
            </div>
          </div>
        </footer>
        <Analytics />
        </ClanPrefixProvider>
      </body>
    </html>
  );
}
