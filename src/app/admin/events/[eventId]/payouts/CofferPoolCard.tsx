'use client';

import { useCallback, useEffect, useState } from 'react';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';
import { formatGp, parseGpInput } from '@/lib/adminEventsFormat';
import Checkbox from '@/components/Checkbox';
import GuideLink from '@/components/GuideLink';

interface PoolState {
  funded: number;
  status: string | null;
  /** Whether the gp is actually held right now, as opposed to merely promised. */
  held: boolean;
  balance: { available: number };
}

/**
 * Money this board takes out of the clan coffer.
 *
 * One number, on purpose. The board already knows how to divide a pot — fees, the host's bonus and
 * this all land in the same pool and get split across placements below — so the coffer's job is to
 * commit the gp and record that it left, not to name winners a second time.
 *
 * The amount is stored as a ledger row rather than folded into the event's "added" field, which is
 * what keeps the two from disagreeing: take the pool back and the board stops counting it in the
 * same breath, with no second number to remember to edit.
 */
export default function CofferPoolCard({
  eventId,
  canManage,
  onSaved,
}: {
  eventId: number;
  canManage: boolean;
  /** Reload the payouts payload, whose pool total this changes. */
  onSaved: () => void;
}) {
  const [state, setState] = useState<PoolState | null>(null);
  const [input, setInput] = useState('');
  // Held by default. The gp is promised either way; this decides whether the coffer can also spend
  // it while the promise stands, and the answer that surprises nobody is no.
  const [hold, setHold] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/prize-pool`);
      if (!res.ok) return;
      const data: PoolState = await res.json();
      setState(data);
      setInput(data.funded > 0 ? String(data.funded) : '');
      if (data.funded > 0) setHold(data.held);
    } catch {
      // A card that can't load is a card that isn't shown — the pool total above still reads right.
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return null;

  const paid = state.status === 'paid';

  async function save(amount: number, holding = hold) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/prize-pool`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, hold: holding }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not set the prize pool.');
      setState(data);
      setInput(data.funded > 0 ? String(data.funded) : '');
      if (data.funded > 0) setHold(data.held);
      setMsg({
        type: 'success',
        text:
          data.funded === 0
            ? 'Taken back — nothing is promised to this board now.'
            : data.held
              ? `${formatGp(data.funded)} gp held for this board.`
              : `${formatGp(data.funded)} gp promised, not held — the coffer can still spend it.`,
      });
      onSaved();
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Could not set the prize pool.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-card-border pt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <p className="text-sm font-medium">From the clan coffer</p>
        <div className="flex items-center gap-3">
          <GuideLink href="/guide/coffer#out">How prizes work</GuideLink>
          <span className="text-xs text-text-muted">{formatGp(state.balance.available)} gp available</span>
        </div>
      </div>
      <p className="text-xs text-text-muted mb-3">
        Adds to this board&apos;s prize pool and comes out of the coffer when it is paid. The split
        across placements is set below, as usual.
      </p>

      {paid ? (
        <p className="text-xs text-accent-green-light">
          {formatGp(state.funded)} gp paid out. A change now is an adjustment on the coffer page — the
          money has already left.
        </p>
      ) : canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 500m"
            className="w-32"
            aria-label="Prize money from the clan coffer"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => save(parseGpInput(input) ?? 0)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gold/90 text-brown-dark hover:bg-gold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : state.funded > 0 ? 'Update' : 'Set aside'}
          </button>
          {state.funded > 0 && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save(0)}
              className="px-2.5 py-1.5 text-xs rounded-lg text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Take it back
            </button>
          )}
          {msg && (
            <span className={`text-xs ${msg.type === 'error' ? 'text-red-400' : 'text-accent-green-light'}`}>
              {msg.text}
            </span>
          )}
        </div>
      ) : null}

      {!paid && canManage ? (
        <div className="mt-3">
          <Checkbox
            checked={hold}
            onChange={(checked) => {
              setHold(checked);
              // Applied straight away when a pool already exists: leaving the page with a ticked box
              // and an unheld pool would be the screen telling you something untrue about your money.
              if (state.funded > 0) void save(parseGpInput(input) ?? state.funded, checked);
            }}
            disabled={saving}
            label="Hold this gp in the coffer until it's paid"
            description="It hasn't left yet, so this decides whether the coffer may spend it in the meantime. Held, nothing else — no other board, no mission prize — can promise the same gp. Unheld, the pool is still advertised on the event and still on the ledger, but the coffer stays free to fund something sooner."
          />
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          {state.funded > 0
            ? `${formatGp(state.funded)} gp ${state.held ? 'held' : 'promised, not held'}.`
            : 'Nothing set aside.'}
        </p>
      )}
    </div>
  );
}
