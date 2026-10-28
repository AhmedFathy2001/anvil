'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useDialog } from '@/components/Confirm';
import Input from '@/components/Input';
import PayoutRowControls from '@/components/PayoutRowControls';
import Select from '@/components/Select';
import SignupFeeControls from '@/components/SignupFeeControls';
import { atLeast } from '@/lib/clanRoles';
import { clanFetch } from '@/lib/clanFetch';
import type { ClanEventModules } from '@/lib/clanEventModules';
import type { SurveyQuestionView } from '@/lib/survey';

import SurveyClient from '../../events/[eventId]/survey/SurveyClient';

interface Key {
  key: string;
  label: 'series' | 'next' | 'past';
  occurrence: { start: string; end: string } | null;
}

interface SignupRow {
  id: number;
  rsn: string;
  displayName: string | null;
  status: string;
  answers: Record<string, number | string | string[]> | null;
  feeAmount: number | null;
  feeStatus: string | null;
  collectedByUserId: number | null;
  proofUrl: string | null;
  confirmations: { userId: number }[] | null;
  confirmedAt: string | null;
  feeNotes: string | null;
}

interface PayoutRow {
  id: number;
  rsn: string;
  amount: number;
  note: string | null;
  status: string;
  proofUrl: string | null;
  paidAt: string | null;
}

interface Props {
  id: number;
  weekly: boolean;
  initialModules: ClanEventModules;
  keys: Key[];
  signupQuestions: SurveyQuestionView[];
  surveyQuestions: SurveyQuestionView[];
  templates: { id: string; name: string; description: string; questionCount: number }[];
  viewerRole: string;
  viewerId: number;
  confirmationsRequired: number;
}

const gp = (n: number) => `${n.toLocaleString()} gp`;
const keyLabel = (k: Key) =>
  k.label === 'series'
    ? 'The whole series'
    : `${new Date(k.occurrence!.start).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${k.label === 'next' ? ' (next)' : ''}`;

const STATUS: Record<string, string> = { pending: 'Waiting', approved: 'In', rejected: 'Turned down', withdrawn: 'Withdrew' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
        <span className="h-5 w-1 bg-gold" /> {title}
      </h2>
      {children}
    </section>
  );
}

