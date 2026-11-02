// Extra screenshots and links on one proof. No `@/db`: the tile modal, the routes and the tests all
// validate with this, and none of them should open a connection for it. The DB half is
// lib/proofAttachmentsDb.
//
// Why: a cumulative manual tile ("100 golems", "75 delves") is proved by the counter at the start and
// the counter at the end. One image per submission made that two submissions, or one image and a
// promise. Now the end shot carries the start shot with it, and either can be a link (a clip, an
// album) instead.

export type AttachmentKind = 'image' | 'link';
export type AttachmentLabel = 'start' | 'end';

export interface ProofAttachmentInput {
  kind: AttachmentKind;
  url: string;
  label?: AttachmentLabel | null;
}

export interface ProofAttachment {
  id: number;
  submissionId: number | null;
  kind: AttachmentKind;
  url: string;
  label: AttachmentLabel | null;
  createdAt: string;
  userId: number | null;
}

/** Most extras one proof (or one tile's draft) holds. Generous for a before/after plus a few angles. */
export const MAX_ATTACHMENTS = 10;
const MAX_URL = 1000;

const LABELS = new Set<string>(['start', 'end']);

/**
 * Validate what a client sent. Images must be files this site stored (the same rule as the main
 * screenshot: no Discord embed or review page pointing at an arbitrary host). Links may go anywhere
 * http(s) — they are shown as links, never embedded. Returns the clean list or the first problem.
 */
export function parseAttachments(
  raw: unknown,
  isManagedImage: (url: string) => boolean,
): { ok: true; items: ProofAttachmentInput[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, items: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'attachments must be a list' };
  if (raw.length > MAX_ATTACHMENTS) return { ok: false, error: `At most ${MAX_ATTACHMENTS} extra screenshots or links per proof` };
  const items: ProofAttachmentInput[] = [];
  for (const a of raw) {
    if (!a || typeof a !== 'object') return { ok: false, error: 'Each attachment needs a kind and a url' };
    const { kind, url, label } = a as Record<string, unknown>;
    if (kind !== 'image' && kind !== 'link') return { ok: false, error: 'An attachment is an image or a link' };
    if (typeof url !== 'string' || !url.trim() || url.trim().length > MAX_URL) return { ok: false, error: 'An attachment needs a url' };
    const clean = url.trim();
    if (kind === 'image' && !isManagedImage(clean)) {
      return { ok: false, error: 'Screenshots must be uploaded here first' };
    }
    if (kind === 'link' && !isWebLink(clean)) return { ok: false, error: 'Links must start with http:// or https://' };
    if (label != null && (typeof label !== 'string' || !LABELS.has(label))) return { ok: false, error: 'A label is "start" or "end"' };
    items.push({ kind, url: clean, label: (label as AttachmentLabel | null | undefined) ?? null });
  }
  return { ok: true, items };
}

export function isWebLink(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname;
  } catch {
    return false;
  }
}

/** "imgur.com" for a link chip — the host, without www. */
export function linkHost(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return raw;
  }
}

/** Start shots first, end shots last, everything else between in the order added. */
export function orderAttachments<T extends { label: AttachmentLabel | null; id: number }>(rows: T[]): T[] {
  const rank = (l: AttachmentLabel | null) => (l === 'start' ? 0 : l === 'end' ? 2 : 1);
  return [...rows].sort((a, b) => rank(a.label) - rank(b.label) || a.id - b.id);
}

