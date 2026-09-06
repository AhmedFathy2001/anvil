'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';
import { formatGp, parseGpInput } from '@/lib/adminEventsFormat';
import type { CofferBalance } from '@/lib/cofferMath';
import type { CofferLedgerRow } from '@/lib/coffer';

/**
 * The coffer, from the treasurer's chair.
 *
 * Ordered by what needs a person: donations waiting to be believed, then prizes waiting to be sent,
 * then the history that explains both. The headline numbers are three because they answer three
 * different questions, and collapsing them into one "balance" is how a clan promises gp it has
 * already spent.
 */
export default function CofferClient({
  balance,
  entries,
}: {
  balance: CofferBalance;
  entries: CofferLedgerRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const pendingDonations = entries.filter((e) => e.kind === 'donation' && e.status === 'pending');
  // Pools belong in this queue too: gp set aside for a board is money a treasurer still has to send,
  // and leaving it out would mean the one movement nobody is ever prompted to complete.
  const owedPrizes = entries.filter(
    (e) => (e.kind === 'award' || e.kind === 'pool') && e.status === 'reserved',
  );

  async function act(entryId: number, action: 'approve' | 'reject' | 'pay' | 'cancel') {
    setBusy(entryId);
    setMsg('');
    try {
      const res = await clanFetch(`/api/admin/coffer/${entryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) router.refresh();
      else setMsg(data.error || 'That did not go through.');
    } finally {
      setBusy(null);
    }
  }

  async function adjust(direction: 1 | -1) {
    const parsed = parseGpInput(adjustAmount);
    if (!parsed) {
      setMsg('Enter an amount, like 50m.');
      return;
    }
    setAdjusting(true);
    setMsg('');
    try {
      const res = await clanFetch('/api/admin/coffer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsed * direction, note: adjustNote || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAdjustAmount('');
        setAdjustNote('');
        router.refresh();
      } else {
        setMsg(data.error || 'That did not go through.');
      }
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-6 bg-gold rounded-full" />
        Coffer
      </h1>
      <p className="text-sm text-text-muted mb-5">
        The pot mission prizes are paid from. Members report what they hand in; nothing counts until
        you say it happened.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Figure label="Available" value={formatGp(balance.available)} accent hint="What a new prize can be funded against" />
        <Figure label="Promised" value={formatGp(balance.reserved)} hint="Won, not yet sent" />
        <Figure label="Confirmed total" value={formatGp(balance.confirmed)} hint="Everything approved, before promises" />
      </div>

      {msg && <p className="text-sm text-amber-300 mb-4">{msg}</p>}

      <Section title="Donations to confirm" count={pendingDonations.length}>
        {pendingDonations.length === 0 ? (
          <Empty>Nothing waiting. Members file these from the clan&apos;s Coffer page.</Empty>
        ) : (
          pendingDonations.map((e) => (
            <Row key={e.id}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {e.memberName ?? e.rsn ?? 'Someone'} says they donated{' '}
                  <span className="text-gold">{formatGp(Math.abs(e.amount))}</span>
                </p>
                <p className="text-[11px] text-text-muted truncate">
                  {e.createdAt}
                  {e.note ? ` · ${e.note}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {e.proofBlobUrl && (
                  <a
                    href={e.proofBlobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-text-muted hover:text-foreground underline"
                  >
                    Proof
                  </a>
                )}
                <button
                  type="button"
                  disabled={busy === e.id}
                  onClick={() => act(e.id, 'approve')}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  disabled={busy === e.id}
                  onClick={() => act(e.id, 'reject')}
                  className="text-xs px-2.5 py-1 rounded-lg border border-card-border text-text-muted hover:text-red-400 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
              </div>
            </Row>
          ))
        )}
      </Section>

      <Section title="Prizes to send" count={owedPrizes.length}>
        {owedPrizes.length === 0 ? (
          <Empty>Nothing is waiting to be sent.</Empty>
        ) : (
          owedPrizes.map((e) => (
            <Row key={e.id}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  <span className="text-gold">{formatGp(Math.abs(e.amount))}</span>{' '}
                  {e.kind === 'pool' ? 'for a board' : `to ${e.memberName ?? e.rsn ?? 'a winner'}`}
                </p>
                <p className="text-[11px] text-text-muted truncate">
                  {e.note ?? (e.kind === 'pool' ? 'Prize pool' : 'Mission prize')}
                  {e.place ? ` · place ${e.place}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  disabled={busy === e.id}
                  onClick={() => act(e.id, 'pay')}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
                >
                  Sent it
                </button>
                <button
                  type="button"
                  disabled={busy === e.id}
                  onClick={() => act(e.id, 'cancel')}
                  className="text-xs px-2.5 py-1 rounded-lg border border-card-border text-text-muted hover:text-red-400 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </Row>
          ))
        )}
      </Section>

      <Section title="Correct the pot">
        <div className="p-3 space-y-2">
          <p className="text-[11px] text-text-muted">
            For gp that moved outside Anvil — seeding the pot, spending it on something else, fixing a
            confirmed mistake. Recorded as its own line with your name on it.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="text"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="50m"
              className="w-28"
              aria-label="Adjustment amount"
            />
            <Input
              type="text"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="What happened?"
              className="w-64"
              aria-label="Adjustment note"
            />
            <button
              type="button"
              disabled={adjusting}
              onClick={() => adjust(1)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              disabled={adjusting}
              onClick={() => adjust(-1)}
              className="text-xs px-2.5 py-1 rounded-lg border border-card-border text-text-muted hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Take out
            </button>
          </div>
        </div>
      </Section>

      <Section title="Everything that has moved" count={entries.length}>
        {entries.length === 0 ? (
          <Empty>The ledger is empty.</Empty>
        ) : (
          <div className="divide-y divide-card-border/60">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs truncate">
                    <span className={e.amount >= 0 ? 'text-accent-green-light' : 'text-foreground'}>
                      {e.amount >= 0 ? '+' : '−'}
                      {formatGp(Math.abs(e.amount))}
                    </span>
                    <span className="text-text-muted"> · {kindLabel(e)}</span>
                    {(e.memberName ?? e.rsn) && <span className="text-text-muted"> · {e.memberName ?? e.rsn}</span>}
                  </p>
                  {e.note && <p className="text-[10px] text-text-muted truncate">{e.note}</p>}
                </div>
                <span className={`text-[10px] flex-shrink-0 ${statusTone(e.status)}`}>{statusLabel(e.status)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function kindLabel(e: CofferLedgerRow): string {
  if (e.kind === 'donation') return 'donation';
  if (e.kind === 'award') return e.place ? `prize (place ${e.place})` : 'prize';
  if (e.kind === 'pool') return 'prize pool';
  if (e.kind === 'refund') return 'refund';
  return 'adjustment';
}

function statusLabel(status: string): string {
  if (status === 'unfunded') return 'not funded';
  if (status === 'reserved') return 'to send';
  return status;
}

function statusTone(status: string): string {
  if (status === 'pending' || status === 'reserved') return 'text-gold';
  if (status === 'rejected' || status === 'cancelled') return 'text-text-muted/60 line-through';
  if (status === 'unfunded') return 'text-amber-300';
  return 'text-text-muted';
}

function Figure({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-gold' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{hint}</p>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        {title}
        {count != null && count > 0 && <span className="text-sm font-normal text-text-muted">({count})</span>}
      </h2>
      <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-card-border/60 last:border-b-0">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-4 text-sm text-text-muted">{children}</p>;
}
