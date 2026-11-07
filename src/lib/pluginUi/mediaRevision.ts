/** Small stable token that changes when an upload URL changes; used only to bust panel image caches. */
export function mediaRevision(...values: (string | null | undefined)[]): string {
  let hash = 0x811c9dc5;
  const source = values.filter(Boolean).join('\n');
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Add cache identity without exposing the underlying storage URL to the Plugin. */
export function revisedMediaPath(path: string, revision: string | null | undefined, level?: number): string {
  const bits = [revision ? `v=${encodeURIComponent(revision)}` : '', level != null ? `level=${level}` : ''].filter(Boolean);
  return bits.length ? `${path}${path.includes('?') ? '&' : '?'}${bits.join('&')}` : path;
}
