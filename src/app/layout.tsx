import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
import "./globals.css";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
  const myTeams = session?.userId ? await countLiveTeamInvolvements(session.userId) : 0;

  const avatar = userRow?.discordId ? avatarUrl(userRow.discordId, userRow.discordAvatar) : null;
  // Any staff role gets the Admin link — it lands on /admin/dashboard, which every staff role can
  // reach; middleware + the admin sidebar scope what each sees from there. Must mirror the role set
  // gated in src/middleware.ts (admin, treasurer, moderator, editor) or a role with access would
  // have no visible way in (the bug this fixes: treasurers and editors were silently link-less).
  const staffRoles = ['admin', 'treasurer', 'moderator', 'editor'];
  const isStaff = !!session?.role && staffRoles.includes(session.role);

  // Clan-specific Discord invite: admin-configurable (settings) with an env fallback. The link is
  // hidden entirely when neither is set, so a fresh self-hosted instance shows no dead link.
  const discordInvite = await getDiscordInviteUrl();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen flex-col`}
      >
        <nav className="border-b-2 border-gold/20 bg-gradient-to-b from-card-bg to-background sticky top-0 z-50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between relative">
            <Link href="/" className="flex items-center gap-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-48.png" alt="" width={24} height={24} className="rounded" />
              <span className="text-gold font-bold text-lg group-hover:text-gold-light transition-colors">
                Anvil
              </span>
            </Link>
            <SiteNav
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
              <Link href="/guide" className="hover:text-foreground transition-colors">
                Guides
              </Link>
              <Link href="/feedback" className="hover:text-foreground transition-colors">
                Feedback &amp; bug reports
              </Link>
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
