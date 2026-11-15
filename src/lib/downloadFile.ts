import { clanFetch } from '@/lib/clanFetch';

/** The file name in a Content-Disposition header, or the fallback. Pure, so it is testable. */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')) || fallback;
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

/**
 * Fetch a file from an API route and save it from the page, so a failure shows as a message here
 * instead of the browser navigating to raw JSON. Resolves to null on success, or the error text.
 */
export async function downloadFromApi(url: string, fallbackName: string): Promise<string | null> {
  try {
    const res = await clanFetch(url);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return (data as { error?: string }).error || 'The download failed. Try again.';
    }
    const blob = await res.blob();
    const name = filenameFromDisposition(res.headers.get('Content-Disposition'), fallbackName);
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return null;
  } catch {
    return 'Could not reach the server. Check your connection and try again.';
  }
}
