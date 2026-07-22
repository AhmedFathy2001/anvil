'use client';

import { useCallback, useEffect, useState } from 'react';
import PayoutRowControls, { type PayoutRow } from '@/components/PayoutRowControls';

interface Payout extends PayoutRow {
  clanMemberId: number | null;
  rsn: string;
  teamId: number | null;
  teamName: string | null;
  place: number | null;
  amount: number;
}

interface Standing {
  teamId: number;
  name: string;
  color: string;
  score: number;
  total: number;
  unit: string;
  pct: number;
}

interface Pool {
  total: number;
  added: number;
  signupFee: number;
  approvedCount: number;
}

interface Payload {
  payouts: Payout[];
  pool: Pool;
  standings: Standing[];
  announcedAt: string | null;
  allPaid: boolean;
}

interface Props {
  eventId: number;
  viewerRole: string;
}

function medal(place: number | null): string {
  return place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : place ? `#${place}` : '•';
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

// Client mirror of lib/payouts defaultSplit — used to PREFILL the per-placement rewards from the
// pool. The server still recomputes from the amounts it's sent, so this is presentation only.
function splitPct(n: number): number[] {
  if (n <= 1) return [100];
  if (n === 2) return [60, 40];
  if (n === 3) return [50, 30, 20];
  const weights = Array.from({ length: n }, (_, i) => n - i);
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.round((w / sum) * 100));
}

const cleanNum = (s: string) => Number(String(s).replace(/[, ]/g, ''));
function suggestAmounts(paidPlaces: number, basis: number): string[] {
  return splitPct(paidPlaces).map((pct) => String(Math.round((basis * pct) / 100)));
}

