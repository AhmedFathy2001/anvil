'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import ClanLink from '@/components/ClanLink';
import NewPluginToken from '@/components/NewPluginToken';
import LinkAccountClient from './LinkAccountClient';

// Adding a character, plugin FIRST.
//
// The plugin is the primary discovery path: a character you play shows up here without typing its
// name. A safe new account can link immediately; an established roster identity still uses the
// XP-delta or moderator check because the client-reported name/hash are not authenticated. The old
// form led with that XP flow for everybody, including accounts with no prior identity to protect.
//
// So this leads with the token and "play once", watches for the first login the way ConnectCard
// does, and folds the by-name path away behind a disclosure for the people who actually need it.
//
// EXCEPT ON A PHONE. There is no RuneLite on a phone, so a plugin-first card there is a page of
// instructions for somewhere else, a token button and "Waiting for RuneLite…" — and the one path
// that works hidden under it. A clan's sign-up link opened from Discord on a phone is exactly where
// a brand-new member lands, and "can't fill out the sign-up form" was what they saw. On a touch
// screen the by-name path leads and the plugin folds away instead.

const COARSE = '(pointer: coarse)';
const subscribeCoarse = (cb: () => void) => {
  const m = window.matchMedia(COARSE);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
/** True on a touch-first device. False on the server and on the first paint, then corrected. */
function useTouchFirst(): boolean {
  return useSyncExternalStore(subscribeCoarse, () => window.matchMedia(COARSE).matches, () => false);
}

export default function AddCharacterClient({
  first = false,
  suggestedRsn = '',
  linkedCount = 0,
  detectedCount = 0,
}: {
  first?: boolean;
  /**
   * A name we already believe is theirs, from `?connect=` — the apex home's "that's me".
   *
   * It opens the by-name path rather than the plugin one on purpose: somebody who arrived by
   * clicking a suggestion is at a browser, not in game, and the token flow would ask them to go and
   * be somewhere else before anything happens.
   */
  suggestedRsn?: string;
  /** Server-rendered baselines keep a ping between paint and the first poll from disappearing. */
  linkedCount?: number;
  detectedCount?: number;
}) {
  const router = useRouter();
  const [showManual, setShowManual] = useState(Boolean(suggestedRsn));
  const touchFirst = useTouchFirst();
  const [showPlugin, setShowPlugin] = useState(false);
  const [heard, setHeard] = useState(false);
  // Both outcomes count. A safe first-use play becomes linked immediately; a protected roster row
  // becomes a detected account that needs the XP/mod check. Watching only `linked` made the latter
  // sit on "Listening…" forever even though the plugin had arrived successfully.
  //
  // Compared against the beacon's `characters`/`suggestions`, which count what the page renders
  // (characters owned, suggestions not already owned). Its `linked` counts clan SEATS — zero for a
  // clanless person — so comparing that against the character count tripped on the first poll and
  // parked the card on "loading…" for good.
  const baseline = useRef({ linked: linkedCount, detected: detectedCount });

  useEffect(() => {
    baseline.current = { linked: linkedCount, detected: detectedCount };
    setHeard(false);
  }, [linkedCount, detectedCount]);

  // Watch for the first ping the same way the locker's ConnectCard does. Two seconds keeps the
  // browser feeling connected to RuneLite, and an immediate visibility/focus poll covers the common
  // flow where somebody pastes the token, plays, then comes back to this tab.
  useEffect(() => {
    if (heard) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let polling = false;
    const poll = async () => {
      if (!alive || polling) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (document.visibilityState === 'visible') {
        polling = true;
        try {
          const res = await fetch('/api/profile/connection', { cache: 'no-store' });
          if (res.ok) {
            const body = (await res.json()) as { characters?: number; suggestions?: number };
            if (body.characters == null || body.suggestions == null) throw new Error('old beacon');
            const next = { linked: body.characters, detected: body.suggestions };
            const prev = baseline.current;
            baseline.current = next;
            if (next.linked !== prev.linked || next.detected !== prev.detected) {
              setHeard(true);
              router.refresh();
              return;
            }
          }
        } catch {
          /* a missed poll is covered by the next one */
        } finally {
          polling = false;
        }
      }
      timer = setTimeout(poll, 2_000);
    };
    const pollWhenVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    poll();
    document.addEventListener('visibilitychange', pollWhenVisible);
    window.addEventListener('focus', pollWhenVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', pollWhenVisible);
      window.removeEventListener('focus', pollWhenVisible);
    };
  }, [heard, router]);

  const byName = <LinkAccountClient manualReview={false} initialRsn={suggestedRsn} />;

  if (touchFirst && !suggestedRsn) {
    return (
      <div>
        <p className="mb-3 max-w-[62ch] text-sm text-text-muted">
          On your phone? Type your character&apos;s name below. We take a snapshot of its hiscores, ask you to
          gain a little XP in one skill, and then it&apos;s yours — no PC needed.
        </p>
        {byName}
        <div className="mt-4 border-t border-card-border pt-3">
          {!showPlugin ? (
            <button type="button" onClick={() => setShowPlugin(true)} className="text-sm text-gold hover:text-gold-light">
              Play on PC with RuneLite? Link it with the plugin instead →
            </button>
          ) : (
            <p className="max-w-[62ch] text-sm text-text-muted">
              Install <b className="text-foreground">Anvil</b> from the RuneLite Plugin Hub on your PC, click{' '}
              <b className="text-foreground">Sign in with Discord</b> in its panel and play the account — it shows up
              here on its own.{' '}
              <ClanLink href="/guide/plugin" className="text-gold hover:text-gold-light">
                Setup guide →
              </ClanLink>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 max-w-[62ch] text-sm text-text-muted">
        The easy way{first ? '' : ', and the one to reach for'}: install <b className="text-foreground">Anvil</b>{' '}
        from the RuneLite Plugin Hub, click <b className="text-foreground">Sign in with Discord</b> in its sidebar panel once, and
        play the account. It appears here automatically;
        new accounts link immediately, while an account already on a roster asks for a one-time XP or moderator check.
      </p>

      <div className="max-w-[640px]">
        <NewPluginToken primary cta="Make a token to paste" />
      </div>

      <p className="mt-2 text-xs text-text-muted">
        Sign-in not working? Make a token, copy it, then use <b className="text-foreground">Paste a token instead</b>{' '}
        under the sign-in button in the Anvil panel — you never re-paste it.{' '}
        <ClanLink href="/guide/plugin" className="text-gold hover:text-gold-light">
          Setup guide →
        </ClanLink>
      </p>

      <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-dashed border-card-border bg-brown-dark/50 px-3 py-2.5 text-sm text-text-muted">
        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-yellow-400" />
        {heard ? (
          <span>A character came through — loading…</span>
        ) : (
          <span>
            Waiting for RuneLite… <b className="text-foreground">log in or hop worlds once</b> and this page
            updates within a few seconds.
          </span>
        )}
      </div>

      <div className="mt-4 border-t border-card-border pt-3">
        {!showManual ? (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="text-sm text-gold hover:text-gold-light"
          >
            On mobile or the official client? Link by name instead →
          </button>
        ) : (
          <div>
            <p className="mb-3 max-w-[62ch] text-sm text-text-muted">
              No plugin — prove it is yours by training. We snapshot the hiscores, pick a skill, and verify the
              XP you gain in it.
            </p>
            {byName}
          </div>
        )}
      </div>
    </div>
  );
}
