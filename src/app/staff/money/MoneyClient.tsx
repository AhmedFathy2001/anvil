'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import Textarea from '@/components/Textarea';
import { useDialog } from '@/components/Confirm';
import { PRODUCT_LABEL, type Bucket, type ByCurrency, type ProductKey } from '@/lib/moneyRules';
import type { loadMoney } from '@/lib/money';
import type { listTrials } from '@/lib/ownerTrials';

type Money = Awaited<ReturnType<typeof loadMoney>>;
type Trials = Awaited<ReturnType<typeof listTrials>>;

export function fmt(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const EST = <span className="ml-1 rounded border border-yellow-500/40 px-1 text-[10px] uppercase text-yellow-400" title="Estimated from catalogue prices, not read from a Gumroad notification">est.</span>;

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white"><span className="h-5 w-1 bg-gold" />{title}</h2>
      {note && <p className="mb-3 text-sm text-gray-400">{note}</p>}
      {children}
    </section>
  );
}
const card = 'rounded-xl border border-card-border bg-card-bg p-4';

function Amounts({ by, pick }: { by: ByCurrency; pick: (b: Bucket) => number }) {
  const cur = Object.keys(by);
  if (!cur.length) return <span className="text-gray-500">{fmt(0, 'usd')}</span>;
  return <>{cur.map((c) => <div key={c}>{fmt(pick(by[c]), c)}</div>)}</>;
}

