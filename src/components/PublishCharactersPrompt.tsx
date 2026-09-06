'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The one-time ask that turns a private character into a page.
 *
 * `accounts.shared` defaults to true, so anything created since that default moved is already
 * public. What it did NOT do is reach backwards: every account that existed first — which is every
 * account a clan roster ever created, so most of them — is still private, and the effect is a whole
 * public half of the product with nothing in it. A backfill would have published those people
 * without asking, which is not a thing to do to somebody's account.
 *
 * So it asks, once, where they can see what they are agreeing to: the character page and the tables
 * it feeds. Only rendered while something is unshared, and it disappears by being acted on rather
 * than by being dismissed — there is no "don't show this again" to store, because a person who
 * publishes nothing keeps a toggle beside each character and this line above them.
 *
 * Publishing every character at once is offered because the alternative — a person with four
 * accounts pressing four toggles to say one thing — is how a reasonable ask becomes a chore. Each
 * one is still individually reversible afterwards, which is what makes the bulk version fair.
 */
export default function PublishCharactersPrompt({
  accountIds,
}: {
  /** The unshared ones. Empty renders nothing. */
  accountIds: number[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (accountIds.length === 0) return null;
  const many = accountIds.length > 1;

  async function publishAll() {
    setBusy(true);
    setError('');
    try {
      const results = await Promise.all(
        accountIds.map((id) =>
          fetch(`/api/profile/accounts/${id}/share`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shared: true }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) {
        setError('Some of those could not be published. Try the toggles below.');
      }
      router.refresh();
    } catch {
      setError('Could not publish those.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gold/25 bg-gold/[0.04] p-4">
      <p className="text-sm font-semibold">
        {many ? `${accountIds.length} of your characters are private` : 'Your character is private'}
      </p>
      <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-text-muted">
        Publishing gives {many ? 'each of them' : 'it'} a page anyone with the link can read — skills,
        bosses, collection log, records and milestones — and lets {many ? 'them' : 'it'} appear in the
        Hall of Records and when somebody looks the name up. Nothing from Discord is ever on it, and
        the clans you are in can see your stats either way.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={publishAll}
          disabled={busy}
          className="rounded-lg bg-gold px-3.5 py-2 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {busy ? 'Publishing…' : many ? 'Publish all of them' : 'Publish it'}
        </button>
        <span className="text-[12px] text-text-dim">
          Or use the toggle beside {many ? 'any one of them' : 'it'}. Reversible at any time.
        </span>
        {error && <span className="text-[12px] text-red-400">{error}</span>}
      </div>
    </div>
  );
}
