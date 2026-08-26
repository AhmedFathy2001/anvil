import { NextResponse } from 'next/server';
import { put, clanMediaKey } from '@/lib/storage';
import { currentClan } from '@/lib/clanContext';
import crypto from 'crypto';
import { verifyEventTreasurer } from '@/lib/auth';

// Payout proofs are stored under `payouts/` so the unpay/delete actions can remove them individually.
// Mirrors the fee-proof upload: admin-or-treasurer only, image validation, 10 MB cap.
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
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  // The route sits under an event but never read its id, because the old gate was clan-wide. A
  // per-board treasurer can only upload proof for their own board, so now it does.
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  if (!Number.isFinite(eId)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }
  if (!(await verifyEventTreasurer(eId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isValidType =
    ALLOWED_TYPES.includes(file.type) ||
    file.type.startsWith('image/') ||
    ALLOWED_EXTENSIONS.includes(ext);
  if (!isValidType) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP, HEIC' },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 10MB' }, { status: 400 });
  }

  const finalExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : 'jpg';
  const clan = await currentClan();
  const filename = clanMediaKey(clan?.slug, `payouts/${crypto.randomUUID()}.${finalExt}`);
  const { url } = await put(filename, file);

  return NextResponse.json({ url });
}
