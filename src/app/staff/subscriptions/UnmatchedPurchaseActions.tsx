'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import Combobox from '@/components/Combobox';
import Textarea from '@/components/Textarea';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';

interface SpaceHit {
  id: number;
  name: string;
  slug: string;
  kind: string;
  plan: string;
  status: string;
  gumroadSubscriptionId: string | null;
}
interface UserHit {
  id: number;
  displayName: string;
  discordUsername: string | null;
  discordId: string | null;
}
interface Pick {
  id: number;
  label: string;
}

const API = '/api/staff/unmatched-purchases';

const spaceLabel = (s: SpaceHit) => `${s.slug} — ${s.name} (${s.kind === 'creator' ? 'creator space' : 'clan'}, ${s.plan}${s.status !== 'active' ? `, ${s.status}` : ''})`;
const userLabel = (u: UserHit) => `${u.discordUsername ?? u.displayName} — ${u.displayName} · login #${u.id}${u.discordId ? ` · ${u.discordId}` : ''}`;

/**
 * Attach or dismiss one unmatched purchase (lib/unmatchedPurchaseActions). A plan or creator purchase
 * is attached to a space, a Supporter one to a login; the server re-checks every rule, this only picks.
 */
export default function UnmatchedPurchaseActions({ id, kind }: { id: number; kind: 'plan' | 'creator' | 'supporter' }) {
  const router = useRouter();
  const { confirm, ask, notify } = useDialog();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Pick[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const forUser = kind === 'supporter';
  // The latest results, read by the search effect without re-running it when they change.
  const hitsRef = useRef<Pick[]>([]);
  useEffect(() => {
    hitsRef.current = hits;
  }, [hits]);

  // Search as staff type; the picked label must be one the server just returned.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2 || hitsRef.current.some((h) => h.label === query)) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await clanFetch(`${API}?${forUser ? 'users' : 'spaces'}=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        setHits(
          forUser
            ? ((data.users ?? []) as UserHit[]).map((u) => ({ id: u.id, label: userLabel(u) }))
            : ((data.spaces ?? []) as SpaceHit[]).map((s) => ({ id: s.id, label: spaceLabel(s) })),
        );
      } catch {
        /* aborted or offline: keep the last list */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open, forUser]);

  const picked = useMemo(() => hits.find((h) => h.label === query) ?? null, [hits, query]);

  async function post(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await clanFetch(`${API}/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  }

  async function attach() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const base = forUser
        ? { action: 'attach-user', userId: picked.id, note }
        : { action: 'attach-space', clanId: picked.id, note };
      let r = await post(base);
      if (!r.ok && r.data.needsConfirm) {
        const go = await confirm({
          title: 'Replace the current membership?',
          body: String(r.data.error ?? ''),
          confirmLabel: 'Replace',
          tone: 'danger',
        });
        if (!go) return;
        r = await post({ ...base, confirmReplace: true });
      }
      if (!r.ok) {
        setError(String(r.data.error ?? 'Failed'));
        return;
      }
      notify(r.data.note ? `Attached (${String(r.data.note)}).` : `Attached${r.data.plan ? ` as ${String(r.data.plan)}` : ''}.`);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    const why = await ask({
      title: 'Dismiss this purchase?',
      body: 'Nothing is applied and nothing is refunded. It moves to the resolved list with your reason.',
      label: 'Reason',
      placeholder: 'e.g. refunded in Gumroad — duplicate cart item',
      required: true,
      multiline: true,
      confirmLabel: 'Dismiss',
    });
    if (!why) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post({ action: 'dismiss', note: why });
      if (!r.ok) {
        setError(String(r.data.error ?? 'Failed'));
        return;
      }
      notify('Dismissed.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={busy}
          className="rounded-lg border border-card-border px-3 py-1 text-xs text-gold hover:border-gold/40 disabled:opacity-50"
        >
          {open ? 'Close' : forUser ? 'Attach to a person' : 'Attach to a space'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="rounded-lg border border-card-border px-3 py-1 text-xs text-text-muted hover:border-gold/40 hover:text-foreground disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 rounded-lg border border-card-border bg-brown-dark/40 p-3">
          <Combobox
            value={query}
            onChange={setQuery}
            suggestions={hits.map((h) => h.label)}
            placeholder={forUser ? 'Discord name, display name, Discord id or login #' : 'Space slug, name or id'}
            ariaLabel={forUser ? 'Person to attach to' : 'Space to attach to'}
            maxLength={120}
            disabled={busy}
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Note for the log (optional), e.g. confirmed with the buyer on Discord"
            disabled={busy}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={attach}
              disabled={busy || !picked}
              className="rounded-lg bg-gold px-3 py-1 text-xs font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Attach'}
            </button>
            <span className="text-xs text-gray-500">
              {forUser
                ? 'Creates their Supporter membership exactly as a matched sale would.'
                : 'Applies the plan exactly as a matched sale would; the space then holds the subscription, so renewals and cancels find it.'}
            </span>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
