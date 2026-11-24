import { NextResponse } from 'next/server';

import { bad, intParam, readJson, refusal, signedIn } from '@/lib/guideApi';
import { closeWanted, listWanted, mayModerateWanted, requestWanted } from '@/lib/guideCommunity';

export async function GET() {
  return NextResponse.json({ wanted: await listWanted() });
}

// POST — ask for a gap: { guideId? | topic?, tier?, accountType?, build?, note? }.
// { action: 'close', id } closes one (curators).
export async function POST(request: Request) {
  const gate = await signedIn('wanted', 10, 3_600_000);
  if ('response' in gate) return gate.response;
  const body = await readJson(request);
  if (!body) return bad('Bad request');
  if (body.action === 'close') {
    const id = intParam(body.id);
    if (!id || !(await mayModerateWanted(gate.user.userId, id))) return bad('Not found', 404);
    await closeWanted(id);
    return NextResponse.json({ ok: true });
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  try {
    await requestWanted({ userId: gate.user.userId, guideId: intParam(body.guideId), topic: str(body.topic), tier: str(body.tier), accountType: str(body.accountType), build: str(body.build), note: str(body.note) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return refusal(err);
  }
}
