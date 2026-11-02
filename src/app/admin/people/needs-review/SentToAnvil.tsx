import type { ClanReportView } from '@/lib/characterReports';

import AnvilReportStatus from '../AnvilReportStatus';

/**
 * Everything this clan sent to Anvil that is still open or was decided in the last 30 days. Linked
 * claims leave the queue above the moment they are made, so without this list the clan never heard
 * what happened to them.
 */
export default function SentToAnvil({ reports }: { reports: ClanReportView[] }) {
  if (reports.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[16.5px] font-semibold">Sent to Anvil</h2>
      </div>
      <p className="mb-3.5 ml-4 max-w-[64ch] text-[13.5px] text-text-muted">
        What you asked Anvil about a character, and what came of it. Once your clan has proven its in-game
        name, your owner&rsquo;s requests about characters that are only in your clan are done straight
        away and Anvil double-checks them; anything Anvil reverts shows here with its note.
      </p>
      <ul className="divide-y divide-card-border/50 rounded-xl border border-card-border bg-card-bg">
        {reports.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-medium">
                {r.rsn}
                {r.kind === 'rename' && r.requestedRsn && r.requestedRsn !== r.rsn ? <span className="text-text-muted"> → {r.requestedRsn}</span> : null}
                {r.kind === 'claim_request' && r.claimantName ? <span className="text-text-muted"> → {r.claimantName}</span> : null}
              </div>
            </div>
            <AnvilReportStatus report={r} showKind showNote />
          </li>
        ))}
      </ul>
    </section>
  );
}
