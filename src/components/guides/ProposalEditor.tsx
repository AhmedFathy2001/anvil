'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import Textarea from '@/components/Textarea';
import { useDialog } from '@/components/Confirm';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import { GuideFieldsEditor, GuidePreviewPane, type GuideFieldValues } from './GuideFields';
import GuideDiffView from './GuideDiffView';

export interface ProposalState {
  id?: number;
  status?: string;
  reviewNote?: string | null;
  note?: string | null;
}

/**
 * Write a guide for the Anvil library, or suggest an edit to one. Same editor and previews the
 * library team uses, so what is proposed is exactly what would be published.
 */
export default function ProposalEditor({
  initial,
  proposal,
  target,
  origin,
}: {
  initial: GuideFieldValues;
  proposal?: ProposalState;
  /** Set when this suggests an edit to a library guide: its current text, for the diff. */
  target?: { id: number; title: string; summary: string; body: string } | null;
  origin: string | null;
}) {
  const router = useRouter();
  const { confirm, notify } = useDialog();
  const [form, setForm] = useState<GuideFieldValues>(initial);
  const [note, setNote] = useState(proposal?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const editable = !proposal?.id || proposal.status === 'pending';

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = proposal?.id
        ? await clanFetch(`/api/guides/proposals/${proposal.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, note }),
          })
        : await clanFetch('/api/guides/proposals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, note, targetGuideId: target?.id ?? null }),
          });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setError(j.error ?? `Failed (${res.status})`);
      notify(proposal?.id ? 'Proposal updated' : 'Sent for review — thank you!');
      router.push(clanUrl('/guides/proposals'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!proposal?.id) return;
    const ok = await confirm({ title: 'Withdraw this proposal?', body: 'It leaves the review queue. You can write a new one any time.', confirmLabel: 'Withdraw', tone: 'danger' });
    if (!ok) return;
    const res = await clanFetch(`/api/guides/proposals/${proposal.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push(clanUrl('/guides/proposals'));
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ClanLink href="/guides/proposals" className="text-xs text-text-muted hover:text-gold">
            ← My proposals
          </ClanLink>
          <h1 className="mt-1 text-2xl font-bold text-gold">
            {target ? `Suggest an edit: ${target.title}` : proposal?.id ? 'Your proposed guide' : 'Write a guide for the Anvil library'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            {target
              ? 'Change what you think is wrong or missing. The Anvil guide team reviews it; once approved it becomes the next version, and every clan using this guide gets the update.'
              : 'Once the Anvil guide team approves it, it joins the library every clan can read, copy and post to Discord.'}
          </p>
        </div>
        {editable && (
          <div className="flex gap-2">
            {proposal?.id && (
              <button onClick={withdraw} className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:text-red-300">
                Withdraw
              </button>
            )}
            <button
              onClick={submit}
              disabled={busy || !form.title.trim() || !form.body.trim()}
              className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-40"
            >
              {busy ? 'Sending…' : proposal?.id ? 'Save changes' : 'Send for review'}
            </button>
          </div>
        )}
      </div>

      {proposal?.status && proposal.status !== 'pending' && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            proposal.status === 'approved'
              ? 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200'
              : proposal.status === 'rejected'
                ? 'border-red-900/60 bg-red-950/20 text-red-200'
                : 'border-card-border bg-card-bg text-text-muted'
          }`}
        >
          <span className="font-semibold capitalize">{proposal.status}.</span>
          {proposal.reviewNote && <span> {proposal.reviewNote}</span>}
        </div>
      )}
      {error && <p className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</p>}

      {target && (
        <div className="rounded-xl border border-card-border bg-card-bg px-4 py-2.5 text-xs">
          <button onClick={() => setShowDiff((v) => !v)} className="text-gold hover:underline">
            {showDiff ? 'Hide your changes' : 'Show your changes against the current guide'}
          </button>
          {showDiff && (
            <div className="mt-3">
              <GuideDiffView before={target} after={form} beforeLabel="Current" afterLabel="Yours" />
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-3">
          <GuideFieldsEditor value={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} readOnly={!editable} uploadUrl="/api/guides/proposals/upload" strictLevels />
          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">
              {target ? 'What did you change, and why? (the reviewer reads this)' : 'Anything the reviewer should know?'}
            </span>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} readOnly={!editable} rows={3} maxLength={500} />
          </label>
        </div>
        <GuidePreviewPane value={form} origin={origin} siteUrl={null} updatedAt={null} byline="Anvil guide library" />
      </div>
    </div>
  );
}
