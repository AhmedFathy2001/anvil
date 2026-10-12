// Deep links for client state: write `?key=value` into the address bar without a navigation, so a
// tab, a log page or a filter can be copied and shared. Keeps the path exactly as it is — under a
// /c/<slug> prefix the browser's path is the prefixed one, and that's the one to keep.
//
// Client-only: call it from handlers, never during render.

export function setUrlParams(updates: Record<string, string | null | undefined>): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}
