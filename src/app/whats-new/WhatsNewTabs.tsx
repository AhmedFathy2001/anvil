'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { setUrlParams } from '@/lib/urlState';
import { WHATS_NEW_SEEN_EVENT, WHATS_NEW_SEEN_KEY, WHATS_NEW_TAB_PARAM, type WhatsNewTab } from '@/lib/whatsNew';

const SEEN_KEY = WHATS_NEW_SEEN_KEY;

/** The newest entry date the viewer had already seen on their last visit, or null (first visit / no storage). */
const SeenContext = createContext<string | null>(null);

/** "New" next to an entry dated after the viewer's last visit. Renders nothing until the visit is read. */
export function NewBadge({ date }: { date: string }) {
  const seen = useContext(SeenContext);
  if (!seen || date <= seen) return null;
  return (
    <span className="ml-2 rounded-full bg-gold px-2 py-0.5 align-middle text-[11px] font-semibold text-brown-dark">New</span>
  );
}

/**
 * The tab row on /whats-new. Every panel is rendered on the server and the inactive ones are only
 * hidden, so switching is instant; the tab is written into the address (`?tab=staff`) so a link to
 * one scope can be shared. Also remembers (localStorage, best effort) the newest entry seen, so the
 * next visit can mark what is new. Signed in, the visit also clears the bell's What's new notices.
 */
export default function WhatsNewTabs({
  initial,
  newest,
  signedIn,
  tabs,
}: {
  initial: WhatsNewTab;
  newest: string;
  signedIn: boolean;
  tabs: { id: WhatsNewTab; label: string; count: number; panel: React.ReactNode }[];
}) {
  const [tab, setTab] = useState<WhatsNewTab>(initial);
  const [seen, setSeen] = useState<string | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      setSeen(localStorage.getItem(SEEN_KEY));
      localStorage.setItem(SEEN_KEY, newest);
    } catch {
      // Private window or blocked storage: no badges, nothing else lost.
    }
    if (!signedIn) return;
    void fetch('/api/notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', whatsNew: true }) })
      .then(() => window.dispatchEvent(new Event(WHATS_NEW_SEEN_EVENT)))
      .catch(() => {});
  }, [newest, signedIn]);

  const pick = (next: WhatsNewTab) => {
    setTab(next);
    setUrlParams({ [WHATS_NEW_TAB_PARAM]: next });
  };

  return (
    <SeenContext.Provider value={seen}>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-card-border" role="tablist" aria-label="What's new for">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`wn-tab-${t.id}`}
            aria-controls={`wn-panel-${t.id}`}
            aria-selected={tab === t.id}
            onClick={() => pick(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors sm:px-4 ${
              tab === t.id ? 'border-gold font-medium text-gold' : 'border-transparent text-text-muted hover:text-foreground'
            }`}
          >
            {t.label}
            <span className="rounded-full bg-card-border/60 px-1.5 text-[11px] tabular-nums text-text-dim">{t.count}</span>
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`wn-panel-${t.id}`} aria-labelledby={`wn-tab-${t.id}`} hidden={tab !== t.id}>
          {t.panel}
        </div>
      ))}
    </SeenContext.Provider>
  );
}
