'use client';

import { useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { useDialog } from '@/components/Confirm';
import LocalTime from '@/components/LocalTime';
import { clanFetch } from '@/lib/clanFetch';

interface Finding {
  webhookId: string;
  masked: string;
  status: string;
  clans: { id: number; name: string; slug: string | null }[];
  uses: { clanId: number; where: string; tokenMatches: boolean }[];
  verified: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  blocked: boolean;
}

const STATUS_CLS: Record<string, string> = {
  open: 'bg-gold/15 text-gold',
  dismissed: 'bg-brown-light text-text-muted',
  blocked: 'bg-red-500/15 text-red-400',
};

/** The staff queue of webhooks shared between clans (lib/sharedWebhooks). */
export default function SharedWebhooksClient({ canWrite }: { canWrite: boolean }) {
  const { confirm, ask, notify } = useDialog();
  const [items, setItems] = useState<Finding[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(f: 'open' | 'all') {
    const res = await clanFetch(`/api/staff/shared-webhooks?status=${f}`);
    if (res.ok) setItems((await res.json()).items);
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
    void load(filter);
  }, [filter]);

  async function act(w: Finding, action: 'block' | 'unblock' | 'dismiss') {
    let reason: string | null = null;
    if (action === 'block') {
      reason = await ask({
        title: `Block webhook ${w.masked}?`,
        body: `This blocks webhook id ${w.masked} for EVERY clan on Anvil, not just these: nothing posts through it and nobody can save it again. ${w.clans.map((c) => c.name).join(', ')} share it; their admins are told to add a new one.`,
        label: 'Note (for the audit log)',
        multiline: true,
        confirmLabel: 'Block webhook',
        tone: 'danger',
      });
      if (reason === null) return;
    } else {
      const ok = await confirm({
        title: action === 'unblock' ? `Unblock webhook ${w.masked}?` : `Leave webhook ${w.masked} as it is?`,
        body:
          action === 'unblock'
            ? 'Posts through it work again for every clan that still has it set up.'
            : 'It drops off this queue. It comes back if another clan starts using it too.',
        confirmLabel: action === 'unblock' ? 'Unblock' : 'Leave it',
      });
      if (!ok) return;
    }
    setBusy(w.webhookId);
    const res = await clanFetch('/api/staff/shared-webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookId: w.webhookId, action, reason }),
    });
    if (!res.ok) notify((await res.json().catch(() => null))?.error ?? 'That did not work.', 'error');
    else notify(action === 'block' ? 'Blocked' : action === 'unblock' ? 'Unblocked' : 'Left as it is');
    await load(filter);
    setBusy(null);
  }

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {(['open', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              filter === f ? 'border-gold bg-gold/20 text-gold' : 'border-card-border text-text-muted hover:border-gold/40'
            }`}
          >
            {f === 'open' ? 'Open' : 'All'}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted">{items.length} shown</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-10 text-center text-text-muted">
          {filter === 'open' ? 'No shared webhooks waiting.' : 'No shared webhooks found yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((w) => (
            <div key={w.webhookId} className="rounded-xl border border-card-border bg-card-bg p-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-semibold">Webhook {w.masked}</code>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLS[w.status] ?? ''}`}>{w.status}</span>
                {w.verified ? (
                  <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[10px] font-medium text-accent-green-light">confirmed real by Discord</span>
                ) : (
                  <span className="rounded-full bg-brown-light px-2 py-0.5 text-[10px] font-medium text-text-muted">not confirmed</span>
                )}
                <span className="text-xs text-text-muted">
                  {w.clans.length} clans · first seen <LocalTime date={w.firstSeenAt} />
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {w.clans.map((c) => (
                  <li key={c.id}>
                    <ClanLink href={`/staff/clans/${c.id}`} className="font-medium hover:text-gold">
                      {c.name}
                    </ClanLink>
                    <span className="text-text-muted">
                      {' '}
                      · {w.uses.filter((u) => u.clanId === c.id && u.tokenMatches).map((u) => u.where).join(', ') || 'no longer set up'}
                    </span>
                  </li>
                ))}
              </ul>
              {w.uses.some((u) => !u.tokenMatches) && (
                <div className="mt-2 rounded-lg border border-card-border bg-bg/40 p-2.5 text-xs text-text-muted">
                  <p className="font-medium text-foreground">Same id, different token</p>
                  <p className="mb-1">
                    These don&apos;t hold the shared webhook: a wrong or made-up token, or a deleted webhook. They prove nothing about the clans above.
                  </p>
                  <ul className="space-y-0.5">
                    {w.uses
                      .filter((u) => !u.tokenMatches)
                      .map((u) => (
                        <li key={`${u.clanId}-${u.where}`}>
                          Clan #{u.clanId} · {u.where}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {canWrite && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {w.blocked ? (
                    <button
                      disabled={busy === w.webhookId}
                      onClick={() => act(w, 'unblock')}
                      className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
                    >
                      Unblock
                    </button>
                  ) : (
                    <button
                      disabled={busy === w.webhookId || !w.verified}
                      title={w.verified ? 'Blocks this webhook id for every clan' : 'Only a webhook Discord confirmed is real can be blocked'}
                      onClick={() => act(w, 'block')}
                      className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Block this webhook (all clans)
                    </button>
                  )}
                  {w.status === 'open' && (
                    <button
                      disabled={busy === w.webhookId}
                      onClick={() => act(w, 'dismiss')}
                      className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 disabled:opacity-50"
                    >
                      Leave it
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
