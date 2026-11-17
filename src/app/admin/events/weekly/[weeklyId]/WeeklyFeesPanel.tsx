'use client';

import { useCallback, useEffect, useState } from 'react';

import { formatGp } from '@/lib/adminEventsFormat';
import { clanFetch } from '@/lib/clanFetch';
import { formatWait } from '@/lib/feeReminderText';

interface Row {
  participantId: number;
  rsn: string;
  feeAmount: number | null;
  feeStatus: string | null;
  confirmations: number;
  selfEntered: boolean;
}
interface Sheet {
  entryFee: number | null;
  selfSignup: boolean;
  rows: Row[];
  owedGp: number;
  inHandGp: number;
  settledGp: number;
  required: number;
  feesToPrizes: boolean;
  potGp: number;
}

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Owes', tone: 'text-amber-300' },
  collected: { label: 'Collected, to confirm', tone: 'text-sky-300' },
  confirmed: { label: 'Paid', tone: 'text-accent-green-light' },
};

/**
 * A competition's entry fees (lib/weeklySignups): who owes, who has paid, and the moves staff make.
 * Shown only on a competition with a fee, or one where a fee was once recorded.
 */
export default function WeeklyFeesPanel({ competitionId, canCollect, canConfirm }: { competitionId: number; canCollect: boolean; canConfirm: boolean }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reminded, setReminded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await clanFetch(`/api/admin/weekly/${competitionId}/fees`);
    if (res.ok) setSheet(await res.json());
  }, [competitionId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function move(participantId: number, action: 'collect' | 'confirm' | 'reset' | 'waive') {
    setBusy(participantId);
    setError(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? 'That didn’t work.');
      else setSheet((s) => (s ? { ...s, ...data } : s));
    } finally {
      setBusy(null);
    }
  }

  async function remind() {
    setReminding(true);
    setError(null);
    setReminded(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/fees/remind`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.waitMs ? `${data.error} Try again in ${formatWait(data.waitMs)}.` : (data.error ?? 'Could not send reminders.'));
      else setReminded(`Messaged ${data.sent} on Discord${data.failed ? `, ${data.failed} could not be reached` : ''}${data.unreachable ? `, ${data.unreachable} have no Discord linked` : ''}.`);
    } finally {
      setReminding(false);
    }
  }

  if (!sheet) return null;
  const anyFee = sheet.rows.some((r) => r.feeStatus != null);
  if (!sheet.entryFee && !anyFee) return null;
  const button = 'rounded-md border border-card-border px-2.5 py-1 text-xs text-foreground/85 transition-colors hover:border-gold/50 hover:text-gold disabled:opacity-50';

  return (
    <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 bg-gold" />
          <h2 className="text-lg font-semibold">Entry fees</h2>
        </div>
        <p className="text-sm text-text-muted">
          {sheet.entryFee ? `${formatGp(sheet.entryFee)} gp each · ` : ''}
          <span className="text-amber-300">{formatGp(sheet.owedGp)} owed</span> · <span className="text-sky-300">{formatGp(sheet.inHandGp)} to confirm</span> ·{' '}
          <span className="text-accent-green-light">{formatGp(sheet.settledGp)} paid</span>
        </p>
      </div>
      <p className="mb-3 text-sm text-text-muted">
        Fees are paid in game. Mark one collected when you have the gp
        {sheet.required > 0 ? `; ${sheet.required === 1 ? 'another admin confirms it' : `${sheet.required} other admins confirm it`}.` : '.'} Someone who owes is still on the
        board: take them out below if they don&apos;t pay.
      </p>
      {canCollect && sheet.owedGp > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button type="button" className={button} disabled={reminding} onClick={remind}>
            {reminding ? 'Sending…' : 'Remind everyone who owes'}
          </button>
          <span className="text-xs text-text-dim">A Discord message to each person, at most once every 12 hours.</span>
          {reminded && <span className="text-sm text-accent-green-light">{reminded}</span>}
        </div>
      )}
      {sheet.feesToPrizes && (
        <p className="mb-3 text-sm text-text-muted">
          Entry fees are added to the prizes: each one you confirm goes into the clan coffer, {formatGp(sheet.potGp)} gp so far.
        </p>
      )}
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <ul className="divide-y divide-card-border/60">
        {sheet.rows.map((r) => {
          const st = r.feeStatus ? STATUS[r.feeStatus] : null;
          return (
            <li key={r.participantId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <span className="font-medium">{r.rsn}</span>
                {!r.selfEntered && <span className="ml-2 text-xs text-text-dim">added by staff</span>}
                <span className={`ml-2 text-sm ${st?.tone ?? 'text-text-dim'}`}>
                  {st ? `${st.label}${r.feeAmount ? ` · ${formatGp(r.feeAmount)} gp` : ''}` : 'No fee'}
                  {r.feeStatus === 'collected' && sheet.required > 1 ? ` (${r.confirmations}/${sheet.required})` : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {canCollect && (r.feeStatus === 'pending' || (r.feeStatus == null && !!sheet.entryFee)) && (
                  <button type="button" className={button} disabled={busy === r.participantId} onClick={() => move(r.participantId, 'collect')}>
                    Mark collected
                  </button>
                )}
                {canConfirm && r.feeStatus === 'collected' && (
                  <button type="button" className={button} disabled={busy === r.participantId} onClick={() => move(r.participantId, 'confirm')}>
                    Confirm
                  </button>
                )}
                {canConfirm && r.feeStatus === 'pending' && (
                  <button type="button" className={button} disabled={busy === r.participantId} onClick={() => move(r.participantId, 'waive')}>
                    No fee for them
                  </button>
                )}
                {canConfirm && (r.feeStatus === 'collected' || r.feeStatus === 'confirmed') && (
                  <button type="button" className={button} disabled={busy === r.participantId} onClick={() => move(r.participantId, 'reset')}>
                    Undo
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
