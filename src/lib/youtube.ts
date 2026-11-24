// YouTube in guides: a pasted link becomes a video id and a start time, nothing else. PURE.
//
// Only the 11-character id and a whole-second start are ever kept; the player is always our own
// fixed template on youtube-nocookie.com, so no pasted text reaches an iframe's src, and nothing
// loads until the reader clicks the poster (GuideBody's YouTubeEmbed).

export interface YouTubeRef {
  id: string;
  start: number;
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/** "1m02s", "62", "1h2m3s" → seconds; anything else → 0. */
export function parseStart(v: string | null | undefined): number {
  if (!v) return 0;
  if (/^\d{1,6}$/.test(v)) return Math.min(Number(v), 86_400);
  const m = /^(?:(\d{1,2})h)?(?:(\d{1,3})m)?(?:(\d{1,5})s)?$/.exec(v);
  if (!m || (!m[1] && !m[2] && !m[3])) return 0;
  return Math.min(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0), 86_400);
}

/** A YouTube watch / youtu.be / shorts / embed link → { id, start }, or null for anything else. */
export function parseYouTube(raw: string): YouTubeRef | null {
  const text = raw.trim().replace(/^<|>$/g, '');
  if (!text || text.length > 300 || /[\s"'<>]/.test(text)) return null;
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  let id: string | null = null;
  const parts = u.pathname.split('/').filter(Boolean);
  if (host.endsWith('youtu.be')) id = parts[0] ?? null;
  else if (u.pathname === '/watch') id = u.searchParams.get('v');
  else if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') id = parts[1] ?? null;
  if (!id || !ID_RE.test(id)) return null;
  const start = parseStart(u.searchParams.get('t') ?? u.searchParams.get('start'));
  return { id, start };
}

/** The only player URL Anvil ever builds. */
export function youTubeEmbedUrl(ref: YouTubeRef): string {
  if (!ID_RE.test(ref.id)) throw new Error('bad video id');
  const start = Math.max(0, Math.floor(ref.start || 0));
  return `https://www.youtube-nocookie.com/embed/${ref.id}?autoplay=1&rel=0${start ? `&start=${start}` : ''}`;
}

/** The poster image (served by YouTube's image host, already on the guide image allowlist). */
export const youTubePoster = (ref: YouTubeRef) => `https://i.ytimg.com/vi/${ref.id}/hqdefault.jpg`;

/** The plain link Discord gets (it unfurls a player itself). */
export function youTubeLink(ref: YouTubeRef): string {
  return `https://youtu.be/${ref.id}${ref.start ? `?t=${ref.start}` : ''}`;
}

export const fmtStart = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
