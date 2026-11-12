import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { verifyUser } from '@/lib/auth';
import { inboxFor, markRead } from '@/lib/notices';
import { SITE } from '@/lib/site';
import { operatorDiscordId } from '@/lib/welcomeDm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Inbox', robots: { index: false } };

/**
 * Notices from Anvil (lib/notices), the full record behind the bell and the plugin's "From Anvil"
 * card. One-way on purpose: every notice ends in "Reply on Discord", which is where Ahmed answers.
 * Opening the page marks everything read; what was new is still marked as new on this visit.
 */
export default async function InboxPage() {
  const session = await verifyUser();
  if (!session?.userId) redirect('/login?return=/inbox');
  const [{ notices }, contactId] = await Promise.all([inboxFor(session.userId), operatorDiscordId().catch(() => null)]);
  await markRead(session.userId, 'all');
  const reply = contactId ? `https://discord.com/users/${contactId}` : SITE.supportDiscord;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="mt-1 text-sm text-gray-400">Updates from Anvil. Questions or feedback? Reply on Discord, I read everything.</p>
        </div>
        <ClanLink href="/settings/posts#notifications" className="text-sm text-gold hover:text-gold-light">
          Notification settings
        </ClanLink>
      </div>

      {notices.length === 0 ? (
        <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-8 text-center text-sm text-gray-400">
          Nothing here yet. When something changes that you should know about, it shows up here.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {notices.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border bg-card-bg p-5 ${n.level === 'important' ? 'border-gold/50' : 'border-card-border'}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className={`text-base font-semibold ${n.level === 'important' ? 'text-gold' : 'text-gray-100'}`}>
                  {!n.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-gold align-middle" aria-label="New" />}
                  {n.title}
                </h2>
                <time className="shrink-0 text-xs text-gray-500" dateTime={n.createdAt}>
                  {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </time>
              </div>
              {n.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">{n.body}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {n.linkUrl && (
                  <a
                    // eslint-disable-next-line clan-scope/clan-prefix -- a notice's link is an apex page or Discord (lib/noticeRules safeNoticeLink), never a clan path
                    href={n.linkUrl}
                    {...(n.linkUrl.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                    className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
                  >
                    {n.linkLabel || 'Open'}
                  </a>
                )}
                <a
                  href={reply}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-gray-200 transition-colors hover:border-gold/60"
                >
                  Reply on Discord
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
