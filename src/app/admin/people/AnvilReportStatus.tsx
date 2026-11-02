'use client';

import { clanReportStatusLabel, clanReportWhen, CLAN_REPORT_KIND_LABEL, type ClanReportStatusInput } from '@/lib/characterReportStatus';

const TONE: Record<string, string> = {
  wait: 'bg-gold/15 text-gold',
  done: 'bg-accent-green/15 text-accent-green-light',
  undone: 'bg-red-500/15 text-red-400',
  no: 'bg-brown-light text-text-muted',
};

/**
 * Where a report this clan sent to Anvil stands — on the roster row and the needs-review page, so
 * "sent" is never the last thing a clan hears. The staff note (if any) is the tooltip, or shown in
 * full with `showNote`.
 */
export default function AnvilReportStatus({ report, showKind = false, showNote = false }: { report: ClanReportStatusInput; showKind?: boolean; showNote?: boolean }) {
  const { label, tone } = clanReportStatusLabel(report);
  const when = clanReportWhen(report);
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${TONE[tone]}`}
        title={report.note ? `Anvil: ${report.note}` : undefined}
      >
        {showKind ? `${CLAN_REPORT_KIND_LABEL[report.kind] ?? 'Report'} · ` : ''}
        {label}
        {when ? ` ${when}` : ''}
      </span>
      {showNote && report.note && report.status !== 'open' && report.status !== 'applied' && (
        <span className="text-[11px] text-text-muted">Anvil: {report.note}</span>
      )}
    </span>
  );
}
