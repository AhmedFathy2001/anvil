'use client';

import { useEffect, useId, useRef, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { SUPPORTER_TIERS, TENURE_LADDER, tenureFor, tenureLabel, type SupporterTierId, type TenureStepId } from '@/lib/supporterTiers';

/**
 * The star beside a Supporter's name, as a button: it says what the flair is and how to get it.
 * Curiosity, not a pitch — the popover only opens when someone asks.
 */
export default function SupporterFlairPopover({
  tier,
  tenure = null,
  name: forName = null,
  children,
}: {
  tier: SupporterTierId;
  /** The name the star belongs to, for "Gift them a month". */
  name?: string | null;
  /** Unbroken paid time, when the page knows it: "Master · supporting for 1 year, 2 months". */
  tenure?: { id: TenureStepId; months: number } | null;
  children: React.ReactNode;
}) {
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
  const step = tenure ? TENURE_LADDER.find((t) => t.id === tenure.id) : null;
  const next = tenure ? tenureFor(tenure.months).next : null;
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
          {step && tenure && (
            <span className="mt-1 block text-[13px] leading-snug">
              <span className="font-medium">{step.name}</span>
              <span className="text-text-muted"> · supporting for {tenureLabel(tenure.months)}</span>
              {next && (
                <span className="block text-[12px] text-text-muted">
                  {next.name} at {next.months % 12 === 0 ? `${next.months / 12} year${next.months === 12 ? '' : 's'}` : `${next.months} months`}
                </span>
              )}
            </span>
          )}
          <span className="mt-1 block text-[13px] leading-snug text-text-muted">
            They support Anvil. Supporters pay for the servers that keep it free for every clan.
          </span>
          <span className="mt-2 flex flex-wrap gap-2">
            <ClanLink
              href="/supporter"
              className="inline-block rounded-lg border border-gold/40 px-2.5 py-1 text-[13px] font-medium text-gold transition-colors hover:bg-gold/10"
            >
              Get this look
            </ClanLink>
            {forName && (
              <ClanLink
                href={`/supporter/gift?to=${encodeURIComponent(forName)}`}
                className="inline-block rounded-lg border border-[#ff7ab8]/40 px-2.5 py-1 text-[13px] font-medium text-[#ff9cc8] transition-colors hover:bg-[#ff7ab8]/10"
              >
                Gift them a month
              </ClanLink>
            )}
          </span>
        </span>
      )}
    </span>
  );
}
