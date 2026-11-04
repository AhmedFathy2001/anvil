'use client';

import { useState } from 'react';

import { FRIENDS_HOST_NAME_MAX } from '@/lib/friendEventRules';

/**
 * The name the person's friends boards go by ("Hosted by …"), with an inline "Edit name". Only ever
 * rendered on the owner's own /host/friends; the route checks that again (PATCH /api/friends/host).
 */
export default function RenameFriendsHost({ name: initial }: { name: string }) {
  const [name, setName] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/friends/host', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft }),
      });
      const data: { name?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.name) {
        setError(data.error ?? 'That didn’t work. Try again.');
        return;
      }
      setName(data.name);
      setDraft(data.name);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <p className="mt-1 text-[13.5px] text-text-muted">
        Your boards say <span className="text-foreground">&ldquo;Hosted by {name}&rdquo;</span>.{' '}
        <button type="button" onClick={() => setEditing(true)} className="text-gold hover:text-gold-light">
          Edit name
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={save} className="mt-2 flex flex-wrap items-center gap-2">
      <label htmlFor="friends-host-name" className="sr-only">
        Name your boards go by
      </label>
      <input
        id="friends-host-name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={FRIENDS_HOST_NAME_MAX}
        autoFocus
        className="min-w-0 flex-1 rounded-lg border border-card-border bg-brown-dark px-3 py-1.5 text-sm outline-none focus:border-gold/50"
      />
      <button
        type="submit"
        disabled={busy || !draft.trim()}
        className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setDraft(name);
          setError(null);
        }}
        className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:text-gold"
      >
        Cancel
      </button>
      {error && <p className="w-full text-sm text-accent-red">{error}</p>}
    </form>
  );
}
