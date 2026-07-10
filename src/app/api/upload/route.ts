import { NextResponse } from 'next/server';
import { verifyUser, verifyCaptain, verifyPlayer, verifyPluginToken } from '@/lib/auth';
import { put } from '@/lib/storage';
import crypto from 'crypto';
import sharp from 'sharp';

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

// Sharp decodes JPEG/PNG/WebP via the bundled libvips. Animated GIFs would be flattened to one frame
// and HEIC needs a libheif build sharp doesn't ship — so those pass through untouched rather than
// risk a broken proof. Everything the plugin sends is PNG, the case we most want to shrink, so the
// storage win lands regardless.
const RECOMPRESS_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const RECOMPRESS_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export async function POST(request: Request) {
  // Any authenticated clan member can upload a submission image. The unified /team page authenticates
  // members via the Discord web session (admin_session cookie, any role) — verifyUser covers that AND
  // admins. Previously only verifyAdmin/captain/player cookies + plugin token were accepted, so a
  // non-captain member hit 401 here even though the submission POST (which enforces team membership
  // and consumes the URL) would have accepted them. Legacy captain/player cookies + plugin stay.
  const webUser = await verifyUser();
  const captain = await verifyCaptain();
  const player = await verifyPlayer();
  const pluginAuth = await verifyPluginToken(request);

  if (!webUser && !captain && !player && !pluginAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

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

  // Recompress JPEG/PNG/WebP (by MIME or extension); GIF/HEIC and mislabelled files keep raw bytes.
  const canRecompress = RECOMPRESS_TYPES.has(file.type) || RECOMPRESS_EXTS.has(ext);

  let body: Buffer | File = file;
  let finalExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : 'jpg';
  let contentType: string | undefined;

  if (canRecompress) {
    try {
      const input = Buffer.from(await file.arrayBuffer());
      const out = await sharp(input)
        .rotate() // honour EXIF orientation before metadata is stripped
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      // Guard the rare case where re-encoding an already-tiny image grows it.
      if (out.length < input.length) {
        body = out;
        finalExt = 'webp';
        contentType = 'image/webp';
      } else {
        body = input;
      }
    } catch {
      // Decode failed (corrupt/unsupported) — store the original so a submission never silently drops.
      body = file;
    }
  }

  // Always hand storage an explicit, safe image content-type derived from the final extension.
  // Otherwise it falls back to the CLIENT-declared MIME (File.type), which an attacker can set to
  // text/html or image/svg+xml to get raw bytes served as executable content from the media host
  // (stored XSS). finalExt is always one of the allow-listed raster types below.
  const EXT_CONTENT_TYPE: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  };
  const safeContentType = contentType ?? EXT_CONTENT_TYPE[finalExt] ?? 'application/octet-stream';

  const filename = `submissions/${crypto.randomUUID()}.${finalExt}`;
  const { url } = await put(filename, body, safeContentType);

  return NextResponse.json({ url });
}
