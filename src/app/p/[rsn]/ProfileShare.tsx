'use client';

import { useState } from 'react';

/**
 * The owner's own view of their character page: the link to hand somebody.
 *
 * A profile that exists to be handed to somebody needs the handing-over to be one click.
 *
 * Only ever rendered for the owner. Everyone else sees the page, which is the point of it.
 */
export default function ProfileShare({ rsn }: { rsn: string }) {
  const [copied, setCopied] = useState(false);

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
    </div>
  );
}
