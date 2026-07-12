// Elevation of a feedback/bug report to the central Anvil.Admin instance. This is available ONLY
// when the managed control-plane has configured the ingest URL + shared secret on this instance.
// Self-hosted instances never have these, so elevation is simply unavailable there — the admin UI
// hides the button and the endpoint refuses.

const ELEVATION_URL = process.env.ANVIL_ADMIN_FEEDBACK_URL?.trim();
const ELEVATION_SECRET = process.env.ANVIL_ADMIN_FEEDBACK_SECRET?.trim();
// Which clan this is, so the operator can attribute an elevated report. Set by the provisioner.
const CLAN_SLUG = process.env.CLAN_SLUG?.trim() || null;

export function isElevationAvailable(): boolean {
  return !!ELEVATION_URL && !!ELEVATION_SECRET;
}

export interface ElevatedReport {
  id: number;
  kind: string;
  subject: string;
  body: string;
  reporter: string | null;
  contact: string | null;
  pageUrl: string | null;
  createdAt: string;
}

// Best-effort POST to the admin instance. Never throws — returns a result the caller surfaces.
export async function elevateToAdmin(report: ElevatedReport): Promise<{ ok: boolean; error?: string }> {
  if (!isElevationAvailable()) {
    return { ok: false, error: 'Elevation isn’t available on this instance (self-hosted).' };
  }
  try {
    const res = await fetch(ELEVATION_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ELEVATION_SECRET}` },
      body: JSON.stringify({ clan: CLAN_SLUG, report }),
    });
    if (!res.ok) return { ok: false, error: `The admin instance rejected the report (${res.status}).` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the admin instance.' };
  }
}
