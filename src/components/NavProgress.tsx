'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Did my click do anything?
//
// Every page here is server-rendered on demand, so a click on a link is a round trip before ANY
// pixel changes — the browser sits on the old page holding the old scroll position, and the only
// feedback is the tab's spinner. Measured, the server end of that is 11–75ms even for a 300-member
// roster or a board with 1,200 submissions, so the wait is almost entirely the network, and it is
// the network that varies: a player on hotel wifi waits half a second on the same page that
// answers instantly at home.
//
// WHY NOT loading.tsx. That was the obvious fix and it is the wrong one here. A route-level Suspense
// boundary replaces the whole page with a skeleton the moment you click, for as long as the
// navigation takes — which at 30ms is a full-page flicker on every click, and the people with the
// fastest connections get the worst of it. It trades a quiet wait for a loud one.
//
// A DELAYED BAR INVERTS THAT TRADE. Nothing at all happens for the first {@link DELAY_MS}, so a fast
// navigation is exactly as calm as it is today; past that the wait was going to be noticeable
// anyway, and a 2px line is the smallest thing that can say "yes, it is coming".

/** How long a navigation may take before it is worth mentioning. Below this, silence is better. */
const DELAY_MS = 220;

/** Where the bar creeps to while waiting. Never 100 — a full bar that keeps waiting is a lie. */
const CREEP_TARGET = 88;

const SetPendingContext = createContext<(pending: boolean) => void>(() => {});

/**
 * Mounted once, in the root layout, around everything.
 *
 * Holds a COUNT rather than a boolean: React may keep a previous link's status mounted for a beat
 * while the next one starts, and two overlapping reports would otherwise have the second one's
 * cleanup switch the bar off while the first is still going.
 */
export function NavProgressProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(0);

  const setPending = useCallback((pending: boolean) => {
    setActive((n) => Math.max(0, n + (pending ? 1 : -1)));
  }, []);

  return (
    <SetPendingContext.Provider value={setPending}>
      <NavProgressBar active={active > 0} />
      {children}
    </SetPendingContext.Provider>
  );
}

/**
 * The setter, for the reporter that lives in ClanLink.
 *
 * The reporter itself has to be THERE rather than here: it needs `useLinkStatus`, which only answers
 * inside a `next/link` subtree, and the clan-prefix lint rule reserves the `next/link` import for
 * ClanLink alone — correctly, since a bare Link cannot know about the clan prefix.
 */
export function useSetNavPending(): (pending: boolean) => void {
  return useContext(SetPendingContext);
}

function NavProgressBar({ active }: { active: boolean }) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    if (active) {
      clear();
      // THE DELAY IS THE WHOLE DESIGN. A navigation that finishes inside it shows nothing at all,
      // so the common case stays as quiet as it is now.
      timers.current.push(
        setTimeout(() => {
          setVisible(true);
          setWidth(12);
          // One eased step rather than an interval: the bar is a reassurance, not a measurement,
          // and a rAF loop for a line nobody looks directly at is not worth the wakeups.
          timers.current.push(setTimeout(() => setWidth(CREEP_TARGET), 40));
        }, DELAY_MS),
      );
      return clear;
    }

    clear();
    // Never shown, so nothing to finish — reset silently rather than flashing a completed bar.
    setVisible((wasVisible) => {
      if (!wasVisible) {
        setWidth(0);
        return false;
      }
      setWidth(100);
      timers.current.push(setTimeout(() => setVisible(false), 180));
      timers.current.push(setTimeout(() => setWidth(0), 380));
      return true;
    });
    return clear;
  }, [active]);

  return (
    <div
      aria-hidden
      // A stable handle for tests: the bar's whole behaviour is timing, which is the one thing a
      // snapshot cannot see and only a driven navigation can check.
      data-nav-progress={visible ? 'visible' : 'hidden'}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 180ms ease-out' }}
    >
      <div
        className="h-full bg-gradient-to-r from-gold-dark via-gold to-gold-light"
        style={{
          width: `${width}%`,
          // Long and eased while creeping, short on completion, so it reads as "working" and then
          // "done" rather than as a progress figure anybody could take literally.
          transition: width >= 100 ? 'width 160ms ease-out' : 'width 1600ms cubic-bezier(0.1, 0.7, 0.2, 1)',
        }}
      />
    </div>
  );
}
