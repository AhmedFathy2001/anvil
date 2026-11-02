'use client';

import { useEffect, useId, useRef, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

/**
 * The star beside a Supporter's name, as a button: it says what the flair is and how to get it.
 * Curiosity, not a pitch — the popover only opens when someone asks.
 */
export default function SupporterFlairPopover({ tier, children }: { tier: SupporterTierId; children: React.ReactNode }) {
  // Fixed to the viewport at the star: a name often sits in a heading that clips its overflow.
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const open = at != null;
  const box = useRef<HTMLSpanElement>(null);
  const toggle = () => {
    if (open || !box.current) return setAt(null);
    const r = box.current.getBoundingClientRect();
    setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - 264)), top: r.bottom + 8 });
  };
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setAt(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAt(null);
    };
    const close = () => setAt(null);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const name = SUPPORTER_TIERS[tier].name;
  return (
    <span ref={box} className="inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Anvil ${name} — what is this?`}
        className="-m-1 inline-flex rounded p-1 hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        {children}
      </button>
      {at && (
        <span
          id={id}
          role="dialog"
          aria-label={`Anvil ${name}`}
          style={{ left: at.left, top: at.top }}
          className="fixed z-50 block w-64 font-sans rounded-xl border border-gold/40 bg-card-bg p-3 text-left text-sm font-normal normal-case tracking-normal text-foreground shadow-lg"
        >
          <span className={`block font-semibold supporter-name-${tier}`}>Anvil {name}</span>
          <span className="mt-1 block text-[13px] leading-snug text-text-muted">
            They support Anvil. Supporters pay for the servers that keep it free for every clan.
          </span>
          <ClanLink
            href="/supporter"
            className="mt-2 inline-block rounded-lg border border-gold/40 px-2.5 py-1 text-[13px] font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Get this look
          </ClanLink>
        </span>
      )}
    </span>
  );
}
