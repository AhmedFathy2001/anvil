'use client';

import { useState } from 'react';
import { useClanHref } from '@/lib/useClanPath';

/**
 * Copies a full, clan-prefixed link to a page — the thing an admin pastes into Discord.
 *
 * Built from the clan's canonical address (useClanHref) rather than whatever URL the admin happens
 * to be on, for the same reason as TeamInvitePanel's copy: an apex link is a second address for the
 * clan's page. If the clipboard refuses, the link is shown so it can be copied by hand.
 */
export default function CopyLinkButton({
  path,
  label = 'Copy link',
  className = 'px-2.5 py-1 text-xs rounded-lg border border-gold/40 text-gold hover:border-gold hover:bg-gold/10 transition-colors',
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const href = useClanHref();
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  async function copy() {
    const full = `${window.location.origin}${href(path)}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setManual(full);
    }
  }

  return (
    <>
      <button type="button" onClick={copy} className={className}>
        {copied ? 'Copied ✓' : label}
      </button>
      {manual && <span className="text-xs text-text-muted break-all select-all">{manual}</span>}
    </>
  );
}
