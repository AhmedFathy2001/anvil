// A clan audit entry as the audit page may show it.
//
// `old_value` / `new_value` are free-form JSON written by forty-odd call sites, and the page used to
// send both to the browser verbatim. The screen reads two things out of them: a name to show when
// the entry has no roster seat, and the previous name on a rename. Everything else that happened to
// be stored came along for every moderator to read in the page source — an applied character
// report's undo snapshot (the former holder's person id, login id and plugin account hash), and a
// first login's Discord id and username.
//
// So the values are rebuilt here from exactly what is drawn. The stored row is untouched: the undo
// path (lib/characterReportActions) reads its snapshot from the database, never from the page.
//
// PURE — tests/audit-view.test.ts.

function field(json: string | null, key: string): string | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object') {
      const v = (parsed as Record<string, unknown>)[key];
      return typeof v === 'string' && v ? v : null;
    }
  } catch {
    // Not JSON (older rows hold plain strings): nothing to show from it.
  }
  return null;
}

export interface AuditValues {
  oldValue: string | null;
  newValue: string | null;
}

export function auditValuesForClient(row: {
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  /** Who did it, by display name — the label for a first login, which names no character. */
  actorDisplayName?: string | null;
}): AuditValues {
  const wasRsn = row.eventType === 'renamed' ? field(row.oldValue, 'rsn') : null;
  const label = field(row.newValue, 'rsn') ?? (row.eventType === 'user_signed_up' ? row.actorDisplayName ?? null : null);
  return {
    oldValue: wasRsn ? JSON.stringify({ rsn: wasRsn }) : null,
    newValue: label ? JSON.stringify({ rsn: label }) : null,
  };
}
