'use client';

import { useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { WHATS_NEW, WHATS_NEW_SEEN_EVENT, WHATS_NEW_SEEN_KEY, unseenCount } from '@/lib/whatsNew';

/** Entries newer than the viewer's last /whats-new visit (localStorage, best effort), 0 until read. */
function useUnseen(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        const seen = localStorage.getItem(WHATS_NEW_SEEN_KEY);
        setN(unseenCount(WHATS_NEW.map((e) => e.date), seen, new Date().toISOString().slice(0, 10)));
      } catch {
        setN(0);
      }
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    read();
    window.addEventListener(WHATS_NEW_SEEN_EVENT, read);
    return () => window.removeEventListener(WHATS_NEW_SEEN_EVENT, read);
  }, []);
  return n;
}

/** "What's new" in the header, with a small gold count when there is something unread. */
export default function WhatsNewNavLink({ className, onClick }: { className: string; onClick?: () => void }) {
  const n = useUnseen();
  return (
    <ClanLink
      href="/whats-new"
      onClick={onClick}
      title={n > 0 ? `${n} new since your last visit` : undefined}
      className={`${className} inline-flex items-center gap-1.5`}
    >
      What&rsquo;s new
      {n > 0 && (
        <span className="rounded-full bg-gold px-1.5 text-[10.5px] font-semibold leading-4 text-brown-dark tabular-nums">{n > 9 ? '9+' : n}</span>
      )}
    </ClanLink>
  );
}
