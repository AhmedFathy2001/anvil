'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { CONTINUE_KEYS, type ContinueTarget } from '@/lib/clanScopedPaths';
import { forgetContinue, recallContinue, XP_CHECK_EVENT } from '@/lib/continueStore';

/**
 * "Link a character to <what you were doing>", and afterwards the way back.
 *
 * `fromUrl` is the return target in the address (checked on the server). With none, a check the
 * person started earlier may have left one in this browser (lib/continueStore), so coming back to
 * Settings later still offers "Continue".
 *
 * Going back by itself happens only when a character becomes ready while the person is looking at
 * this page and no XP check is on screen: the plugin's first-use link is instant. A check that ran
 * for minutes, or a page opened with a character already ready, only shows the button: nobody is
 * pulled out of something else.
 */
export default function ContinueStrip({
  fromUrl,
  linked,
  verified,
}: {
  fromUrl: ContinueTarget | null;
  linked: number;
  /** Characters that can be used to sign up, enter or apply (lib/characterState mayJoinWith). */
  verified: number;
}) {
  const router = useRouter();
  const [stored, setStored] = useState<ContinueTarget | null>(null);
  const [auto, setAuto] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const checkOnScreen = useRef(false);
  const wasReady = useRef<boolean | null>(null);

  useEffect(() => {
    if (!fromUrl) setStored(recallContinue());
  }, [fromUrl]);

  useEffect(() => {
    const on = (e: Event) => {
      checkOnScreen.current = (e as CustomEvent<boolean>).detail === true;
    };
    window.addEventListener(XP_CHECK_EVENT, on);
    return () => window.removeEventListener(XP_CHECK_EVENT, on);
  }, []);

  const cont = fromUrl ?? stored;
  const rule = cont ? CONTINUE_KEYS[cont.key] : null;
  const ready = rule ? (rule.needs === 'verified' ? verified > 0 : linked > 0) : false;

  useEffect(() => {
    if (!cont) return;
    if (wasReady.current === false && ready && !checkOnScreen.current) setAuto(true);
    wasReady.current = ready;
  }, [ready, cont]);

  useEffect(() => {
    if (!auto || cancelled || !cont) return;
    const t = setTimeout(() => {
      forgetContinue();
      router.push(cont.next);
    }, 2500);
    return () => clearTimeout(t);
  }, [auto, cancelled, cont, router]);

  if (!cont || !rule) return null;

  if (!ready) {
    const verb = rule.needs === 'verified' && linked > 0 ? 'Verify a character' : 'Link a character';
    return (
      <div className="mb-4 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm" data-continue="waiting">
        <p className="font-semibold text-gold">
          {verb} to {rule.doing}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">When it is done, you can go straight back to {rule.back}.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm" data-continue="ready">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-green-300">Your character is ready.</p>
        {auto && !cancelled && (
          <p className="mt-0.5 text-xs text-text-muted">
            Taking you back to {rule.back}…{' '}
            <button type="button" onClick={() => setCancelled(true)} className="text-gold hover:text-gold-light">
              Stay here
            </button>
          </p>
        )}
      </div>
      <ClanLink
        href={cont.next}
        onClick={() => forgetContinue()}
        className="rounded-lg bg-gold px-4 py-2 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
      >
        Continue: back to {rule.back}
      </ClanLink>
    </div>
  );
}
