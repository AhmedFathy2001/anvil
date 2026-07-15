import { NextResponse } from 'next/server';
import {
  getInstanceId,
  getInstanceName,
  getInstanceType,
  getPublicJwk,
  FEDERATION_CAPABILITIES,
} from '@/lib/federation';
import { getBrokerTrust } from '@/lib/pluginConfig';

export const dynamic = 'force-dynamic';

// GET /api/federation/v1/meta — capability negotiation (WIRE §7). Public, no auth. Advertises the
// stable instanceId, human name, hosted/self-hosted type, wire version, supported capabilities, the
// brokers this instance trusts, and the instance's PUBLIC signing JWK (never the private half).
export async function GET() {
  const [instanceId, name, publicKey, brokerTrust] = await Promise.all([
    getInstanceId(),
    getInstanceName(),
    getPublicJwk(),
    getBrokerTrust(),
  ]);

  return NextResponse.json({
    instanceId,
    name,
    type: getInstanceType(),
    version: '1',
    capabilities: [...FEDERATION_CAPABILITIES],
    brokerTrust,
    publicKey,
  });
}
