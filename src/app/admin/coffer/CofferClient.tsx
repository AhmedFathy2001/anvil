'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';
import { formatGp, parseGpInput } from '@/lib/adminEventsFormat';
import { splitEvenly } from '@/lib/splitGp';
import GuideLink from '@/components/GuideLink';
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
export interface DonorSeat {
  id: number;
  rsn: string;
  kind: string;
}

export default function CofferClient({
  balance,
  entries,
  roster,
}: {
  balance: CofferBalance;
  entries: CofferLedgerRow[];
  /** Who a donation can be credited to — every current seat, guests included. */
  roster: DonorSeat[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Recording a donation on somebody's behalf. `shares` is keyed by seat id so a name can be added
  // or dropped without disturbing what the others were typed as.
  const [donorSearch, setDonorSearch] = useState('');
  const [shares, setShares] = useState<Record<number, string>>({});
  const [donationTotal, setDonationTotal] = useState('');
  const [donationNote, setDonationNote] = useState('');
  const [recording, setRecording] = useState(false);

  const chosen = roster.filter((r) => r.id in shares);
  const matches = donorSearch.trim()
    ? roster
        .filter((r) => !(r.id in shares) && r.rsn.toLowerCase().includes(donorSearch.trim().toLowerCase()))
        .slice(0, 8)
    : [];
  const donationSum = chosen.reduce((sum, r) => sum + (parseGpInput(shares[r.id] ?? '') ?? 0), 0);

  function addDonor(seat: DonorSeat) {
    setShares((prev) => ({ ...prev, [seat.id]: '' }));
    setDonorSearch('');
  }

  function dropDonor(id: number) {
    setShares((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  /** Divide the typed total between everyone chosen, to the gp. */
  function splitTotal() {
    const total = parseGpInput(donationTotal);
    if (!total || chosen.length === 0) {
      setMsg('Pick who it came from, then enter the total.');
      return;
    }
    const amounts = splitEvenly(total, chosen.length);
    setShares(Object.fromEntries(chosen.map((r, i) => [r.id, String(amounts[i])])));
    setMsg('');
  }

  async function recordDonation() {
    const donors = chosen
      .map((r) => ({ clanMemberId: r.id, rsn: r.rsn, amount: parseGpInput(shares[r.id] ?? '') ?? 0 }))
      .filter((d) => d.amount > 0);
    if (donors.length === 0) {
      setMsg('Give at least one donor an amount.');
      return;
    }
    setRecording(true);
    setMsg('');
    try {
      const res = await clanFetch('/api/admin/coffer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donors, note: donationNote || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShares({});
        setDonationTotal('');
        setDonationNote('');
        router.refresh();
      } else {
        setMsg(data.error || 'That did not go through.');
      }
    } finally {
      setRecording(false);
    }
  }

  const pendingDonations = entries.filter((e) => e.kind === 'donation' && e.status === 'pending');
  // Pools belong in this queue too: gp set aside for a board is money a treasurer still has to send,
  // and leaving it out would mean the one movement nobody is ever prompted to complete. A planned
  // pool is here as well — it is unpaid money owed to a board, whether or not it is held.
  const owedPrizes = entries.filter(
    (e) => (e.kind === 'award' || e.kind === 'pool') && (e.status === 'reserved' || e.status === 'planned'),
  );

  /**
   * Where the gp went, and what is still promised.
   *
   * The full ledger below answers "what happened" and is mostly donations; this answers the question
   * a treasurer is actually asked in Discord — what has this clan promised, and what has it paid.
   * Prizes and pools are the site's own movements; a negative adjustment is the same thing done by
   * hand, so both belong here or the log quietly under-reports what left.
   */
  const moneyOut = entries.filter(
    (e) => e.kind === 'award' || e.kind === 'pool' || (e.kind === 'adjustment' && e.amount < 0),
  );
  const stillOwed = moneyOut
    .filter((e) => e.status === 'reserved' || e.status === 'planned' || e.status === 'unfunded')
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const paidOut = moneyOut
    .filter((e) => e.status === 'paid' || e.kind === 'adjustment')
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

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
        <GuideLink href="/guide/coffer">How the coffer works</GuideLink>
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

      <Section title="Record a donation">
        <div className="p-3 space-y-3">
          <p className="text-[11px] text-text-muted">
            For gp handed over in game rather than reported through the site. Credited to whoever gave
            it, so the top-donor list can thank them — split it between several people if they chipped
            in together. It lands approved: you entering it is the approval.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {chosen.map((seat) => (
              <span
                key={seat.id}
                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-gold/10 border border-gold/30"
              >
                <span className="text-gold">{seat.rsn}</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={shares[seat.id] ?? ''}
                  onChange={(e) => setShares((prev) => ({ ...prev, [seat.id]: e.target.value }))}
                  placeholder="amount"
                  className="w-20 !py-0.5 !px-1.5 text-[11px]"
                  aria-label={`Amount from ${seat.rsn}`}
                />
                <button
                  type="button"
                  onClick={() => dropDonor(seat.id)}
                  className="text-text-muted hover:text-red-400 transition-colors"
                  aria-label={`Remove ${seat.rsn}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="relative">
            <Input
              type="text"
              value={donorSearch}
              onChange={(e) => setDonorSearch(e.target.value)}
              placeholder="Who gave it? Search the roster…"
              className="w-64"
              aria-label="Search the roster for a donor"
            />
            {matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-64 rounded-lg border border-card-border bg-card-bg shadow-lg overflow-hidden">
                {matches.map((seat) => (
                  <button
                    key={seat.id}
                    type="button"
                    onClick={() => addDonor(seat)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gold/10 transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{seat.rsn}</span>
                    {seat.kind === 'guest' && <span className="text-[10px] text-text-muted">guest</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {chosen.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
              <span>Chipped in together?</span>
              <Input
                type="text"
                inputMode="numeric"
                value={donationTotal}
                onChange={(e) => setDonationTotal(e.target.value)}
                placeholder="total, e.g. 100m"
                className="w-32"
                aria-label="Total donation to split"
              />
              <button
                type="button"
                onClick={splitTotal}
                className="text-[11px] font-semibold px-2 py-1 rounded-md bg-card-border/40 hover:text-foreground transition-colors"
              >
                Split {chosen.length} ways
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="text"
              value={donationNote}
              onChange={(e) => setDonationNote(e.target.value)}
              placeholder="What was it for?"
              className="w-64"
              aria-label="Donation note"
            />
            <button
              type="button"
              disabled={recording || donationSum <= 0}
              onClick={recordDonation}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
            >
              {recording ? 'Recording…' : 'Record donation'}
            </button>
            {donationSum > 0 && (
              <span className="text-[11px] text-text-muted">
                {formatGp(donationSum)} gp from {chosen.filter((r) => (parseGpInput(shares[r.id] ?? '') ?? 0) > 0).length}{' '}
                {chosen.length === 1 ? 'person' : 'people'}
              </span>
            )}
          </div>
        </div>
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

      <Section title="Holds and payouts" count={moneyOut.length}>
        <div className="px-3 py-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-text-muted border-b border-card-border/60">
          <span>
            <span className="text-gold font-semibold">{formatGp(stillOwed)}</span> still owed
          </span>
          <span>
            <span className="text-accent-green-light font-semibold">{formatGp(paidOut)}</span> paid out
          </span>
          <span className="text-text-muted/70">Prizes, board pools and gp taken out by hand.</span>
        </div>
        {moneyOut.length === 0 ? (
          <Empty>Nothing has gone out yet.</Empty>
        ) : (
          <div className="divide-y divide-card-border/60">
            {moneyOut.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs truncate">
                    <span className="text-gold">{formatGp(Math.abs(e.amount))}</span>
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
  // A pool the host chose not to hold: promised to a board, but the coffer can still spend it.
  if (status === 'planned') return 'promised, not held';
  return status;
}

function statusTone(status: string): string {
  if (status === 'pending' || status === 'reserved') return 'text-gold';
  // Deliberately not gold: a promise the coffer is still free to spend is a weaker claim than a
  // hold, and colouring them alike is how the two get read as the same thing.
  if (status === 'planned') return 'text-blue-300/80';
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
