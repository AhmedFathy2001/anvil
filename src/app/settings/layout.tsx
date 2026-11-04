import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { verifyUser } from '@/lib/auth';
import { detectedFor, settingsCharacters } from '@/lib/settingsData';
import { supporterForUser } from '@/lib/supporter';
import { claimsOnMyCharacters, unreadNoticeCount } from '@/lib/ownershipClaims';
import { SettingsNav } from './_client';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * /settings — every setting a person has, in one place.
 *
 * These used to be spread over the apex /profile (sharing, announcements, webhooks, Supporter), each
 * clan's locker (main character, remove, home clan, the security drawer), a character's public page
 * (hide in-game clan) and the apex home (discover boards). Which page held a control depended on
 * which page its author was standing on, so finding one meant knowing that history.
 *
 * A platform path, never clan-prefixed: nothing here belongs to a clan, and the per-clan choices
 * (announce here, leave, home clan) sit under the character they are about.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await verifyUser();
  if (!session) redirect('/login?return=%2Fsettings');

  const [characters, supporter, claimsOnMine, unread] = await Promise.all([
    session.playerId ? settingsCharacters(session.playerId) : Promise.resolve([]),
    supporterForUser(session.userId),
    session.playerId ? claimsOnMyCharacters(session.playerId).catch(() => []) : Promise.resolve([]),
    unreadNoticeCount(session.userId).catch(() => 0),
  ]);
  const detected = await detectedFor(session.userId, characters);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0">
          <SettingsNav
            characters={characters.map((c) => ({ accountId: c.accountId, rsn: c.rsn, isPrimary: c.isPrimary }))}
            pending={detected.pending.length}
            claims={Math.max(claimsOnMine.filter((c) => c.status === 'open').length, unread)}
            flair={supporter ? { tier: supporter.tier.id, style: supporter.style } : null}
          />
        </aside>
        <main className="min-w-0 max-w-3xl">{children}</main>
      </div>
    </div>
  );
}
