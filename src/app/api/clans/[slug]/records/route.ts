import { NextResponse } from 'next/server';

import { jsonWithEtag } from '@/lib/httpEtag';
import { visibleClan } from '@/lib/pluginUi/load';
import { getClanRecordBoard, getClanRecordHolders } from '@/lib/records';
import { RECORD_PERIODS, recordMetricLabel, type RecordPeriod } from '@/lib/recordsRules';

/**
 * A clan's record holders: GET /api/clans/<slug>/records?period=day|week|month|year
 *   → { period, holders: [{ metric, label, value, rsn, startedAt, endedAt }] }
 * One metric's top ten instead: add &metric=<hiscores key | hours_played | hours_bossed>
 *   → { period, metric, label, board: [{ rsn, value, startedAt, endedAt }] }
 *
 * Same visibility as the clan card (visibleClan): listed clans for anyone, an unlisted clan for its
 * own members.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const clan = await visibleClan(request, decodeURIComponent((await params).slug));
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const q = new URL(request.url).searchParams;
  const rawPeriod = q.get('period') ?? 'day';
  if (!(RECORD_PERIODS as readonly string[]).includes(rawPeriod)) {
    return NextResponse.json({ error: 'period must be day, week, month or year' }, { status: 400 });
  }
  const period = rawPeriod as RecordPeriod;
  const metric = q.get('metric');
  if (metric) {
    if (metric.length > 64) return NextResponse.json({ error: 'Unknown metric' }, { status: 400 });
    const board = await getClanRecordBoard(clan.id, metric, period, 10);
    return jsonWithEtag(request, {
      period,
      metric,
      label: recordMetricLabel(metric),
      board: board.map((r) => ({ rsn: r.rsn, value: r.value, startedAt: r.startedAt, endedAt: r.endedAt })),
    });
  }
  const holders = await getClanRecordHolders(clan.id, period);
  return jsonWithEtag(request, {
    period,
    holders: holders.map((h) => ({ metric: h.metric, label: recordMetricLabel(h.metric), value: h.value, rsn: h.rsn, startedAt: h.startedAt, endedAt: h.endedAt })),
  });
}
