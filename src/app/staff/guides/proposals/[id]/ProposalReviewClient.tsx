'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import Checkbox from '@/components/Checkbox';
import Textarea from '@/components/Textarea';
import { useDialog } from '@/components/Confirm';
import { GuidePreviewPane } from '@/components/guides/GuideFields';
import GuideDiffView from '@/components/guides/GuideDiffView';
import { categoryOf, type CategoryView } from '@/lib/guideCategories';

interface Data {
  canEdit: boolean;
  categories: CategoryView[];
  proposer: string;
  proposal: {
    id: number;
    title: string;
    summary: string;
    category: string;
    coverUrl: string | null;
    body: string;
    note: string | null;
    status: string;
    targetGuideId: number | null;
    baseVersion: number | null;
    reviewNote: string | null;
    resultGuideId: number | null;
    createdAt: string;
  };
  target: { id: number; title: string; summary: string; body: string; version: number; slug: string } | null;
}

export default function ProposalReviewClient({ id, origin }: { id: number; origin: string | null }) {
  const router = useRouter();
  const { confirm, notify } = useDialog();
  const [data, setData] = useState<Data | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/staff/guides/proposals/${id}`);
    if (res.ok) setData(await res.json());
    else setError('Proposal not found.');
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function decide(action: 'approve' | 'reject') {
    if (!data) return;
    if (action === 'approve' && data.target) {
      const ok = await confirm({
        title: `Replace "${data.target.title}" with this version?`,
        body: 'It becomes the next library version: clans following the guide get it immediately (their Discord posts too), and clans with their own edits are offered it, with your note.',
        confirmLabel: 'Approve edit',
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/guides/proposals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote, publish }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setError(j.error ?? `Failed (${res.status})`);
      notify(action === 'approve' ? 'Approved' : 'Rejected');
      if (action === 'approve' && j.proposal?.resultGuideId) router.push(`/staff/guides/${j.proposal.resultGuideId}`);
      else await load();
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p className="text-sm text-red-300">{error}</p>;
  if (!data) return <p className="text-sm text-text-muted">Loading…</p>;
  const { proposal: p, target } = data;
  const stale = target && p.baseVersion != null && target.version > p.baseVersion;
  const value = { title: p.title, summary: p.summary, category: p.category, coverUrl: p.coverUrl, body: p.body };

  return (
    <div className="space-y-5">
      <div>
        <ClanLink href="/staff/guides/proposals" className="text-xs text-text-muted hover:text-gold">
          ← Proposals
        </ClanLink>
        <h1 className="mt-1 text-2xl font-bold text-gold">
          {target ? `Edit to “${target.title}”` : p.title}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {target ? 'Suggested edit' : 'New guide'} · {categoryOf(p.category, data.categories).icon} {categoryOf(p.category, data.categories).label} · by{' '}
          <span className="text-foreground">{data.proposer}</span> · {p.createdAt.slice(0, 10)}
        </p>
      </div>

      {p.note && (
        <blockquote className="rounded-xl border-l-4 border-gold/60 bg-card-bg px-4 py-3 text-sm text-gray-200">{p.note}</blockquote>
      )}
      {stale && (
        <p className="rounded-xl border border-amber-700/70 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          The library guide changed since this was written (v{p.baseVersion} → v{target!.version}). The diff below is against the
          current version — anything shown as removed may be somebody else&apos;s later change, not this proposer&apos;s intent.
        </p>
      )}
      {p.status !== 'pending' && (
        <p className="rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm">
          <span className="font-semibold capitalize">{p.status}</span>
          {p.reviewNote ? ` — ${p.reviewNote}` : ''}
          {p.resultGuideId && (
            <>
              {' · '}
              <ClanLink href={`/staff/guides/${p.resultGuideId}`} className="text-gold hover:underline">
                Open the guide
              </ClanLink>
            </>
          )}
        </p>
      )}

      {target && (
        <section className="rounded-xl border border-card-border bg-card-bg p-4">
          <h2 className="mb-2 text-sm font-bold">Changes against the library</h2>
          <GuideDiffView before={target} after={value} beforeLabel={`Library v${target.version}`} afterLabel="Proposal" />
        </section>
      )}

      <GuidePreviewPane value={value} origin={origin} siteUrl={null} updatedAt={null} byline="Anvil guide library" />

      {p.status === 'pending' && data.canEdit && (
        <section className="space-y-3 rounded-xl border border-card-border bg-card-bg p-4">
          <h2 className="text-sm font-bold">Decision</h2>
          <Textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="A note for the writer (required to reject). Approving an edit also shows it to clans as what changed."
          />
          {!target && <Checkbox checked={publish} onChange={setPublish} label="Publish straight away" description="Untick to approve it as a draft you finish first." />}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => decide('approve')}
              disabled={busy}
              className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-40"
            >
              Approve
            </button>
            <button
              onClick={() => decide('reject')}
              disabled={busy || !reviewNote.trim()}
              title={!reviewNote.trim() ? 'Say why first' : undefined}
              className="rounded-lg border border-red-900 px-4 py-1.5 text-sm text-red-300 hover:bg-red-950/40 disabled:opacity-40"
            >
              Reject
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
