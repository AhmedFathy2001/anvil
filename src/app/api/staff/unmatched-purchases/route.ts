import { NextResponse } from 'next/server';

import { CAN_BILL, requirePlatformApi } from '@/lib/platformAccess';
import { searchAttachSpaces, searchAttachUsers } from '@/lib/unmatchedPurchases';

export const dynamic = 'force-dynamic';

// /api/staff/unmatched-purchases — the pickers behind attaching an unmatched Gumroad purchase.
//   GET ?spaces=<q>   spaces by slug, name or id (both kinds; the attach checks the kind)
//   GET ?users=<q>    logins by Discord name, display name, Discord id or login id
// Root only, like the attach itself (platformAccess CAN_BILL).
export async function GET(request: Request) {
  const gate = await requirePlatformApi(CAN_BILL);
  if ('response' in gate) return gate.response;
  const sp = new URL(request.url).searchParams;
  const spaces = sp.get('spaces');
  if (spaces != null) return NextResponse.json({ spaces: await searchAttachSpaces(spaces.slice(0, 80)) });
  const users = sp.get('users');
  if (users != null) return NextResponse.json({ users: await searchAttachUsers(users.slice(0, 80)) });
  return NextResponse.json({ error: 'spaces or users' }, { status: 400 });
}
