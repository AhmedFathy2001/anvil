'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { LockerOtherAccount } from '@/lib/profileLocker';
import { parseStamp } from '@/lib/dbTime';

function shortDate(stamp: string | null): string {
  const ms = parseStamp(stamp);
  return ms == null ? '' : new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Your characters that this clan holds no seat for.
 *
 * TWO DIFFERENT QUESTIONS LIVE ON EACH ROW, and for a long time one switch was asked to answer both.
 *
 *   Show on my public profile — whether this character appears on its own profile and the cross-clan boards.
 *     The platform's question, on by default, and nothing to do with any particular clan. Turning it
 *     off is how an ironman or a PK alt stays out of the public pages.
 *
 *   Guest here — whether THIS clan knows about the character at all. That is a seat on their roster,
 *     which their own door grants (open seats you at once, approval asks a moderator, closed refuses),
 *     and it is what lets the character play their events.
 *
 * The old "Share" was the first one wearing the second one's name: it promised that clans you were
 * not in could see the character, while every clan screen went on showing only its own seats. A
 * person read "shared" and reasonably concluded the clan could see it. Now the row says both things
 * and each one does what it says.
 */
export default function OtherAccountsClient({
  accounts,
  clanName,
  clanSlug,
}: {
  accounts: LockerOtherAccount[];
  clanName: string;
  /** Null on the apex, which is no clan — there is nobody to guest with there. */
  clanSlug: string | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [asked, setAsked] = useState<Record<number, string>>({});

  async function guestHere(account: LockerOtherAccount) {
    if (!clanSlug) return;
    setBusyId(account.accountId);
    setError('');
    try {
      // The same door as a clan's public page, so open / approval / closed is answered in exactly
      // one place — see lib/guestAdmission.
      const res = await fetch(`/api/clans/${clanSlug}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.accountId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not ask.');
        return;
      }
      setAsked((prev) => ({
        ...prev,
        [account.accountId]:
          data.seated ? `${account.rsn} is a guest here now.` : 'Asked — a moderator will answer.',
      }));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-4">
      <div className="text-xs uppercase tracking-wider text-text-muted mb-2">
        Your other characters &mdash; not on {clanName}&rsquo;s roster
      </div>
      <p className="text-xs text-text-muted mb-2.5">
        {clanName} holds no seat for these, so nothing here counts them and nobody here can see them.
        Offer one as a guest and they can &mdash; and it can play their events.
      </p>
      {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
      <div className="space-y-1.5">
        {accounts.map((a) => (
          <div
            key={a.accountId}
            className="flex flex-wrap items-center gap-3 border border-card-border rounded-lg px-3.5 py-2 bg-brown-dark/25"
          >
            <span className="text-sm">{a.rsn}</span>

            <span className="ml-auto flex flex-wrap items-center gap-3">
              {asked[a.accountId] ? (
                <span className="text-xs text-accent-green-light">{asked[a.accountId]}</span>
              ) : a.guestRequestPending ? (
                <span className="text-xs text-text-muted">Asked &mdash; waiting on a moderator</span>
              ) : clanSlug && a.verified ? (
                <>
                  {/* A "no" is an answer, and it used to vanish: the row just went back to the
                      button. Say it, and still let them ask again — clans change their minds. */}
                  {a.guestDeclinedAt && (
                    <span className="text-xs text-red-300/90">Declined on {shortDate(a.guestDeclinedAt)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => guestHere(a)}
                    disabled={busyId === a.accountId}
                    className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-50"
                  >
                    {a.guestDeclinedAt ? 'Ask again' : 'Guest here'}
                  </button>
                </>
              ) : clanSlug ? (
                // A clan's door only considers a character whose ownership is proven, which is the
                // same bar the sign-up form and the event door apply.
                <span className="text-xs text-text-muted">Verify it to offer it</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
