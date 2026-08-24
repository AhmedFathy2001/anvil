'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PayoutRowControls, { type PayoutRow } from '@/components/PayoutRowControls';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';

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
  placementPrizes: number[];
  /** Non-empty when this board's prizes are stored as SHARES of the pool. */
  placementSplitPct: number[];
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
/** The same suggestion, as the percentages themselves — what the share editor opens with. */
function defaultPercents(paidPlaces: number): string[] {
  return splitPct(paidPlaces).map(String);
}
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
  // 'share' stores percentages and resolves them against the live pool on every read, so the prizes
  // a board advertises grow as its entries are approved. 'fixed' is a flat gp number per place, for
  // a host who promised an exact amount and doesn't want it moving.
  const [mode, setMode] = useState<'share' | 'fixed'>('share');
  const [placePercents, setPlacePercents] = useState<string[]>([]);
  const [includeSubbed, setIncludeSubbed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingSplit, setSavingSplit] = useState(false);
  // Seed the editable inputs from the server exactly once (saved structure if any, else a pool split),
  // so live reloads after saving/generating don't clobber the admin's in-progress edits.
  const seededRef = useRef(false);

  const [newRsn, setNewRsn] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [adding, setAdding] = useState(false);

  const [announcing, setAnnouncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canManage = viewerRole === 'admin' || viewerRole === 'treasurer';

  const load = useCallback(async () => {
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/payouts`);
      if (!res.ok) {
        setErr('Failed to load payouts.');
        return;
      }
      const payload: Payload = await res.json();
      setData(payload);
      // Seed the editable inputs once: prefer a previously-saved prize structure, else a pool split.
      if (!seededRef.current) {
        seededRef.current = true;
        const maxPlaces = Math.max(1, payload.standings.length || 1);
        setPoolBasis(String(payload.pool.total));
        if (payload.placementSplitPct.length > 0) {
          // Already share-based: open in that mode with its own numbers.
          const places = Math.min(payload.placementSplitPct.length, maxPlaces);
          setMode('share');
          setPaidPlaces(places);
          setPlacePercents(payload.placementSplitPct.slice(0, places).map(String));
          setPlaceAmounts(payload.placementPrizes.slice(0, places).map(String));
        } else if (payload.placementPrizes.length > 0) {
          // Fixed gp already saved — leave it alone; switching mode is the host's call.
          const places = Math.min(payload.placementPrizes.length, maxPlaces);
          setMode('fixed');
          setPaidPlaces(places);
          setPlaceAmounts(payload.placementPrizes.slice(0, places).map(String));
          setPlacePercents(defaultPercents(places));
        } else {
          const places = Math.min(3, maxPlaces);
          setPaidPlaces(places);
          setPlacePercents(defaultPercents(places));
          setPlaceAmounts(suggestAmounts(places, payload.pool.total));
        }
      }
    } catch {
      setErr('Network error.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  // Change how many places pay out: resize (and re-split from the pool basis) the reward inputs.
  function changePaidPlaces(n: number) {
    setPaidPlaces(n);
    setPlaceAmounts(suggestAmounts(n, cleanNum(poolBasis)));
    setPlacePercents(defaultPercents(n));
  }

  // Persist the prize-per-placement structure WITHOUT generating rows — advertises it on the event
  // page and lets payouts auto-generate when the event ends.
  async function saveSplit() {
    setSavingSplit(true);
    setErr(null);
    setNotice(null);
    try {
      const amounts = placeAmounts.slice(0, paidPlaces).map(cleanNum);
      const percents = placePercents.slice(0, paidPlaces).map(cleanNum);
      const res = await clanFetch(`/api/admin/events/${eventId}/payouts/prize-split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Share mode stores percentages; the amounts are derived from the pool on every read.
        body: JSON.stringify(mode === 'share' ? { placePercents: percents } : { placeAmounts: amounts }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || 'Could not save the prize split.');
        return;
      }
      await load();
      setNotice('Prize split saved — it now shows on the event page and payouts auto-generate when the event ends.');
    } finally {
      setSavingSplit(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setErr(null);
    setNotice(null);
    try {
      const amounts = placeAmounts.slice(0, paidPlaces).map(cleanNum);
      const res = await clanFetch(`/api/admin/events/${eventId}/payouts/generate`, {
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
      setNotice('Payouts generated — review and edit amounts, then mark each paid.');
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
      const res = await clanFetch(`/api/admin/events/${eventId}/payouts`, {
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
      const res = await clanFetch(`/api/admin/events/${eventId}/payouts/announce`, { method: 'POST' });
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
  // What the split currently pays out. In share mode that's the percentages resolved against the
  // live pool — the same arithmetic the event page does, so the two never disagree.
  const rewardsTotal =
    mode === 'share'
      ? placePercents
          .slice(0, paidPlaces)
          .reduce((sum, p) => sum + Math.round((pool.total * cleanNum(p)) / 100), 0)
      : placeAmounts.slice(0, paidPlaces).reduce((sum, a) => sum + cleanNum(a), 0);
  const sharesTotal = placePercents.slice(0, paidPlaces).reduce((sum, p) => sum + cleanNum(p), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Prize payouts
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Set the prize per placement (shown on the event page), then mark each winner paid — with an optional
          screenshot — and announce them to Discord. Payouts auto-generate from the split when the event ends.
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
            {/* How the prizes are expressed. Shares are the default because a pool that grows with
                every approved entry should carry prizes that grow with it — the fixed mode froze
                them at whatever the pool was the day they were typed, and nothing ever told the
                host it had gone stale. */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['share', 'Share of the pool'],
                  ['fixed', 'Fixed gp'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors ${
                    mode === k
                      ? 'bg-gold text-brown-dark border-gold'
                      : 'border-card-border text-text-muted hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="text-xs text-text-muted self-center ml-1">
                {mode === 'share'
                  ? 'Recalculates as entries are approved.'
                  : 'Stays exactly as typed, whatever the pool does.'}
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {mode === 'fixed' && (
                <label className="text-xs text-text-muted">
                  Prize pool basis (gp)
                  <Input
                    value={poolBasis}
                    onChange={(e) => setPoolBasis(e.target.value)}
                    inputMode="numeric"
                    className="mt-1 block w-40 rounded-lg px-2 py-1.5"
                  />
                </label>
              )}
              <div className="text-xs text-text-muted">
                Paid places
                <Select
                  value={String(paidPlaces)}
                  onChange={(v) => changePaidPlaces(Number(v))}
                  ariaLabel="Paid places"
                  className="mt-1 w-40"
                  options={Array.from({ length: maxPlaces }, (_, i) => i + 1).map((n) => ({
                    value: String(n),
                    label: n === 1 ? '1st only' : n === maxPlaces ? `Top ${n} (all)` : `Top ${n}`,
                  }))}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  mode === 'share'
                    ? setPlacePercents(defaultPercents(paidPlaces))
                    : setPlaceAmounts(suggestAmounts(paidPlaces, cleanNum(poolBasis)))
                }
                className="text-xs font-medium px-3 py-2 rounded-lg border border-card-border text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
              >
                Reset to calc
              </button>
            </div>

            {/* Editable reward per placement — prefilled from the calculation, override any of them.
                In share mode the input is a percentage and the line under it says what that is
                worth against today's pool, so the number stays legible as gp. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(mode === 'share' ? placePercents : placeAmounts).slice(0, paidPlaces).map((val, i) => (
                <label key={i} className="text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    {medal(i + 1)} {ordinal(i + 1)} place
                  </span>
                  <span className="relative mt-1 block">
                    <Input
                      value={val}
                      onChange={(e) =>
                        mode === 'share'
                          ? setPlacePercents((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                          : setPlaceAmounts((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                      }
                      inputMode="numeric"
                      className="block rounded-lg px-2 py-1.5 text-right"
                    />
                    {mode === 'share' && (
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                        %
                      </span>
                    )}
                  </span>
                  {mode === 'share' && (
                    <span className="mt-0.5 block text-right text-[11px] text-gold">
                      {Math.round((pool.total * cleanNum(val)) / 100).toLocaleString()} gp
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-text-muted">
                Total rewards: <span className="text-gold font-semibold">{rewardsTotal.toLocaleString()} gp</span>
              </span>
              {mode === 'share' && (
                <span className={sharesTotal > 100 ? 'text-red-400' : 'text-text-muted'}>
                  {sharesTotal}% of the pool
                  {sharesTotal > 100 ? ' — more than there is' : sharesTotal < 100 ? ' (the rest stays with the clan)' : ''}
                </span>
              )}
              {rewardsTotal !== pool.total && (
                <span className="text-text-muted">(pool is {pool.total.toLocaleString()} gp)</span>
              )}
            </div>

            <Checkbox checked={includeSubbed} onChange={setIncludeSubbed} label="Include subbed-out (benched) players in the split" className="text-xs text-text-muted" />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={saveSplit}
                disabled={savingSplit || generating}
                className="text-sm font-medium bg-gold/15 text-gold border border-gold/40 px-4 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
              >
                {savingSplit ? 'Saving…' : 'Save prize split'}
              </button>
              <button
                onClick={generate}
                disabled={generating || savingSplit}
                className="text-sm font-medium border border-card-border text-foreground px-4 py-2 rounded-lg hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-50"
              >
                {generating ? 'Generating…' : payouts.length ? 'Regenerate payouts now' : 'Generate payouts now'}
              </button>
            </div>

            <p className="text-[11px] text-text-muted">
              <span className="text-foreground/80">Save prize split</span> to advertise the reward per placement on the
              event page — payouts then <span className="text-foreground/80">auto-generate when the event ends</span>.
              <span className="text-foreground/80"> Generate now</span> builds the per-player rows immediately. Rewards
              are prefilled from the pool (default split — 1st 100% · 2nd 60/40 · 3rd 50/30/20), editable per placement,
              and each place is split equally among the winning team&apos;s members. Paid rows are never overwritten.
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
            <Input
              value={newRsn}
              onChange={(e) => setNewRsn(e.target.value)}
              placeholder="Recipient (RSN)"
              className="flex-1 min-w-[10rem] rounded-lg"
            />
            <Input
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              inputMode="numeric"
              placeholder="Amount (gp)"
              className="w-40 rounded-lg"
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
      await clanFetch(`/api/admin/events/${eventId}/payouts/${payout.id}`, {
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
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="numeric"
        className="w-28 rounded-lg px-2 py-1 text-right"
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
