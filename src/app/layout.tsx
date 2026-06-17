import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { verifyUser } from "@/lib/auth";
import { db } from "@/db";
import { users as usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { avatarUrl } from "@/lib/discord-oauth";
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
  const avatar = userRow?.discordId ? avatarUrl(userRow.discordId, userRow.discordAvatar) : null;
  const isStaff = session?.role === 'admin' || session?.role === 'moderator';

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b-2 border-gold/20 bg-gradient-to-b from-card-bg to-background sticky top-0 z-50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-48.png" alt="" width={24} height={24} className="rounded" />
              <span className="text-gold font-bold text-lg group-hover:text-gold-light transition-colors">
                Anvil
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-sm text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
              >
                Events
              </Link>
              <Link
                href="/weekly"
                className="px-3 py-1.5 rounded-md text-sm text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
              >
                Weekly
              </Link>
              {session && (
                <Link
                  href="/team"
                  className="px-3 py-1.5 rounded-md text-sm text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
                >
                  My Team
                </Link>
              )}
              {isStaff && (
                <Link
                  href="/admin/dashboard"
                  className="px-3 py-1.5 rounded-md text-sm text-gold/70 hover:text-gold hover:bg-gold/10 transition-all"
                >
                  Admin
                </Link>
              )}
              <a
                href="https://discord.gg/xvuhwTGZyR"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 px-3 py-1.5 rounded-md text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Discord
              </a>
              {session && userRow ? (
                <div className="ml-2 flex items-center gap-2 pl-3 border-l border-card-border">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 group px-2 py-1 rounded-md hover:bg-brown-light transition-all"
                    title={userRow.displayName}
                  >
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="" width={24} height={24} className="rounded-full" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs flex items-center justify-center font-semibold">
                        {(userRow.displayName || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm text-foreground/80 group-hover:text-foreground hidden sm:inline">
                      {userRow.displayName}
                    </span>
                  </Link>
                  <a
                    href="/api/auth/logout?return=/"
                    className="px-2 py-1 rounded-md text-xs text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
                    title="Sign out"
                  >
                    ⎋
                  </a>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="ml-2 px-3 py-1.5 rounded-md text-sm bg-gold/10 text-gold hover:bg-gold/20 transition-all border border-gold/30"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
