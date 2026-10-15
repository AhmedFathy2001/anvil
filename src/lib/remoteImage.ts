// Fetch an image someone pasted a link to, so it can be stored like an upload.
//
// Proofs must live on our own media host (a submission refuses any other URL — a hotlinked image can be
// swapped or deleted after the fact), so "Paste URL" can't just save the link: the server takes a copy.
// Fetching a URL a user chose is an SSRF door, so it only ever talks to a short list of public image
// hosts people actually paste from, over HTTPS, without following redirects (a redirect could point
// anywhere, including inside our own network), with a size cap and a timeout, and only keeps a body
// that says it is an image.

const IMAGE_HOSTS = new Set([
  'cdn.discordapp.com',
  'media.discordapp.net',
  'i.imgur.com',
  'i.gyazo.com',
  'i.postimg.cc',
  'i.ibb.co',
]);

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

const TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export type RemoteImage = { ok: true; bytes: Buffer; type: string; ext: string } | { ok: false; error: string };

/** Whether a pasted link points at a host we will fetch from. Pure. */
export function allowedImageUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  return IMAGE_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
}

export async function fetchRemoteImage(raw: string): Promise<RemoteImage> {
  const url = allowedImageUrl(raw);
  if (!url) {
    return {
      ok: false,
      error: 'Paste a direct image link from Discord, Imgur, Gyazo, Postimages or ImgBB — or upload the file instead.',
    };
  }
  let res: Response;
  try {
    res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { ok: false, error: "Couldn't reach that link. Try uploading the image instead." };
  }
  if (res.status !== 200) {
    return { ok: false, error: "That link didn't return an image (it may have expired). Try uploading it instead." };
  }
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = TYPE_EXT[type];
  if (!ext) {
    return { ok: false, error: "That link isn't an image — open it, copy the image's own address, or upload the file." };
  }
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) {
    return { ok: false, error: 'That image is over 10MB.' };
  }
  // Read with a running cap: content-length can be missing or wrong.
  const reader = res.body?.getReader();
  if (!reader) return { ok: false, error: "That link didn't return an image." };
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return { ok: false, error: 'That image is over 10MB.' };
    }
    chunks.push(value);
  }
  return { ok: true, bytes: Buffer.concat(chunks), type, ext };
}
