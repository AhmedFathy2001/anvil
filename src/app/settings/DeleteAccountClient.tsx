'use client';

import { useState } from 'react';

import { ACCOUNT_DELETED_FLAG } from '@/components/AccountDeletedNotice';
import { useDialog } from '@/components/Confirm';
import { BTN, BTN_DANGER } from './_client';

/** Sign out, sign in with Discord, land back on Settings > Account at "Your data". */
const SIGN_IN_AGAIN_HREF = `/api/auth/logout?return=${encodeURIComponent(
  `/api/auth/discord/start?return=${encodeURIComponent('/settings/account#your-data')}`,
)}`;

export interface DeleteBlockerView {
  message: string;
  links: { href: string; label: string; external: boolean }[];
}

/**
 * The button behind "Delete my account". The page above it has already said what goes and what
 * stays; this asks once more in the app's own dialog, makes them type it, and sends one request.
 * Anything that stops a deletion (owning a clan, a plan that still renews, an old sign-in) is shown
 * instead of the button, with where to go to clear it. The server checks all of it again.
 */
export default function DeleteAccountClient({
  displayName,
  blockers,
  recentUntil,
  disabledReason,
}: {
  displayName: string;
  blockers: DeleteBlockerView[];
  /** When this sign-in stops being recent enough to delete (ms); null when it already is not. */
  recentUntil: number | null;
  disabledReason: string | null;
}) {
  const { ask, notify } = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(recentUntil == null);

  if (disabledReason) return <p className="text-[13px] text-text-muted">{disabledReason}</p>;

  if (blockers.length > 0) {
    return (
      <div className="space-y-3">
        {blockers.map((b) => (
          <div key={b.message} className="rounded-lg border border-card-border bg-card-bg-hover px-3 py-2.5 text-[13px]">
            <p>{b.message}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {b.links.map((l) => (
                /* clan-prefix: platform — these are full paths (a clan's own address) or other sites. */
                <a key={l.href + l.label} href={l.href} className={BTN} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[12.5px] text-text-muted">Once that is done, come back here to delete your account.</p>
      </div>
    );
  }

  if (needsSignIn) {
    return (
      <div className="space-y-2" role="status">
        <p className="text-[13px] text-foreground">Sign out and sign in again, then delete your account.</p>
        <p className="text-[13px] text-text-muted">
          Deleting only works in the first 15 minutes after you sign in, so nobody else can do it from a browser you left open. The
          button signs you out, takes you to Discord to sign in, and brings you back here.
        </p>
        {/* Out first, then straight to Discord: /login skips somebody already signed in, and a fresh sign-in is the point. */}
        <a href={SIGN_IN_AGAIN_HREF} /* clan-prefix: platform */ className={BTN}>
          Sign out and sign in again
        </a>
      </div>
    );
  }

  async function deleteAccount() {
    setError('');
    // Checked at the click, every time: the page may have been open longer than the window. The
    // server checks again, but by then they would have typed the confirmation for nothing.
    if (recentUntil == null || Date.now() > recentUntil) {
      setNeedsSignIn(true);
      return;
    }
    const typed = await ask({
      title: 'Delete your account?',
      body:
        'Your login, email, Discord details, plugin sign-ins, linked accounts, settings and profile pictures are removed for good. ' +
        'Your clans keep your in-game name on their rosters and in their event history, no longer linked to you. This cannot be undone.',
      label: displayName ? `Type DELETE, or your display name (${displayName}), to confirm` : 'Type DELETE to confirm',
      placeholder: 'DELETE',
      required: true,
      confirmLabel: 'Delete my account',
      cancelLabel: 'Keep my account',
      tone: 'danger',
    });
    if (typed == null) return;
    const t = typed.trim();
    if (t !== 'DELETE' && (!displayName || t.toLowerCase() !== displayName.trim().toLowerCase())) {
      setError('That did not match. Nothing was deleted.');
      return;
    }
    setBusy(true);
    try {
      // Platform route, not clan-scoped: the account belongs to the person, not to any clan.
      const res = await fetch('/api/profile/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: t }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        if (j.code === 'reauth') setNeedsSignIn(true);
        else if (j.code === 'blocked') window.location.reload();
        setError(j.error || 'Nothing was deleted. Try again.');
        return;
      }
      try {
        window.sessionStorage.setItem(ACCOUNT_DELETED_FLAG, '1');
      } catch {
        notify('Your account has been deleted.');
      }
      // A full load on purpose: the signed-in page around this one has to go too.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/';
    } catch {
      setError('Nothing was deleted. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-[13px] text-red-300" role="alert">{error}</p>}
      <button type="button" onClick={deleteAccount} disabled={busy} className={BTN_DANGER}>
        {busy ? 'Deleting…' : 'Delete my account'}
      </button>
    </div>
  );
}
