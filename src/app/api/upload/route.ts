import { NextResponse } from 'next/server';
import { verifyAdmin, verifyCaptain, verifyPlayer } from '@/lib/auth';
import { put } from '@vercel/blob';
import crypto from 'crypto';

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

export async function POST(request: Request) {
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();
  const player = await verifyPlayer();

  if (!isAdmin && !captain && !player) {
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

  // Use original extension or default to jpg
  const finalExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : 'jpg';
  const filename = `submissions/${crypto.randomUUID()}.${finalExt}`;

  const { url } = await put(filename, file, { access: 'public' });

  return NextResponse.json({ url });
}
