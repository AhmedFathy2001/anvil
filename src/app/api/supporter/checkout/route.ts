import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { track } from '@/lib/analytics';
import { verifyUser } from '@/lib/auth';
import { REFERRAL_COOKIE } from '@/lib/referrals';
import { isReferralCode } from '@/lib/referralRules';
import { ensureSupporterRef, supporterCheckoutUrl } from '@/lib/supporter';

/**
 * The Supporter buy button: records "started checkout" on the server, then sends the person to the
 * hosted checkout carrying their ref. Signed out, or checkout not configured, goes back to the page.
 */
export async function GET(request: Request) {
  const back = NextResponse.redirect(new URL('/supporter', request.url));
  const session = await verifyUser();
  if (!session) return back;
  const via = (await cookies()).get(REFERRAL_COOKIE)?.value ?? null;
  const url = supporterCheckoutUrl(await ensureSupporterRef(session.userId), isReferralCode(via) ? via : null);
  if (!url) return back;
  track('supporter.checkout', { userId: session.userId, clanId: null });
  return NextResponse.redirect(url);
}
