'use client';

import { useState } from 'react';

/** Copies this page's address: the link a player pastes into Discord, which unfurls into their card. */
export default function CopyLink({ label = 'Copy share link' }: { label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.origin + window.location.pathname;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('Copy this link', url);
        }
      }}
      className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold/90 transition-colors"
    >
      {copied ? 'Link copied' : label}
    </button>
  );
}
