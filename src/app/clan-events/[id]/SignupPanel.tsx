'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import SignupQuestions, { type AnswerValue } from '@/components/SignupQuestions';
import { clanFetch } from '@/lib/clanFetch';
import type { SurveyQuestionView } from '@/lib/survey';

const FEE: Record<string, string> = {
  pending: 'not marked paid yet — hand it to a staff member',
  collected: 'paid, waiting on a second check',
  confirmed: 'paid ✓',
  disputed: 'disputed — talk to staff',
  closed: 'closed',
};

/** Sign up for a clan event with the host's questions, change your answers, or take your name off. */
export default function SignupPanel(props: {
  id: number;
  open: boolean;
  reason: string | null;
  canSign: boolean;
  signedIn: boolean;
  questions: SurveyQuestionView[];
  seats: { id: number; rsn: string }[];
  mine: { status: string; clanMemberId: number | null; answers: Record<string, AnswerValue> | null; feeStatus: string | null; feeAmount: number | null } | null;
  approval: boolean;
}) {
  const router = useRouter();
  const { mine } = props;
  const active = mine?.status === 'pending' || mine?.status === 'approved';
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(mine?.answers ?? {});
  const [seat, setSeat] = useState<number | null>(mine?.clanMemberId ?? props.seats[0]?.id ?? null);
  const [editing, setEditing] = useState(!active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: 'POST' | 'DELETE') {
    setBusy(true);
    setError(null);
    const r = await clanFetch(`/api/clan-events/${props.id}/signup`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ clanMemberId: seat, answers }) : undefined,
    });
    setBusy(false);
    if (!r.ok) return setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Couldn’t save that.');
    setEditing(false);
    router.refresh();
  }

  if (!props.canSign) return <p className="text-sm text-text-muted">{props.signedIn ? 'Members of this clan can sign up.' : 'Sign in to sign up.'}</p>;
  if (mine?.status === 'rejected') return <p className="text-sm text-text-muted">The host turned this sign-up down.</p>;

  return (
    <div className="space-y-3">
      {active && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm">
          <p className="font-medium text-gold">{mine!.status === 'pending' ? 'You’re signed up — waiting on the host to approve it.' : 'You’re signed up.'}</p>
          {mine!.feeStatus && mine!.feeAmount != null && (
            <p className="text-text-muted">
              Entry {mine!.feeAmount.toLocaleString()} gp: {FEE[mine!.feeStatus] ?? mine!.feeStatus}
            </p>
          )}
        </div>
      )}
      {!props.open && !active && <p className="text-sm text-text-muted">{props.reason}</p>}
      {props.open && editing && (
        <>
          {props.seats.length > 1 && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-text-muted">Signing up as</span>
              <select value={seat ?? ''} onChange={(e) => setSeat(Number(e.target.value))} className="rounded border border-card-border bg-brown-dark px-3 py-2 text-sm text-foreground">
                {props.seats.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rsn}
                  </option>
                ))}
              </select>
            </label>
          )}
          <SignupQuestions questions={props.questions} answers={answers} onChange={(q, v) => setAnswers((a) => { const next = { ...a }; if (v === undefined) delete next[String(q)]; else next[String(q)] = v; return next; })} disabled={busy} />
          <button type="button" disabled={busy} onClick={() => void send('POST')} className="rounded bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50">
            {active ? 'Save my answers' : props.approval ? 'Ask to sign up' : 'Sign me up'}
          </button>
        </>
      )}
      {props.open && active && (
        <div className="flex flex-wrap gap-3">
          {!editing && (props.questions.length > 0 || props.seats.length > 1) && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-gold hover:underline">
              Change my answers
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void send('DELETE')} className="text-sm text-text-muted hover:text-red-400 disabled:opacity-50">
            Take my name off
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
