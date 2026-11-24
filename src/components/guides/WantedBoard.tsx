'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { GUIDE_ACCOUNTS, GUIDE_BUILDS, accountLabel, buildLabel } from '@/lib/guideSetups';
import { TIERS } from '@/lib/guideTiers';

export interface WantedWire {
  id: number;
  guideSlug: string | null;
  guideTitle: string | null;
  topic: string | null;
  tier: string | null;
  accountType: string | null;
  build: string | null;
  note: string | null;
  reason: string;
  requesters: number;
  filledBy: string | null;
}

/** Gaps players asked for. The first setup that fills one is marked "first to write it" (+credit). */
export default function WantedBoard({ open, filled, guides, signedIn, canCurate }: { open: WantedWire[]; filled: WantedWire[]; guides: { id: number; title: string }[]; signedIn: boolean; canCurate: boolean }) {
  const router = useRouter();
  const [guideId, setGuideId] = useState('');
  const [topic, setTopic] = useState('');
  const [tier, setTier] = useState('');
  const [acct, setAcct] = useState('');
  const [build, setBuild] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function send(body: unknown) {
    const res = await clanFetch('/api/guides/wanted', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(res.ok ? 'Added to the board.' : j.error ?? 'Could not add it.');
    if (res.ok) router.refresh();
  }
  const label = (w: WantedWire) => [w.tier && TIERS.find((t) => t.key === w.tier)?.label, w.accountType && accountLabel(w.accountType), w.build && buildLabel(w.build)].filter(Boolean).join(' · ') || 'Any setup';
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Wanted</h1>
        <p className="mt-1 text-sm text-text-muted">Gaps players looked for and found nothing. Write one: the first setup that fills a request is marked first to write it, with extra credit.</p>
      </div>
      {signedIn && (
        <div className="grid gap-2 rounded-xl border border-card-border bg-card-bg p-4 sm:grid-cols-2">
          <Select value={guideId} onChange={setGuideId} options={[{ value: '', label: 'A new guide (name it)' }, ...guides.map((g) => ({ value: String(g.id), label: g.title }))]} ariaLabel="Guide" />
          {!guideId ? <Input value={topic} onChange={(e) => setTopic(e.target.value.slice(0, 80))} placeholder="Which guide? e.g. Phantom Muspah" /> : <span />}
          <Select value={tier} onChange={setTier} options={[{ value: '', label: 'Any level' }, ...TIERS.map((t) => ({ value: t.key, label: t.label }))]} ariaLabel="Level" />
          <Select value={acct} onChange={setAcct} options={[{ value: '', label: 'Any account' }, ...GUIDE_ACCOUNTS.map((a) => ({ value: a.key, label: a.label }))]} ariaLabel="Account type" />
          <Select value={build} onChange={setBuild} options={[{ value: '', label: 'Any build' }, ...GUIDE_BUILDS.filter((b) => b.key !== 'any').map((b) => ({ value: b.key, label: b.label }))]} ariaLabel="Build" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => send({ guideId: guideId ? Number(guideId) : null, topic, tier, accountType: acct, build })} className="h-10 rounded-lg bg-gold px-4 text-sm font-semibold text-brown-dark">
              Ask for it
            </button>
            {msg && <span className="text-xs text-text-muted">{msg}</span>}
          </div>
        </div>
      )}
      <ul className="space-y-2">
        {open.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg p-3">
            <div className="min-w-0 flex-1">
              <strong className="block">{w.guideTitle ?? w.topic}</strong>
              <span className="text-xs text-text-muted">
                {w.reason === 'stale' ? `Needs an update: ${w.note ?? 'a game update changed it'}` : label(w)} · {w.requesters} asked
              </span>
            </div>
            {w.guideSlug ? (
              <ClanLink href={`/guides/${w.guideSlug}/submit${w.tier ? `?tier=${w.tier}` : ''}`} className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm text-gold">
                Write it
              </ClanLink>
            ) : (
              <ClanLink href="/guides/propose" className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm text-gold">
                Write it
              </ClanLink>
            )}
            {canCurate && (
              <button type="button" onClick={() => send({ action: 'close', id: w.id })} className="text-xs text-text-muted hover:text-red-300">
                Close
              </button>
            )}
          </li>
        ))}
        {open.length === 0 && <li className="rounded-xl border border-dashed border-card-border p-8 text-center text-sm text-text-muted">No open requests.</li>}
      </ul>
      {filled.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-text-muted">Recently filled</h2>
          {filled.map((w) => (
            <div key={w.id} className="text-xs text-text-muted">
              {w.guideTitle ?? w.topic} · {label(w)} — first written by {w.filledBy ?? 'a player'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
