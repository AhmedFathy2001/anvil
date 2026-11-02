// How a clan's report to Anvil reads back to the clan. PURE (no database) so client components and
// tests can use it. Lifecycle: lib/characterReports.

export interface ClanReportStatusInput {
  status: string;
  kind: string;
  createdAt: string;
  decidedAt: string | null;
  note: string | null;
}

export function clanReportStatusLabel(r: { status: string }): { label: string; tone: 'wait' | 'done' | 'undone' | 'no' } {
  switch (r.status) {
    case 'applied':
      return { label: 'Done — Anvil will double-check', tone: 'done' };
    case 'resolved':
      return { label: 'Approved by Anvil', tone: 'done' };
    case 'dismissed':
      return { label: 'Declined by Anvil', tone: 'no' };
    case 'reverted':
      return { label: 'Reverted by Anvil', tone: 'undone' };
    default:
      return { label: 'Waiting for Anvil', tone: 'wait' };
  }
}

export const CLAN_REPORT_KIND_LABEL: Record<string, string> = {
  wrong_owner: 'Wrong owner',
  rename: 'Renamed',
  merge: 'Duplicate',
  claim_review: 'Disputed link',
  claim_request: 'Vouched for a claim',
  other: 'Report',
};

/** "Waiting for Anvil since 3 Oct" / "Reverted by Anvil on 5 Oct" — the date that matters for the status. */
export function clanReportWhen(r: ClanReportStatusInput): string {
  const at = r.status === 'open' ? r.createdAt : r.decidedAt ?? r.createdAt;
  const ms = Date.parse(at.includes('T') ? at : `${at.replace(' ', 'T')}Z`);
  if (!Number.isFinite(ms)) return '';
  const day = new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return r.status === 'open' ? `since ${day}` : `on ${day}`;
}
