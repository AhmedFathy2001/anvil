import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { handleGuideImageUpload } from '@/lib/guideUpload';
import { rateLimitByKey } from '@/lib/rate-limit';

// Screenshots for a proposal. Any signed-in person — so it is rate limited per person, and lands
// under its own prefix where an unapproved proposal's images are easy to find and clear.
export async function POST(request: Request) {
  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const rl = await rateLimitByKey('guide-proposal-upload', String(user.userId), { limit: 40, windowMs: 3_600_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Upload limit reached for this hour.' }, { status: 429 });
  return handleGuideImageUpload(request, `proposals/guides/${user.userId}`);
}
