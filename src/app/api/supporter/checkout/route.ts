import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { track } from '@/lib/analytics';
import { verifyUser } from '@/lib/auth';
import { REFERRAL_COOKIE } from '@/lib/referrals';
import { isReferralCode } from '@/lib/referralRules';
import { supporterBuy } from '@/lib/buyOffer';
import { ensureSupporterRef, supporterCheckoutUrl } from '@/lib/supporter';
import { supporterTrialUsed } from '@/lib/supporterBilling';

/**
 * The Supporter buy button: records "started checkout" on the server, then sends the person to the
 * hosted checkout carrying their ref. Signed out, or checkout not configured, goes back to the page.
 *
 * WHICH PRODUCT is decided here, not by the link pressed (lib/buyOffer supporterBuy): someone who has
 * had a trial (Anvil's or Gumroad's) or a membership only ever gets the pay-now product, and goes
 * back to the page with ?soon=1 when that is not configured; someone who has not may take Gumroad's
 * trial, or skip it with ?pay=now.
 */
export async function GET(request: Request) {
  const back = NextResponse.redirect(new URL('/supporter', request.url));
  const session = await verifyUser();
  if (!session) return back;
  const via = (await cookies()).get(REFERRAL_COOKIE)?.value ?? null;
  const buttons = supporterBuy(await supporterTrialUsed(session.userId));
  if (buttons.kind === 'soon') return NextResponse.redirect(new URL('/supporter?soon=1', request.url));
  if (buttons.kind === 'none') return back;
  const wantsNow = new URL(request.url).searchParams.get('pay') === 'now';
  const mode: 'trial' | 'now' =
    buttons.kind === 'subscribe' ? (buttons.url.includes('pay=now') ? 'now' : 'trial') : wantsNow && buttons.nowUrl ? 'now' : 'trial';
  const url = supporterCheckoutUrl(await ensureSupporterRef(session.userId), isReferralCode(via) ? via : null, mode);
  if (!url) return back;
  track('supporter.checkout', { userId: session.userId, clanId: null, props: { product: mode } });
  return NextResponse.redirect(url);
}
