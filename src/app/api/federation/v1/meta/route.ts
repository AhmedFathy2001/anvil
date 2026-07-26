import { NextResponse } from 'next/server';
import {
  getInstanceId,
  getInstanceName,
  getInstanceType,
  getPublicJwk,
  FEDERATION_CAPABILITIES,
} from '@/lib/federation';
import { getBrokerTrust, getFederationEnabled } from '@/lib/pluginConfig';

export const dynamic = 'force-dynamic';

// GET /api/federation/v1/meta — capability negotiation (WIRE §7). Public, no auth. Advertises the
// stable instanceId, human name, hosted/self-hosted type, wire version, supported capabilities, the
// brokers this instance trusts, and the instance's PUBLIC signing JWK (never the private half).
export async function GET() {
  // Master switch (WIRE §10.1): federation OFF must mean OFF for the INBOUND surface too — a
  // clan that left the network stops serving exchanges/reads/relays, so other homes' refreshes
  // drop it within one cycle instead of keeping a ghost connection alive.
  if (!(await getFederationEnabled())) {
    return NextResponse.json({ error: 'federation_disabled' }, { status: 403 });
  }

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