export default function ClanEventManageClient(props: Props) {
  const { id, weekly, keys, viewerRole, viewerId, confirmationsRequired } = props;
  const router = useRouter();
  const [m, setM] = useState<ClanEventModules>(props.initialModules);
  const [saved, setSaved] = useState<ClanEventModules>(props.initialModules);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [key, setKey] = useState<string>(keys[0]?.key ?? '');
  const dirty = JSON.stringify(m) !== JSON.stringify(saved);
  const money = atLeast(viewerRole, 'admin') || viewerRole === 'treasurer';

  async function saveModules() {
    setSaveMsg(null);
    const r = await clanFetch(`/api/admin/clan-events/${id}/modules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m) });
    const body = (await r.json().catch(() => ({}))) as { modules?: ClanEventModules; error?: string };
    if (!r.ok || !body.modules) return setSaveMsg(body.error ?? 'Couldn’t save.');
    setM(body.modules);
    setSaved(body.modules);
    setSaveMsg('Saved.');
    router.refresh(); // the dates below follow a change of scope
  }

  const label = 'mb-1 block text-xs font-medium text-text-muted';
  const toggle = (on: boolean, set: (on: boolean) => void, text: string, hint?: string) => (
    <label className="flex items-start gap-2 text-sm text-foreground">
      <input type="checkbox" className="mt-1" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>
        <span className="font-medium">{text}</span>
        {hint && <span className="block text-xs text-text-muted">{hint}</span>}
      </span>
    </label>
  );

  return (
    <div className="space-y-6">
      <Section title="What it uses">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            {toggle(m.signups.on, (on) => setM({ ...m, signups: { ...m.signups, on }, fee: on ? m.fee : { ...m.fee, on: false } }), 'Sign-ups', 'People put their name down on the site (or in the plugin), answering your questions.')}
            {m.signups.on && (
              <div className="ml-6 grid grid-cols-2 gap-2">
                <div>
                  <label className={label}>Places (blank = no limit)</label>
                  <Input type="number" min={1} value={m.signups.cap ?? ''} onChange={(e) => setM({ ...m, signups: { ...m.signups, cap: e.target.value ? Number(e.target.value) : null } })} />
                </div>
                <div>
                  <label className={label}>Sign-ups close</label>
                  <Select
                    value={m.signups.closes}
                    onChange={(v) => setM({ ...m, signups: { ...m.signups, closes: v === 'end' ? 'end' : 'start' } })}
                    options={[{ value: 'start', label: 'When it starts' }, { value: 'end', label: 'When it ends' }]}
                    ariaLabel="Sign-ups close"
                  />
                </div>
                <div className="col-span-2">{toggle(m.signups.approval, (approval) => setM({ ...m, signups: { ...m.signups, approval } }), 'You approve each one', 'Sign-ups wait for staff before they count.')}</div>
              </div>
            )}
            {toggle(m.fee.on, (on) => setM({ ...m, fee: { ...m.fee, on }, signups: on ? { ...m.signups, on: true } : m.signups }), 'Entry fee', 'Each sign-up owes it; staff mark it paid, the same as a board’s fees.')}
            {m.fee.on && (
              <div className="ml-6 w-48">
                <label className={label}>Fee (gp)</label>
                <Input type="number" min={1} value={m.fee.amount || ''} onChange={(e) => setM({ ...m, fee: { ...m.fee, amount: Number(e.target.value) || 0 } })} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            {toggle(m.payouts.on, (on) => setM({ ...m, payouts: { ...m.payouts, on } }), 'Payouts', 'The pot is the fees collected plus anything you add; you name who gets what.')}
            {m.payouts.on && (
              <div className="ml-6 w-48">
                <label className={label}>Added to the pot (gp)</label>
                <Input type="number" min={0} value={m.payouts.addedGp || ''} onChange={(e) => setM({ ...m, payouts: { ...m.payouts, addedGp: Number(e.target.value) || 0 } })} />
              </div>
            )}
            {toggle(m.survey.on, (on) => setM({ ...m, survey: { on } }), 'Survey afterwards', 'Opens once it ends; only staff see the answers.')}
            {weekly && (
              <div className="pt-1">
                <label className={label}>Every week is…</label>
                <Select
                  value={m.scope}
                  onChange={(v) => setM({ ...m, scope: v === 'series' ? 'series' : 'occurrence' })}
                  options={[
                    { value: 'occurrence', label: 'Its own — sign-ups, pot and survey each week' },
                    { value: 'series', label: 'One run — a single sign-up, pot and survey for the series' },
                  ]}
                  ariaLabel="Every week is"
                />
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" disabled={!dirty} onClick={() => void saveModules()} className="rounded bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50">
            Save
          </button>
          {saveMsg && <span className="text-sm text-text-muted">{saveMsg}</span>}
        </div>
      </Section>

      {saved.signups.on && (
        <Section title="Sign-up questions">
          <SurveyClient
            eventId={id}
            ended={false}
            stage="signup"
            initialQuestions={props.signupQuestions}
            responseCount={0}
            templates={[]}
            apiBase={`/api/admin/clan-events/${id}/survey`}
            intro={<>Asked when someone signs up. Leave it empty and signing up is one tap — in the plugin too.</>}
          />
        </Section>
      )}

      {(saved.signups.on || saved.payouts.on || saved.survey.on) && keys.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-muted">Showing</span>
          <Select value={key} onChange={setKey} options={keys.map((k) => ({ value: k.key, label: keyLabel(k) }))} ariaLabel="Which date" className="w-auto min-w-56" />
        </div>
      )}

      {saved.signups.on && key && <SignupList id={id} k={key} fee={saved.fee.on} questions={props.signupQuestions} viewerRole={viewerRole} viewerId={viewerId} confirmationsRequired={confirmationsRequired} />}
      {saved.payouts.on && key && money && <Payouts id={id} k={key} viewerRole={viewerRole} />}

      {saved.survey.on && (
        <Section title="Survey">
          <SurveyClient
            key={key}
            eventId={id}
            ended={keys.some((k) => k.key === key && k.label !== 'next')}
            initialQuestions={props.surveyQuestions}
            responseCount={0}
            templates={props.templates}
            apiBase={`/api/admin/clan-events/${id}/survey`}
            resultsUrl={`/api/admin/clan-events/${id}/survey/results?key=${encodeURIComponent(key)}`}
            intro={
              <>
                Opens once it ends{saved.signups.on ? ', for the people who signed up' : ''}. Results below are for the date picked above.
              </>
            }
          />
        </Section>
      )}
    </div>
  );
}

function SignupList({ id, k, fee, questions, viewerRole, viewerId, confirmationsRequired }: { id: number; k: string; fee: boolean; questions: SurveyQuestionView[]; viewerRole: string; viewerId: number; confirmationsRequired: number }) {
  const [rows, setRows] = useState<SignupRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { confirm } = useDialog();
  const load = useCallback(
    () =>
      clanFetch(`/api/admin/clan-events/${id}/signups?key=${encodeURIComponent(k)}`)
        .then((r) => (r.ok ? r.json() : { signups: [] }))
        .then((d: { signups?: SignupRow[] }) => setRows(d.signups ?? [])),
    [id, k],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(row: SignupRow, status: 'approved' | 'rejected' | 'withdrawn') {
    if (status !== 'approved' && !(await confirm({ title: status === 'rejected' ? `Turn ${row.rsn} down?` : `Take ${row.rsn} off?`, body: 'Their place frees up.', confirmLabel: 'Yes' }))) return;
    setErr(null);
    const r = await clanFetch(`/api/admin/clan-events/${id}/signups/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (!r.ok) setErr(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Couldn’t save.');
    void load();
  }

  const active = rows?.filter((r) => r.status === 'pending' || r.status === 'approved').length ?? 0;
  return (
    <Section title={`Signed up${rows ? ` · ${active}` : ''}`}>
      {err && <p className="mb-2 text-sm text-red-400">{err}</p>}
      {rows == null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted">Nobody yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className={`rounded-lg border border-card-border p-3 ${row.status === 'rejected' || row.status === 'withdrawn' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{row.rsn}</span>
                {row.displayName && row.displayName !== row.rsn && <span className="text-xs text-text-muted">{row.displayName}</span>}
                <span className="rounded bg-gold/10 px-1.5 py-0.5 text-xs text-gold-light">{STATUS[row.status] ?? row.status}</span>
                <span className="flex-1" />
                {row.status === 'pending' && (
                  <button type="button" onClick={() => void setStatus(row, 'approved')} className="text-sm text-accent-green-light hover:underline">
                    Approve
                  </button>
                )}
                {row.status === 'pending' && (
                  <button type="button" onClick={() => void setStatus(row, 'rejected')} className="text-sm text-red-400 hover:underline">
                    Turn down
                  </button>
                )}
                {row.status === 'approved' && (
                  <button type="button" onClick={() => void setStatus(row, 'withdrawn')} className="text-sm text-text-muted hover:text-red-400">
                    Take off
                  </button>
                )}
                {(row.status === 'rejected' || row.status === 'withdrawn') && (
                  <button type="button" onClick={() => void setStatus(row, 'approved')} className="text-sm text-text-muted hover:text-gold">
                    Put back
                  </button>
                )}
              </div>
              {row.answers && Object.keys(row.answers).length > 0 && <Answers questions={questions} answers={row.answers} />}
              {fee && row.feeStatus && row.feeAmount != null && (
                <div className="mt-2">
                  <SignupFeeControls
                    fee={{
                      id: row.id,
                      amount: row.feeAmount,
                      status: row.feeStatus,
                      collectedByUserId: row.collectedByUserId,
                      reportedCollectorUserId: null,
                      proofBlobUrl: row.proofUrl,
                      confirmedAt: row.confirmedAt,
                      confirmationsCount: row.confirmations?.length ?? 0,
                      notes: row.feeNotes,
                    }}
                    viewerRole={viewerRole}
                    viewerId={viewerId}
                    confirmationsRequired={confirmationsRequired}
                    onChanged={() => void load()}
                    apiBase={`/api/admin/clan-events/${id}/fees`}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** One person's answers, against the questions as they read when the page opened. */
function Answers({ questions, answers }: { questions: SurveyQuestionView[]; answers: Record<string, number | string | string[]> }) {
  return (
    <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[minmax(0,200px)_1fr]">
      {questions
        .filter((q) => answers[String(q.id)] != null)
        .map((q) => (
          <div key={q.id} className="contents">
            <dt className="text-text-muted">{q.prompt}</dt>
            <dd className="text-foreground">{[answers[String(q.id)]].flat().join(', ')}</dd>
          </div>
        ))}
    </dl>
  );
}

function Payouts({ id, k, viewerRole }: { id: number; k: string; viewerRole: string }) {
  const [sheet, setSheet] = useState<{ pot: number; collected: number; rows: PayoutRow[] } | null>(null);
  const [form, setForm] = useState({ rsn: '', amount: '', note: '' });
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(
    () =>
      clanFetch(`/api/admin/clan-events/${id}/payouts?key=${encodeURIComponent(k)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setSheet(d)),
    [id, k],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const r = await clanFetch(`/api/admin/clan-events/${id}/payouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: k, rsn: form.rsn, amount: Number(form.amount), note: form.note }),
    });
    if (!r.ok) return setErr(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Couldn’t add it.');
    setForm({ rsn: '', amount: '', note: '' });
    void load();
  }

  const allocated = sheet?.rows.reduce((s, r) => s + r.amount, 0) ?? 0;
  return (
    <Section title="Payouts">
      {sheet == null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-text-muted">
            Pot <span className="font-medium text-foreground">{gp(sheet.pot)}</span>
            {sheet.collected > 0 && ` (${gp(sheet.collected)} in fees collected)`} · named {gp(allocated)}
            {allocated > sheet.pot && <span className="text-red-400"> — {gp(allocated - sheet.pot)} over the pot</span>}
          </p>
          {sheet.rows.length > 0 && (
            <ul className="mb-4 divide-y divide-card-border">
              {sheet.rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-foreground">{row.rsn}</span> · {gp(row.amount)}
                    {row.note && <span className="text-text-muted"> · {row.note}</span>}
                    {row.status === 'paid' && <span className="ml-2 text-xs text-accent-green-light">Paid</span>}
                  </span>
                  <PayoutRowControls
                    payout={{ id: row.id, status: row.status, proofBlobUrl: row.proofUrl, paidAt: row.paidAt }}
                    eventId={id}
                    viewerRole={viewerRole}
                    onChanged={() => void load()}
                    base={`/api/admin/clan-events/${id}/payouts/${row.id}`}
                    uploadUrl="/api/admin/fees/upload"
                  />
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Who</label>
              <Input value={form.rsn} onChange={(e) => setForm({ ...form, rsn: e.target.value })} placeholder="RSN" maxLength={12} required />
            </div>
            <div className="w-36">
              <label className="mb-1 block text-xs text-text-muted">Amount (gp)</label>
              <Input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="w-40">
              <label className="mb-1 block text-xs text-text-muted">For (optional)</label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="1st place" maxLength={60} />
            </div>
            <button type="submit" className="rounded bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light">
              Add
            </button>
          </form>
          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
        </>
      )}
    </Section>
  );
}
