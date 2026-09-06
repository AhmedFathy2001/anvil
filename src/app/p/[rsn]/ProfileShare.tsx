'use client';

import { useState } from 'react';
import ClanLink from '@/components/ClanLink';

/**
 * The owner's own view of their character page: the link, and whether anyone else can open it.
 *
 * A profile that exists to be handed to somebody needs the handing-over to be one click. Sharing was
 * settable — a toggle on /profile — and the page it published said only "shown because this account
 * is shared", which tells the owner a fact and gives them nothing to do with it. So: copy the link
 * when it is public, and go and make it public when it is not.
 *
 * Only ever rendered for the owner. Everyone else sees the page, which is the point of it.
 */
export default function ProfileShare({ rsn, shared }: { rsn: string; shared: boolean }) {
  const [copied, setCopied] = useState(false);

  if (!shared) {
    return (
      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3">
        <span className="text-[13px] text-text-muted">
          Private — only you can see this page.
        </span>
        <ClanLink
          href="/profile"
          className="rounded-lg border border-card-border px-3 py-1.5 text-[12.5px] transition-colors hover:border-gold/50 hover:text-gold"
        >
          Share it →
        </ClanLink>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3">
      <span className="text-[13px] text-text-muted">Anyone with the link can read this.</span>
      <button
        type="button"
        onClick={() => {
          // Built here rather than passed in: the page is rendered on the server, and the origin a
          // reader is actually on is the one worth copying.
          const url = `${window.location.origin}/p/${encodeURIComponent(rsn)}`;
          navigator.clipboard?.writeText(url).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            },
            () => {},
          );
        }}
        className="rounded-lg bg-gold px-3 py-1.5 text-[12.5px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <ClanLink href="/profile" className="text-[12.5px] text-text-muted hover:text-gold">
        Stop sharing
      </ClanLink>
    </div>
  );
}
