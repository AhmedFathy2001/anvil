'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A label with its explanation on hover or keyboard focus. The tooltip is drawn on top of the page
 * (a portal, fixed position) rather than inside the label's box, so a scrolling container — a table
 * that scrolls sideways, which also clips vertically — can never cut it off.
 */
export default function HoverHint({ label, hint }: { label: string; hint: string }) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const width = 288;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setAt({ top: r.bottom + 6, left });
  }, []);
  const hide = useCallback(() => setAt(null), []);

  // A scroll or resize would leave it floating away from its label: close it instead.
  useEffect(() => {
    if (!at) return;
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [at, hide]);

  return (
    <span
      ref={anchor}
      className="inline-flex items-center gap-1.5"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        tabIndex={0}
        aria-describedby={at ? id : undefined}
        className="cursor-help underline decoration-text-dim decoration-dotted underline-offset-4 outline-none"
      >
        {label}
      </span>
      <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full border border-card-border text-[10px] text-text-dim">
        ?
      </span>
      {at &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ top: at.top, left: at.left }}
            className="pointer-events-none fixed z-50 w-72 rounded-lg border border-card-border bg-background px-3 py-2 text-[12.5px] font-normal leading-snug text-text-muted shadow-lg"
          >
            {hint}
          </span>,
          document.body,
        )}
    </span>
  );
}
