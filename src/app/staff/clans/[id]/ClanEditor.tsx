'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import { useDialog } from '@/components/Confirm';

/**
 * The clan's name and address (staff), and deleting it outright (root). Plan, cap and status stay in
 * the directory, where clans are compared.
 */
export default function ClanEditor({
  clan,
  canDelete,
}: {
  clan: { id: number; name: string; slug: string; events: number; members: number };
  canDelete: boolean;
}) {
  const router = useRouter();
  const { confirm, notify } = useDialog();
  const [name, setName] = useState(clan.name);
  const [slug, setSlug] = useState(clan.slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [reason, setReason] = useState('');

  const nameChanged = name.trim() !== clan.name;
  const slugChanged = slug.trim().toLowerCase() !== clan.slug;

  async function save() {
    if (slugChanged) {
      const ok = await confirm({
        title: `Move ${clan.name} to /c/${slug.trim().toLowerCase()}?`,
        body: `Every link to /c/${clan.slug} stops working: bookmarks, shared Discord posts, and the address members use. Nothing redirects from the old one.`,
        confirmLabel: 'Change address',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (nameChanged) body.name = name;
      if (slugChanged) body.slug = slug;
      const res = await fetch(`/api/staff/clans/${clan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${clan.name} for good?`,
      body: `This removes the clan and everything in it: ${clan.events} event(s) with their boards, proofs and teams, ${clan.members} member seat(s), staff, settings, weeklies and guides. Characters stay on Anvil. It cannot be undone; archiving is the reversible option.`,
      confirmLabel: 'Delete clan',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/clans/${clan.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmSlug, reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      notify(`${clan.name} deleted. It is recorded in the platform log.`);
      router.push('/staff/clans');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-card-border bg-card-bg p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} maxLength={80} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Address (/c/…)
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy} maxLength={32} />
          </label>
        </div>
        {slugChanged && (
          <p className="mt-2 text-xs text-yellow-400">Changing the address breaks every existing link to this clan.</p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy || (!nameChanged && !slugChanged) || !name.trim() || !slug.trim()}
            className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark disabled:opacity-40"
          >
            Save
          </button>
          {(nameChanged || slugChanged) && (
            <button
              onClick={() => {
                setName(clan.name);
                setSlug(clan.slug);
              }}
              disabled={busy}
              className="text-sm text-text-muted hover:text-gold"
            >
              Undo
            </button>
          )}
        </div>
      </div>

      {canDelete && (
        <div className="rounded-xl border border-accent-red/40 bg-card-bg p-4">
          <div className="text-sm font-semibold text-accent-red">Delete this clan</div>
          <p className="mt-1 text-xs text-text-muted">
            Removes the clan and everything in it. Characters and their stats stay on Anvil. To take a clan offline
            and keep its data, set its status to archived in the directory instead.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Why (kept in the platform log)
              <Input value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} maxLength={500} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Type <span className="font-mono text-foreground">{clan.slug}</span> to confirm
              <Input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} disabled={busy} />
            </label>
          </div>
          <button
            onClick={remove}
            disabled={busy || confirmSlug.trim() !== clan.slug || !reason.trim()}
            className="mt-3 rounded-lg border border-accent-red px-3 py-1.5 text-sm font-semibold text-accent-red hover:bg-accent-red/10 disabled:opacity-40"
          >
            Delete clan
          </button>
        </div>
      )}

      {error && <p className="text-sm text-accent-red">{error}</p>}
    </div>
  );
}
