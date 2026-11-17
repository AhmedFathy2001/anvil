'use client';

import { useEffect, useState } from 'react';

/** Set by settings/DeleteAccountClient just before it leaves for the home page. Same tab only. */
export const ACCOUNT_DELETED_FLAG = 'anvil:account-deleted';

/**
 * The plain confirmation after deleting an account: shown once on the page they land on, then gone.
 * A flag in this tab's session storage rather than a query string, so the address stays clean and a
 * shared or bookmarked link can never show it to someone else.
 */
export default function AccountDeletedNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(ACCOUNT_DELETED_FLAG) !== '1') return;
      window.sessionStorage.removeItem(ACCOUNT_DELETED_FLAG);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after mount; there is no server value to render from
      setShow(true);
    } catch {
      /* storage blocked: nothing to show */
    }
  }, []);

  if (!show) return null;
  return (
    <div role="status" className="mx-auto mb-6 flex max-w-3xl items-start justify-between gap-4 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm">
      <p>
        <b>Your account has been deleted.</b> You are signed out everywhere. Your clans keep their own event history under your in-game
        name.
      </p>
      <button type="button" onClick={() => setShow(false)} className="shrink-0 text-text-muted hover:text-foreground">
        Close
      </button>
    </div>
  );
}
