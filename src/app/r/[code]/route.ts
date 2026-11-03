import { NextResponse } from 'next/server';

import { REFERRAL_COOKIE } from '@/lib/referrals';
import { isReferralCode } from '@/lib/referralRules';
import { apexOrigin } from '@/lib/seo';

export const dynamic = 'force-dynamic';

// GET /r/<code> — an invite link. Remembers whose it was for 30 days and opens the Supporter page;
// the checkout carries it to Gumroad (lib/referrals). A code that isn't one is simply ignored.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = NextResponse.redirect(`${apexOrigin()}/supporter`, 302);
  const clean = code.toLowerCase();
  if (isReferralCode(clean)) {
    res.cookies.set(REFERRAL_COOKIE, clean, { maxAge: 30 * 86_400, sameSite: 'lax', httpOnly: true, secure: true, path: '/' });
  }
  return res;
}
