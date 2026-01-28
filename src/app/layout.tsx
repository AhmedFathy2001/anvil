import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "OSRS Bingo Tracker",
  description: "Old School RuneScape Bingo Team Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b-2 border-gold/20 bg-gradient-to-b from-card-bg to-background sticky top-0 z-50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl">🎯</span>
              <span className="text-gold font-bold text-lg group-hover:text-gold-light transition-colors">
                OSRS Bingo
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
                href="/captain"
                className="px-3 py-1.5 rounded-md text-sm text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
              >
                Captain
              </Link>
              <Link
                href="/player"
                className="px-3 py-1.5 rounded-md text-sm text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
              >
                Player
              </Link>
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md text-sm text-gold/70 hover:text-gold hover:bg-gold/10 transition-all"
              >
                Admin
              </Link>
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
