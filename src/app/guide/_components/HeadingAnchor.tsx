'use client';

import { useState } from 'react';

/**
 * The `#` beside a section heading: a link to it, and one click to copy that link.
 *
 * Both, because they are different jobs. Following the anchor is how you move around a long page;
 * copying it is how you answer somebody in Discord with the exact paragraph rather than "it's in
 * the guide somewhere". The href does the first even with JavaScript off, and the click adds the
 * second — the URL is written to the clipboard AND the hash still changes, so the page ends up
 * where the link points and the reader can see what they just copied.
 *
 * Kept quiet until the heading is hovered or the control is focused. A row of hashes down the
 * margin of a page people read straight through is decoration; a keyboard user still reaches it
 * because focus makes it visible.
 */
export default function HeadingAnchor({
  id,
  label,
  copiedLabel,
}: {
  id: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <a
      href={`#${id}`}
      aria-label={label}
      title={label}
      onClick={() => {
        // Never preventDefault: the jump is the behaviour with or without a clipboard. A refused
        // permission or an insecure origin just means the copy half does not happen.
        const url = `${window.location.origin}${window.location.pathname}#${id}`;
        navigator.clipboard?.writeText(url).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          },
          () => {},
        );
      }}
      className="relative text-text-muted/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-gold focus-visible:text-gold"
    >
      #
      {copied && (
        <span className="absolute left-full top-1/2 ms-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-card-border bg-card-bg px-2 py-0.5 text-[10px] font-normal text-text-muted">
          {copiedLabel}
        </span>
      )}
    </a>
  );
}
