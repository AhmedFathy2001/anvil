// Platform reports, the pure half (lib/platformReports is the database half): what can be reported,
// the reasons a reporter picks from, the note and snapshot sanitizing, and which staff action applies
// to which kind of thing. No database, no `@/` imports — tests load it directly.
//
// A report goes to ANVIL STAFF, never to the reported party: nothing here or in the database half
// ever hands the reporter's identity to anything but the platform queue (/staff/promotions).

import { cleanText, type Checked } from './spacePage/rules.ts';

/**
 * What a viewer can report, each addressed by its id in its own table:
 *   space → clans (a creator space's page), creator_panel → space_panels, clan → clans,
 *   event → events, character → accounts (/p/<rsn>), person → players (/u/<id>),
 *   highlight → stream_highlights.
 */
export const REPORT_TARGETS = ['space', 'creator_panel', 'clan', 'event', 'character', 'person', 'highlight'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_TARGET_LABEL: Record<ReportTarget, string> = {
  space: 'Creator page',
  creator_panel: 'Creator panel',
  clan: 'Clan',
  event: 'Event',
  character: 'Player profile',
  person: 'Player profile',
  highlight: 'Stream highlight',
};

export function isReportTarget(v: unknown): v is ReportTarget {
  return typeof v === 'string' && (REPORT_TARGETS as readonly string[]).includes(v);
}

/** The reasons, plain and short. Stored as the key; shown as the label. */
export const REPORT_CATEGORIES = ['jagex_rules', 'scam', 'harassment', 'impersonation', 'inappropriate', 'cheating', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  jagex_rules: 'Breaks Jagex rules (RWT, gambling, bots, private servers)',
  scam: 'Scam or phishing',
  harassment: 'Harassment or hate',
  impersonation: 'Impersonation',
  inappropriate: 'Inappropriate content',
  cheating: 'Cheating in an event',
  other: 'Something else',
};

export function isReportCategory(v: unknown): v is ReportCategory {
  return typeof v === 'string' && (REPORT_CATEGORIES as readonly string[]).includes(v);
}

export const REPORT_NOTE_MAX = 500;
export const STAFF_NOTE_MAX = 1000;
export const SNAPSHOT_MAX = 4000;
const SNAPSHOT_URL_MAX = 500;

/** The reporter's optional note: plain text, invisible/control characters out, at most 500. */
export function cleanReportNote(raw: unknown): Checked<string> {
  return cleanText(raw, REPORT_NOTE_MAX, { field: 'The note', multiline: true });
}

/** Staff's own note on a report. */
export function cleanStaffNote(raw: unknown): Checked<string> {
  return cleanText(raw, STAFF_NOTE_MAX, { field: 'The note', multiline: true });
}

/** An http(s) URL as text, or null. No credentials, no other schemes (javascript:, data:). */
export function snapshotUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password) return null;
    const s = u.toString();
    return s.length > SNAPSHOT_URL_MAX ? null : s;
  } catch {
    return null;
  }
}

/** One line of snapshot text: invisible and control characters out, any markup's angle brackets out. */
function snapshotText(raw: unknown, max = 1000): string {
  if (raw == null) return '';
  const c = cleanText(String(raw), Number.MAX_SAFE_INTEGER, { multiline: true });
  const s = (c.ok ? c.value : '').replace(/[<>]/g, '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * What the reported thing said and linked to when it was reported, so a later edit cannot erase the
 * evidence. TEXT AND URLS ONLY: labelled lines of sanitized text, and http(s) URLs as text — never
 * markup, never an image or a file, never anything about the reporter.
 */
export function buildSnapshot(text: [label: string, value: unknown][], urls: [label: string, url: unknown][] = []): string {
  const lines: string[] = [];
  for (const [label, value] of text) {
    const v = snapshotText(value);
    if (v) lines.push(`${label}: ${v}`);
  }
  for (const [label, url] of urls) {
    const u = snapshotUrl(url);
    if (u) lines.push(`${label}: ${u}`);
  }
  const s = lines.join('\n');
  return s.length > SNAPSHOT_MAX ? s.slice(0, SNAPSHOT_MAX) : s;
}

// ── Staff actions ────────────────────────────────────────────────────────────────────────────────

/**
 * What platform staff can do about a report beyond dismissing it, by kind — only powers the platform
 * already has, applied from the queue:
 *   hide    — take the content down: a creator panel, a creator page's promotions, a highlight.
 *   unlist  — the existing platform hide of a clan or space (clans.platform_hidden): off every public
 *             directory and listing; for an event, its host clan.
 * A player profile has neither: staff open it (and /staff/people) and mark the report handled.
 */
export type ReportAction = 'hide' | 'unlist';

export const TARGET_ACTIONS: Record<ReportTarget, ReportAction[]> = {
  space: ['hide', 'unlist'],
  creator_panel: ['hide'],
  clan: ['unlist'],
  event: ['unlist'],
  character: [],
  person: [],
  highlight: ['hide'],
};

/** Report statuses. 'hidden' = staff took an action on the content; 'resolved' = handled elsewhere. */
export const REPORT_STATUSES = ['open', 'hidden', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** The button label for an action on a kind. */
export function actionLabel(target: ReportTarget, action: ReportAction): string {
  if (action === 'unlist') return target === 'event' ? 'Hide host from directories' : 'Hide from directories';
  if (target === 'creator_panel') return 'Hide this panel';
  if (target === 'space') return 'Hide page promotions';
  return 'Hide this clip';
}
