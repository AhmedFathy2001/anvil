import type { ReactNode } from 'react';

import { SITE } from '@/lib/site';

/**
 * A note from the person who built Anvil, where someone just made a clan or started supporting: who to
 * talk to, and where. Discord is where the conversation happens; the site only opens the door.
 * `joinBack` offers "Join the Anvil Discord" (one consent screen, then back to that path); null hides it.
 */
export default function PersonalNote({
  children,
  contactId,
  joinBack,
  className = '',
}: {
  children: ReactNode;
  contactId: string | null;
  joinBack: string | null;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-card-border bg-brown-dark/40 p-4 text-left ${className}`}>
      <p className="text-sm leading-relaxed text-gray-200">{children}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {joinBack && (
          <a
            // eslint-disable-next-line clan-scope/clan-prefix -- login runs on the apex; start bounces any clan host there itself
            href={`/api/auth/discord/start?anvil=1&return=${encodeURIComponent(joinBack)}`}
            className="rounded-lg bg-[#5865F2] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Join the Anvil Discord
          </a>
        )}
        <a
          href={SITE.supportDiscord}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-card-border px-3 py-2 text-sm text-gray-200 transition-colors hover:border-gold/60"
        >
          Support server
        </a>
        {contactId && (
          <a
            href={`https://discord.com/users/${contactId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-card-border px-3 py-2 text-sm text-gray-200 transition-colors hover:border-gold/60"
          >
            Message me on Discord
          </a>
        )}
      </div>
    </div>
  );
}