function PeriodTable({ rows }: { rows: { label: string; by: ByCurrency }[] }) {
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-gray-400"><th className="py-1 pr-4">Period</th><th className="pr-4">Gross</th><th className="pr-4">Refunds</th><th className="pr-4">Fees</th><th>Net</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const est = Object.values(r.by).some((b) => b.estimatedGross > 0 || b.estimatedRefunds > 0);
            const feesUnknown = Object.values(r.by).some((b) => b.feesUnknown);
            return (
              <tr key={r.label} className="border-t border-card-border align-top">
                <td className="py-2 pr-4 text-gray-200">{r.label}{est && EST}</td>
                <td className="pr-4"><Amounts by={r.by} pick={(b) => b.gross} /></td>
                <td className="pr-4"><Amounts by={r.by} pick={(b) => -b.refunds} /></td>
                <td className="pr-4">{feesUnknown ? <span className="text-gray-500" title="Gumroad's fee was not sent for some of these, so net is before those fees">unknown</span> : <Amounts by={r.by} pick={(b) => -b.fees} />}</td>
                <td className="font-medium text-gold"><Amounts by={r.by} pick={(b) => b.net} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = { active: 'text-sky-300', ending: 'text-yellow-400', expired: 'text-red-400', converted: 'text-emerald-400', revoked: 'text-gray-500' };

export default function MoneyClient({ money, trials }: { money: Money; trials: Trials }) {
  const router = useRouter();
  const dialog = useDialog();
  const [reveal, setReveal] = useState<{ id: number; data: Record<string, unknown> | null } | null>(null);

  // grant form
  const [kind, setKind] = useState<'supporter' | 'boost'>('supporter');
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [target, setTarget] = useState('');
  const [tier, setTier] = useState('supporter');
  const [days, setDays] = useState(14);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function search(text: string, k = kind) {
    setQ(text);
    if (text.trim().length < 2) { setOptions([]); return; }
    const r = await fetch(`/api/staff/money/targets?kind=${k}&q=${encodeURIComponent(text)}`);
    if (r.ok) setOptions(((await r.json()) as { options: { value: string; label: string }[] }).options);
  }
  async function grant() {
    if (!target) { dialog.notify('Pick who the trial is for.', 'error'); return; }
    setBusy(true);
    const r = await fetch('/api/staff/money/trials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ...(kind === 'supporter' ? { userId: Number(target) } : { clanId: Number(target) }), tier: kind === 'boost' ? Number(tier) : tier, days, note }),
    });
    setBusy(false);
    if (!r.ok) { dialog.notify(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not grant.', 'error'); return; }
    dialog.notify('Trial granted.', 'ok');
    setTarget(''); setQ(''); setOptions([]); setNote('');
    router.refresh();
  }
  async function revoke(id: string) {
    if (!(await dialog.confirm({ title: 'Revoke this trial?', body: 'The free tier or boost level ends now.', confirmLabel: 'Revoke', tone: 'danger' }))) return;
    const r = await fetch(`/api/staff/money/trials/${id.slice(1)}`, { method: 'DELETE' });
    if (!r.ok) { dialog.notify('Could not revoke.', 'error'); return; }
    router.refresh();
  }
  async function open(ledgerId: number | null) {
    if (ledgerId == null) return;
    setReveal({ id: ledgerId, data: null });
    const r = await fetch(`/api/staff/money/entry/${ledgerId}`);
    setReveal({ id: ledgerId, data: r.ok ? ((await r.json()) as Record<string, unknown>) : { error: 'Not available' } });
  }

  const p = money.periods;
  const tierOptions = kind === 'supporter'
    ? [{ value: 'supporter', label: 'Supporter ($1/mo)' }, { value: 'champion', label: 'Champion ($2/mo)' }, { value: 'patron', label: 'Patron ($5/mo)' }]
    : [{ value: '1', label: 'Boost level 1' }, { value: '2', label: 'Boost level 2' }, { value: '3', label: 'Boost level 3' }];

  const feed = (items: Money['recentSales'], empty: string) =>
    items.length === 0 ? <p className="text-sm text-gray-500">{empty}</p> : (
      <ul className="divide-y divide-card-border text-sm">
        {items.map((f) => (
          <li key={f.key} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <span className="text-gray-200">{f.label}</span> <span className="text-gray-500">{PRODUCT_LABEL[f.product as ProductKey] ?? f.product} · {f.type} · {day(f.at)}</span>
              {f.estimated && EST}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-gray-400">{f.maskedEmail}</span>
              {f.cents != null && <span className="text-gold">{fmt(f.cents, f.currency)}</span>}
              {f.ledgerId != null && <button type="button" onClick={() => open(f.ledgerId)} className="text-xs text-sky-300 hover:underline">Details</button>}
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">Money</h1>
      <p className="mb-6 text-sm text-gray-400">
        Owner only. Read from stored rows; nothing here calls Gumroad.
        {money.ledgerSince
          ? <> Exact figures start {day(money.ledgerSince)} (when the ledger began); earlier history is estimated from catalogue prices.</>
          : <> No ledger rows yet, so every figure is estimated from catalogue prices until the next Gumroad notification arrives.</>}
        {' '}Currencies are never added together.
      </p>

      <Section title="Earnings">
        <PeriodTable rows={[
          { label: 'Today (UTC)', by: p.today }, { label: 'Last 7 days', by: p.last7 }, { label: 'Last 30 days', by: p.last30 },
          { label: 'This month', by: p.thisMonth }, { label: 'Last month', by: p.lastMonth }, { label: 'All time', by: p.allTime },
        ]} />
      </Section>

      <Section title="By product" note="Clan boosts are not sold: a boost is a seat placed by a Champion or Patron, so that money is inside Supporter tiers.">
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400"><th className="py-1 pr-4">Product</th><th className="pr-4">Last 30 days net</th><th>All time net</th></tr></thead>
            <tbody>
              {(Object.keys(PRODUCT_LABEL) as ProductKey[]).map((k) => (
                <tr key={k} className="border-t border-card-border align-top">
                  <td className="py-2 pr-4 text-gray-200">{PRODUCT_LABEL[k]}</td>
                  <td className="pr-4">{k === 'boost' ? <span className="text-gray-500">inside Supporter</span> : <Amounts by={money.byProduct.last30[k] ?? {}} pick={(b) => b.net} />}</td>
                  <td>{k === 'boost' ? <span className="text-gray-500">inside Supporter</span> : <Amounts by={money.byProduct.allTime[k] ?? {}} pick={(b) => b.net} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Subscriptions">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={card}><div className="text-sm text-gray-400">Active subscriptions</div><div className="text-2xl text-white">{money.activeCount}</div>
            <div className="mt-1 text-xs text-gray-500">{money.activeBy.map((a) => `${a.label}: ${a.count}`).join(' · ')}</div></div>
          <div className={card}><div className="text-sm text-gray-400">Monthly recurring revenue</div>
            {Object.entries(money.mrr).map(([c, v]) => <div key={c} className="text-2xl text-gold">{fmt(v.cents, c)}{v.estimated > 0 && EST}</div>)}
            {!Object.keys(money.mrr).length && <div className="text-2xl text-gray-500">{fmt(0, 'usd')}</div>}
            <div className="mt-1 text-xs text-gray-500">Yearly plans counted as one twelfth.</div></div>
          <div className={card}><div className="text-sm text-gray-400">Cancelling (still paid)</div>
            {Object.entries(money.mrrAtRisk).map(([c, v]) => <div key={c} className="text-2xl text-yellow-400">{fmt(v, c)}/mo</div>)}
            {!Object.keys(money.mrrAtRisk).length && <div className="text-2xl text-gray-500">none</div>}
            <div className="mt-1 text-xs text-gray-500">{money.cancellingNow.length} subscription(s) end at period close.</div></div>
        </div>
      </Section>

      <Section title="Renewals in the next 30 days" note="Renewal dates are counted by Anvil from the last charge; Gumroad does not send one.">
        {money.renewals.length === 0 ? <p className="text-sm text-gray-500">None due.</p> : (
          <div className={card}><ul className="divide-y divide-card-border text-sm">
            {money.renewals.map((r) => (
              <li key={r.key} className="flex justify-between py-2"><span className="text-gray-200">{r.label} <span className="text-gray-500">{PRODUCT_LABEL[r.product]} · {day(r.at)}</span></span><span className="text-gold">{fmt(r.cents, r.currency)}{r.estimated && EST}</span></li>
            ))}
          </ul></div>
        )}
      </Section>

      <Section title="Recent activity" note="Last 20 of each. Buyer emails are masked; Details shows the full record.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={card}><h3 className="mb-2 text-sm font-semibold text-gray-300">Sales</h3>{feed(money.recentSales, 'No sales yet.')}</div>
          <div className={card}><h3 className="mb-2 text-sm font-semibold text-gray-300">Refunds</h3>{feed(money.recentRefunds, 'No refunds.')}</div>
          <div className={card}><h3 className="mb-2 text-sm font-semibold text-gray-300">Cancellations</h3>{feed(money.recentCancellations, 'None recorded since the ledger began.')}</div>
        </div>
        {reveal && (
          <div className={`${card} mt-4`}>
            <div className="mb-2 flex justify-between text-sm"><span className="text-gray-300">Ledger entry {reveal.id}</span><button type="button" className="text-gray-400 hover:text-white" onClick={() => setReveal(null)}>Close</button></div>
            {reveal.data ? <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">{Object.entries(reveal.data).map(([k, v]) => (<><dt key={`k${k}`} className="text-gray-500">{k}</dt><dd key={`v${k}`} className="break-all text-gray-200">{String(v ?? '—')}</dd></>))}</dl> : <p className="text-sm text-gray-500">Loading…</p>}
          </div>
        )}
      </Section>

      <Section title="Trial pipeline" note="Pending value is the monthly tier price of every running trial. Boost levels are priced as the Champion seats needed to reach them (estimate).">
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className={card}><div className="text-sm text-gray-400">Pending value / month</div><div className="text-2xl text-gold">{fmt(trials.pipelineCents, 'usd')}</div><div className="text-xs text-gray-500">{fmt(trials.pipelineOwnerCents, 'usd')} from trials you granted</div></div>
          <div className={card}><div className="text-sm text-gray-400">Running</div><div className="text-2xl text-sky-300">{trials.counts.active}</div></div>
          <div className={card}><div className="text-sm text-gray-400">Ending in 7 days</div><div className="text-2xl text-yellow-400">{trials.counts.ending}</div></div>
          <div className={card}><div className="text-sm text-gray-400">Expired / converted</div><div className="text-2xl text-white">{trials.counts.expired} / <span className="text-emerald-400">{trials.counts.converted}</span></div></div>
        </div>

        <div className={`${card} mb-4`}>
          <h3 className="mb-3 text-sm font-semibold text-gray-300">Grant a trial</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div><div className="mb-1 text-xs text-gray-400">Type</div>
              <Select value={kind} ariaLabel="Trial type" onChange={(v) => { const k = v as 'supporter' | 'boost'; setKind(k); setTier(k === 'boost' ? '1' : 'supporter'); setTarget(''); setOptions([]); setQ(''); }}
                options={[{ value: 'supporter', label: 'Supporter tier, for a person' }, { value: 'boost', label: 'Clan boost level, for a clan' }]} /></div>
            <div><div className="mb-1 text-xs text-gray-400">Tier</div><Select value={tier} ariaLabel="Tier" onChange={setTier} options={tierOptions} /></div>
            <div><div className="mb-1 text-xs text-gray-400">{kind === 'supporter' ? 'Find a person' : 'Find a clan'}</div>
              <Input value={q} onChange={(e) => search(e.target.value)} placeholder="Type 2+ letters" maxLength={40} />
              {options.length > 0 && <div className="mt-2"><Select value={target} ariaLabel="Result" onChange={setTarget} placeholder="Pick from results" options={options} /></div>}</div>
            <div><div className="mb-1 text-xs text-gray-400">Days</div><NumberInput value={days} onChange={setDays} min={1} max={365} fallback={14} /></div>
            <div className="md:col-span-2"><div className="mb-1 text-xs text-gray-400">Note (optional)</div><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} /></div>
          </div>
          <button type="button" disabled={busy} onClick={grant} className="mt-3 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Grant trial</button>
        </div>

        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400"><th className="py-1 pr-3">Who</th><th className="pr-3">What</th><th className="pr-3">Ends</th><th className="pr-3">Status</th><th className="pr-3">Worth / mo</th><th /></tr></thead>
            <tbody>
              {trials.trials.length === 0 && <tr><td colSpan={6} className="py-3 text-gray-500">No trials yet.</td></tr>}
              {trials.trials.map((t) => (
                <tr key={t.id} className="border-t border-card-border">
                  <td className="py-2 pr-3 text-gray-200">{t.target}{t.note && <div className="text-xs text-gray-500">{t.note}</div>}</td>
                  <td className="pr-3 text-gray-300">{t.tier}{t.source === 'gumroad' && <span className="ml-1 text-xs text-gray-500">(Gumroad free trial)</span>}</td>
                  <td className="pr-3 text-gray-300">{day(t.endsAt)}</td>
                  <td className={`pr-3 ${STATUS_TONE[t.status]}`}>{t.status === 'expired' ? 'expired, not converted' : t.status}</td>
                  <td className="pr-3 text-gold">{fmt(t.valueCents, 'usd')}{t.estimated && EST}</td>
                  <td>{t.source === 'owner' && (t.status === 'active' || t.status === 'ending') && <button type="button" className="text-xs text-red-400 hover:underline" onClick={() => revoke(t.id)}>Revoke</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
