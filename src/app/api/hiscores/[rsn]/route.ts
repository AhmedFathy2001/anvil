import { NextResponse } from 'next/server';
import { getStatsByGamemode } from 'osrs-json-hiscores';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ rsn: string }> }
) {
  const { rsn } = await params;
  const decodedRsn = decodeURIComponent(rsn);

  try {
    const stats = await getStatsByGamemode(decodedRsn);
    return NextResponse.json({ rsn: decodedRsn, stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch hiscores';
    return NextResponse.json(
      { error: message, rsn: decodedRsn },
      { status: 404 }
    );
  }
}
