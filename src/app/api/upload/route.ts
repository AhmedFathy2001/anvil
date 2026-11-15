import { NextResponse } from 'next/server';
import { refuseForeignCharacter } from '@/lib/pluginForeign';
import { verifyUser, verifyCaptain, verifyPlayer, verifyPluginToken } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { put, clanMediaKey } from '@/lib/storage';
import { currentClan } from '@/lib/clanContext';
import crypto from 'crypto';
import { stripImageMetadata, UNREADABLE_IMAGE } from '@/lib/stripImageMetadata';
import { fetchRemoteImage } from '@/lib/remoteImage';
import { db } from '@/db';
import { proofUploads } from '@/db/schema';

// Submission images are the single largest consumer of Blob storage — the plugin auto-submits a
// full-resolution PNG per drop/kill and nothing deletes them until the event is torn down. We
// therefore re-encode EVERY processable upload to downscaled WebP here, at the one choke point all
// clients (plugin, web, mobile) pass through. A ~2–3 MB game PNG becomes ~80–150 KB with the baked
// proof banner still legible. Server-side and version-independent, so storage shrinks without
// waiting on a plugin release.

// Extended types to support iOS HEIC/HEIF and edge cases
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];

// Also check by file extension for iOS compatibility (sometimes MIME type is wrong)
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB (increased for high-res mobile photos)

// Re-encode target. 1600px on the long edge keeps the baked proof banner + item icons legible while
// collapsing fullscreen captures; q80 WebP is visually lossless for screenshots at a fraction of PNG.
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 80;

export async function POST(request: Request) {
  // Image uploads are the most expensive public write (decode + resize). Cap per IP.
  const rl = await rateLimit(request, 'upload', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many uploads — slow down.' }, { status: 429, headers: rateLimitHeaders(rl) });

  // Any authenticated clan member can upload a submission image. The unified /team page authenticates
  // members via the Discord web session (admin_session cookie, any role) — verifyUser covers that AND
  // admins. Previously only verifyAdmin/captain/player cookies + plugin token were accepted, so a
  // non-captain member hit 401 here even though the submission POST (which enforces team membership
  // and consumes the URL) would have accepted them. Legacy captain/player cookies + plugin stay.
  // A plugin playing somebody else's character uploads nothing for it (lib/pluginForeign).
  const foreign = await refuseForeignCharacter(request);
  if (foreign) return foreign;

  const webUser = await verifyUser();
  const captain = await verifyCaptain();
  const player = await verifyPlayer();
  const pluginAuth = await verifyPluginToken(request);

  if (!webUser && !captain && !player && !pluginAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // "Paste URL": a JSON {url} instead of a file. The server takes its own copy (lib/remoteImage) and it
  // goes through exactly the same checks and re-encode as an upload, so a submission can use it.
  let file: File | null;
  if ((request.headers.get('content-type') ?? '').includes('application/json')) {
    const { url } = (await request.json().catch(() => ({}))) as { url?: unknown };
    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }
    const remote = await fetchRemoteImage(url);
    if (!remote.ok) return NextResponse.json({ error: remote.error }, { status: 400 });
    file = new File([new Uint8Array(remote.bytes)], `pasted.${remote.ext}`, { type: remote.type });
  } else {
    const formData = await request.formData();
    file = formData.get('file') as File | null;
  }

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Get file extension
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // Check both MIME type and extension for better iOS compatibility
  // iOS sometimes sends incorrect MIME types or 'application/octet-stream'
  const isValidType = ALLOWED_TYPES.includes(file.type) ||
    file.type.startsWith('image/') ||
    ALLOWED_EXTENSIONS.includes(ext);

  if (!isValidType) {
    return NextResponse.json({
      error: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP, HEIC'
    }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 10MB' }, { status: 400 });
  }

  // EVERY image is re-encoded, which is also what removes its metadata (EXIF location, camera, text
  // chunks): lib/stripImageMetadata. An image that cannot be read is refused rather than stored with
  // whatever it carries — that includes HEIC where the server has no decoder (the phone's share sheet
  // can send a JPG instead).
  const clean = await stripImageMetadata(Buffer.from(await file.arrayBuffer()), {
    maxDimension: MAX_DIMENSION,
    quality: WEBP_QUALITY,
  });
  if (!clean) return NextResponse.json({ error: UNREADABLE_IMAGE }, { status: 400 });
  const body: Buffer = clean.bytes;
  const finalExt: string = clean.ext;
  const contentType: string | undefined = clean.contentType;

  // Always hand storage an explicit, safe image content-type derived from the final extension.
  // Otherwise it falls back to the CLIENT-declared MIME (File.type), which an attacker can set to
  // text/html or image/svg+xml to get raw bytes served as executable content from the media host
  // (stored XSS). finalExt is always one of the allow-listed raster types below.
  const EXT_CONTENT_TYPE: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  };
  const safeContentType = contentType ?? EXT_CONTENT_TYPE[finalExt] ?? 'application/octet-stream';

  const clan = await currentClan();
  const filename = clanMediaKey(clan, `submissions/${crypto.randomUUID()}.${finalExt}`);
  const bytes = body;
  const { url } = await put(filename, bytes, safeContentType);

  // Provenance: which door this picture came in by, and its fingerprint (schema proofUploads). A
  // failure here must not lose the upload — the submission just won't find it and flags instead.
  await db
    .insert(proofUploads)
    .values({
      url,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      via: pluginAuth ? 'plugin' : 'web',
      userId: pluginAuth ? pluginAuth.userId : (webUser?.userId ?? null),
    })
    .onConflictDoNothing()
    .catch((e) => console.error('[upload] provenance row failed', e));

  return NextResponse.json({ url });
}
