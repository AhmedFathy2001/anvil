import { POST as uploadRoute } from '@/app/api/upload/route';

/** A plugin request's JSON, and its image when it came as multipart (`body` = the JSON, `file` = the image). */
export async function readBody(request: Request): Promise<{ body: Record<string, unknown> | null; file: File | null; form: FormData | null }> {
  if (!(request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
    return { body: (await request.json().catch(() => null)) as Record<string, unknown> | null, file: null, form: null };
  }
  const form = await request.formData().catch(() => null);
  const raw = form?.get('body');
  let body: Record<string, unknown> | null = null;
  try {
    body = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  const file = form?.get('file');
  return { body, file: file instanceof File ? file : null, form: form ?? null };
}

/**
 * Store the image through /api/upload in-process (same auth, recompression and provenance row), or
 * say why not. A passing failure answers 503, so the plugin keeps the proof and sends it again.
 */
export async function storeImage(request: Request, file: File): Promise<{ url: string } | { status: number; error: string }> {
  const headers = new Headers(request.headers);
  headers.delete('content-type');
  headers.delete('content-length');
  const form = new FormData();
  form.append('file', file, file.name || 'proof.jpg');
  const res = await uploadRoute(new Request(new URL('/api/upload', request.url), { method: 'POST', headers, body: form }));
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (res.ok && json.url) return { url: json.url };
  return { status: res.status >= 500 || res.status === 429 ? 503 : res.status, error: json.error ?? 'Image upload failed' };
}
