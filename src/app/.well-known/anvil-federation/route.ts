import { NextResponse } from 'next/server';
import { getInstanceId, getVerificationToken } from '@/lib/federation';

export const dynamic = 'force-dynamic';

// GET /.well-known/anvil-federation — domain-ownership proof surface (WIRE §6). Public, no auth.
// The broker issues a verificationToken at POST /register; the instance proves control of its domain
// by echoing that token here. Returns null until a broker registration writes the setting — Layer 0
// works with no broker, so this endpoint is intentionally live (and honest) from first boot.
export async function GET() {
  const [instanceId, verificationToken] = await Promise.all([
    getInstanceId(),
    getVerificationToken(),
  ]);
  return NextResponse.json({ instanceId, verificationToken });
}