export default function PayoutsClient({ eventId, viewerRole }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Prize-pool basis the per-placement rewards are calculated from (prefilled with the real pool),
  // how many places pay out, and the resulting editable gp reward per placement.
  const [paidPlaces, setPaidPlaces] = useState(3);
  const [poolBasis, setPoolBasis] = useState('');
  const [placeAmounts, setPlaceAmounts] = useState<string[]>([]);
  const [includeSubbed, setIncludeSubbed] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [newRsn, setNewRsn] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [adding, setAdding] = useState(false);

  const [announcing, setAnnouncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canManage = viewerRole === 'admin' || viewerRole === 'treasurer';

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/payouts`);
      if (!res.ok) {
        setErr('Failed to load payouts.');
        return;
      }
      const payload: Payload = await res.json();
      setData(payload);
      // Seed the pool basis once, and clamp the place count to the number of teams that exist.
      setPoolBasis((prev) => (prev === '' ? String(payload.pool.total) : prev));
      setPaidPlaces((prev) => Math.min(prev, Math.max(1, payload.standings.length || prev)));
    } catch {
      setErr('Network error.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  // Recalculate the per-placement rewards whenever the pool basis or place count changes — these are
  // the "calculation" inputs. Editing an individual place's reward doesn't retrigger this, so manual
  // fine-tuning sticks until the basis or place count is changed again.
  useEffect(() => {
    if (poolBasis.trim() === '') return;
    const basis = cleanNum(poolBasis);
    if (!Number.isFinite(basis)) return;
    setPlaceAmounts(suggestAmounts(paidPlaces, basis));
  }, [paidPlaces, poolBasis]);

  async function generate() {
    setGenerating(true);
    setErr(null);
    setNotice(null);
    try {
      const amounts = placeAmounts.slice(0, paidPlaces).map(cleanNum);
      const res = await fetch(`/api/admin/events/${eventId}/payouts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidPlaces, placeAmounts: amounts, includeSubbed }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || 'Generate failed.');
        return;
      }
      await load();
      setNotice('Suggested payouts generated — review and edit amounts, then mark each paid.');
    } finally {
      setGenerating(false);
    }
  }

  async function addManual() {
    const rsn = newRsn.trim();
    const amount = Number(newAmount.replace(/[, ]/g, ''));
    if (!rsn || !Number.isFinite(amount) || amount < 0) {
      setErr('Enter a recipient name and a valid amount.');
      return;
    }
    setAdding(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsn, amount }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || 'Could not add payout.');
        return;
      }
      setNewRsn('');
      setNewAmount('');
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function announce() {
    setAnnouncing(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/payouts/announce`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error || 'Announce failed.');
        return;
      }
      await load();
      setNotice('Winners announced to the bingo Discord channel.');
    } finally {
      setAnnouncing(false);
    }
  }

  if (loading) return <p className="text-text-muted text-sm">Loading payouts…</p>;
  if (!data) return <p className="text-red-400 text-sm">{err || 'Failed to load.'}</p>;

  const { payouts, pool, standings, announcedAt } = data;
  const totalPending = payouts.filter((p) => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);
  const totalPaid = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const paidCount = payouts.filter((p) => p.status === 'paid').length;
  const maxPlaces = Math.max(1, standings.length);
  const rewardsTotal = placeAmounts.slice(0, paidPlaces).reduce((s, a) => s + cleanNum(a), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Prize payouts
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Generate per-player prize splits from the final standings, mark each winner paid (with an optional
          screenshot), and announce the winners to Discord.
        </p>
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}
      {notice && <p className="text-sm text-accent-green-light">{notice}</p>}

      {/* Prize pool + generation */}
      <div className="border border-card-border rounded-xl p-5 bg-card-bg space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="text-text-muted">Prize pool </span>
            <span className="font-bold text-gold">{pool.total.toLocaleString()} gp</span>
          </div>
          <div className="text-xs text-text-muted">
            {pool.added.toLocaleString()} added + {pool.signupFee.toLocaleString()} fee ×{' '}
            {pool.approvedCount} entr{pool.approvedCount === 1 ? 'y' : 'ies'}
          </div>
        </div>

        {canManage && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-text-muted">
                Prize pool basis (gp)
                <input
                  value={poolBasis}
                  onChange={(e) => setPoolBasis(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 block w-40 bg-brown-dark border border-card-border rounded-lg px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-text-muted">
                Paid places
                <select
                  value={paidPlaces}
                  onChange={(e) => setPaidPlaces(Number(e.target.value))}
                  className="mt-1 block bg-brown-dark border border-card-border rounded-lg px-2 py-1.5 text-sm text-foreground"
                >
                  {Array.from({ length: maxPlaces }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? '1st only' : n === maxPlaces ? `Top ${n} (all)` : `Top ${n}`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setPlaceAmounts(suggestAmounts(paidPlaces, cleanNum(poolBasis)))}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-card-border text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
              >
                Reset to calc
              </button>
            </div>

            {/* Editable reward per placement — prefilled from the calculation, override any of them. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {placeAmounts.slice(0, paidPlaces).map((amt, i) => (
                <label key={i} className="text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    {medal(i + 1)} {ordinal(i + 1)} place
                  </span>
                  <input
                    value={amt}
                    onChange={(e) =>
                      setPlaceAmounts((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                    }
                    inputMode="numeric"
                    className="mt-1 block w-full bg-brown-dark border border-card-border rounded-lg px-2 py-1.5 text-sm text-right text-foreground"
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-text-muted">
                Total rewards: <span className="text-gold font-semibold">{rewardsTotal.toLocaleString()} gp</span>
              </span>
              {rewardsTotal !== pool.total && (
                <span className="text-text-muted">(pool is {pool.total.toLocaleString()} gp)</span>
              )}
            </div>

            <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={includeSubbed}
                onChange={(e) => setIncludeSubbed(e.target.checked)}
                className="accent-gold"
              />
              Include subbed-out (benched) players in the split
            </label>

            <button
              onClick={generate}
              disabled={generating}
              className="text-sm font-medium bg-gold/15 text-gold border border-gold/40 px-4 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating…' : payouts.length ? 'Regenerate payouts' : 'Generate payouts'}
            </button>

            <p className="text-[11px] text-text-muted">
              Rewards are calculated from the pool basis (default split — 1st 100% · 2nd 60/40 · 3rd 50/30/20) and
              editable per placement. Each place is divided equally among the winning team&apos;s members, and every
              row stays editable afterward. Paid rows are never overwritten.
            </p>
          </div>
        )}

        {/* Standings reference */}
        {standings.length > 0 && (
          <div className="text-xs text-text-muted">
            <span className="uppercase tracking-wide">Standings: </span>
            {standings.slice(0, 5).map((s, i) => (
              <span key={s.teamId} className="mr-3">
                {medal(i + 1)} <span className="text-foreground/80">{s.name}</span> ({s.score}/{s.total} {s.unit})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Payout rows */}
      {payouts.length === 0 ? (
        <p className="text-sm text-text-muted border border-dashed border-card-border rounded-xl p-4">
          No payouts yet. Generate them from the standings above, or add a recipient manually below.
        </p>
      ) : (
        <div className="space-y-2">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="border border-card-border rounded-xl p-4 bg-card-bg flex flex-wrap items-center gap-x-4 gap-y-3"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-lg w-7 text-center shrink-0">{medal(p.place)}</span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.rsn}</div>
                  {p.teamName && <div className="text-xs text-text-muted truncate">{p.teamName}</div>}
                </div>
              </div>

              <AmountCell
                payout={p}
                eventId={eventId}
                canManage={canManage}
                onChanged={load}
              />

              <StatusPill status={p.status} paidAt={p.paidAt} />

              {canManage && (
                <PayoutRowControls payout={p} eventId={eventId} viewerRole={viewerRole} onChanged={load} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Totals + manual add + announce */}
      {payouts.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm border-t border-card-border pt-3">
          <span className="text-text-muted">
            Pending: <span className="text-foreground font-medium">{totalPending.toLocaleString()} gp</span>
          </span>
          <span className="text-text-muted">
            Paid: <span className="text-accent-green-light font-medium">{totalPaid.toLocaleString()} gp</span>
          </span>
        </div>
      )}

      {canManage && (
        <div className="border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <span className="w-1 h-4 bg-gold rounded-full" />
            Add a recipient manually
          </h3>
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={newRsn}
              onChange={(e) => setNewRsn(e.target.value)}
              placeholder="Recipient (RSN)"
              className="flex-1 min-w-[10rem] bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm text-foreground"
            />
            <input
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              inputMode="numeric"
              placeholder="Amount (gp)"
              className="w-40 bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm text-foreground"
            />
            <button
              onClick={addManual}
              disabled={adding}
              className="text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/25 transition-colors disabled:opacity-50"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {canManage && (
        <div className="border border-card-border rounded-xl p-4 bg-card-bg flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium">Announce winners to Discord</div>
            <div className="text-xs text-text-muted">
              {announcedAt
                ? `Last announced ${new Date(announcedAt).toLocaleString()}. Auto-posts when every payout is paid.`
                : `Auto-posts to the bingo channel once every payout is marked paid — or send it now (${paidCount} paid).`}
            </div>
          </div>
          <button
            onClick={announce}
            disabled={announcing || paidCount === 0}
            className="text-sm font-medium bg-gold/15 text-gold border border-gold/40 px-4 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
          >
            {announcing ? 'Posting…' : announcedAt ? 'Re-announce' : 'Announce now'}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, paidAt }: { status: string; paidAt: string | null }) {
  const paid = status === 'paid';
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-xs font-medium shrink-0 ${
        paid
          ? 'bg-accent-green/15 text-accent-green-light border-accent-green/25'
          : 'bg-text-muted/15 text-text-muted border-text-muted/25'
      }`}
      title={paid && paidAt ? `Paid ${new Date(paidAt).toLocaleString()}` : undefined}
    >
      {paid ? 'Paid' : 'Pending'}
    </span>
  );
}

// Inline editable amount. Locked once paid (unpay to edit). Saves via PATCH on the Save affordance.
function AmountCell({
  payout,
  eventId,
  canManage,
  onChanged,
}: {
  payout: Payout;
  eventId: number;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(String(payout.amount));
  const [saving, setSaving] = useState(false);
  const dirty = value.replace(/[, ]/g, '') !== String(payout.amount);
  const locked = payout.status === 'paid' || !canManage;

  async function save() {
    const amount = Number(value.replace(/[, ]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/events/${eventId}/payouts/${payout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  if (locked) {
    return <div className="text-sm font-semibold text-gold shrink-0 w-32 text-right">{payout.amount.toLocaleString()} gp</div>;
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="numeric"
        className="w-28 bg-brown-dark border border-card-border rounded-lg px-2 py-1 text-sm text-right text-foreground"
      />
      <span className="text-xs text-text-muted">gp</span>
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="text-xs font-medium px-2 py-1 rounded border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
      )}
    </div>
  );
}
