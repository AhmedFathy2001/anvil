'use client';

import { useMemo } from 'react';

import { diffLines, diffStats, withContext } from '@/lib/guideDiff';

type Side = { title: string; summary: string; body: string };

/** What differs between two versions of a guide: title/summary called out, body as a line diff. */
export default function GuideDiffView({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: Side;
  after: Side;
  beforeLabel: string;
  afterLabel: string;
}) {
  const ops = useMemo(() => diffLines(before.body, after.body), [before.body, after.body]);
  const rows = useMemo(() => withContext(ops, 2), [ops]);
  const stats = diffStats(ops);

  return (
    <div className="space-y-2 text-xs">
      {before.title !== after.title && (
        <p>
          <span className="text-text-muted">Title:</span> <s className="text-red-300/80">{before.title}</s> →{' '}
          <span className="text-emerald-300">{after.title}</span>
        </p>
      )}
      {before.summary !== after.summary && (
        <p>
          <span className="text-text-muted">Summary:</span> <s className="text-red-300/80">{before.summary || '—'}</s> →{' '}
          <span className="text-emerald-300">{after.summary || '—'}</span>
        </p>
      )}
      <p className="text-text-muted">
        Body: <span className="text-emerald-300">+{stats.added}</span> <span className="text-red-300">−{stats.removed}</span> lines ·{' '}
        <span className="text-red-300">−</span> {beforeLabel} <span className="text-emerald-300">+</span> {afterLabel}
      </p>
      {stats.added + stats.removed > 0 && (
        <pre className="max-h-[420px] overflow-auto rounded-lg border border-card-border bg-black/40 p-2 font-mono text-[12px] leading-snug">
          {rows.map((r, i) =>
            r.kind === 'skip' ? (
              <div key={i} className="select-none py-0.5 text-center text-text-muted/60">
                ⋯ {r.count} unchanged line{r.count === 1 ? '' : 's'} ⋯
              </div>
            ) : (
              <div
                key={i}
                className={
                  r.kind === 'add'
                    ? 'bg-emerald-900/30 text-emerald-200'
                    : r.kind === 'del'
                      ? 'bg-red-900/30 text-red-200'
                      : 'text-gray-400'
                }
              >
                <span className="inline-block w-4 select-none opacity-70">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}</span>
                {r.text || ' '}
              </div>
            ),
          )}
        </pre>
      )}
    </div>
  );
}
