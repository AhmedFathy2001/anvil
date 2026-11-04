import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { actOnReport, listHiddenHighlights, listReports, openReportCountsByType, showHighlight, type StaffReportOp } from '@/lib/platformReports';
import { isReportTarget, REPORT_STATUSES, type ReportStatus } from '@/lib/platformReportRules';
import { forgetLinkCards } from '@/lib/ogKit';
import {
  addBlockedDomain,
  listBlockedDomains,
  listStaffHidden,
  removeBlockedDomain,
  resolvePromoReport,
  staffSetPanelHidden,
  staffSetSpaceHidden,
} from '@/lib/spacePage/store';

export const dynamic = 'force-dynamic';

/**
 * The operator log (/staff/audit): every action from the reports inbox, `platform_`-prefixed. Never
 * the reporter — only the report, what it was about and what staff did. Best effort.
 */
function logAction(eventType: string, actorUserId: number, clanId: number | null, detail: unknown): void {
  db.insert(clanAuditLog)
    .values({ clanId, eventType: `platform_promo_${eventType}`, actorUserId, newValue: JSON.stringify(detail).slice(0, 2000) })
    .catch(() => {});
}

/**
 * The platform's reports inbox (lib/platformReports) plus the creator-page tools (lib/spacePage):
 * reports of every kind, what staff have hidden, and the link blocklist. Support may read; staff act.
 *
 *   ?status=open|all|hidden|resolved|dismissed   ?type=all|space|creator_panel|clan|event|character|person|highlight
 */
export async function GET(request: Request) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const sp = new URL(request.url).searchParams;
  const rawStatus = sp.get('status') ?? 'open';
  const status = rawStatus === 'all' || (REPORT_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as 'all' | ReportStatus) : 'open';
  const rawType = sp.get('type');
  const type = isReportTarget(rawType) ? rawType : 'all';
  const [reports, counts, blocklist, hidden, hiddenHighlights] = await Promise.all([
    listReports({ status, type }),
    openReportCountsByType(),
    listBlockedDomains(),
    listStaffHidden(),
    listHiddenHighlights(),
  ]);
  return NextResponse.json({ reports, counts, blocklist, hidden: { ...hidden, highlights: hiddenHighlights } });
}

/**
 * { action: 'report', id, op: 'dismiss' | 'resolve' | 'hide' | 'unlist' | 'note', note? }
 * { action: 'resolve', id, how: 'hide' | 'dismiss' }            (the creator-page queue's original shape)
 * { action: 'hidePanel' | 'showPanel', panelId }
 * { action: 'hideSpace' | 'showSpace', clanId }
 * { action: 'showHighlight', highlightId }
 * { action: 'block', domain, reason }  |  { action: 'unblock', id }
 */
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const actor = gate.actor.user.userId;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const num = (v: unknown) => (v != null && Number.isInteger(Number(v)) ? Number(v) : null);

  switch (action) {
    case 'report': {
      const id = num(body.id);
      const o = body.op;
      const op: StaffReportOp | null =
        o === 'dismiss' || o === 'resolve'
          ? { op: o }
          : o === 'note'
            ? { op: 'note', note: body.note }
            : o === 'hide' || o === 'unlist'
              ? { op: 'act', action: o }
              : null;
      if (id == null || !op) return NextResponse.json({ error: 'id and op are required' }, { status: 400 });
      const r = await actOnReport(id, op, actor);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      if (r.value.clanHiddenChanged) forgetLinkCards();
      logAction(`report_${r.value.what}`, actor, r.value.clanId, { reportId: id, targetType: r.value.targetType, targetId: r.value.targetId });
      return NextResponse.json({ ok: true });
    }
    case 'resolve': {
      const id = num(body.id);
      if (id == null || (body.how !== 'hide' && body.how !== 'dismiss')) return NextResponse.json({ error: 'id and how are required' }, { status: 400 });
      const r = await resolvePromoReport(id, body.how, actor);
      if (r.ok) logAction(`report_${body.how}`, actor, null, { reportId: id });
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 404 });
    }
    case 'hidePanel':
    case 'showPanel': {
      const id = num(body.panelId);
      if (id == null || !(await staffSetPanelHidden(id, action === 'hidePanel', actor))) return NextResponse.json({ error: 'That panel is gone.' }, { status: 404 });
      logAction(action === 'hidePanel' ? 'panel_hidden' : 'panel_shown', actor, null, { panelId: id });
      return NextResponse.json({ ok: true });
    }
    case 'hideSpace':
    case 'showSpace': {
      const id = num(body.clanId);
      if (id == null) return NextResponse.json({ error: 'clanId is required' }, { status: 400 });
      await staffSetSpaceHidden(id, action === 'hideSpace', actor);
      logAction(action === 'hideSpace' ? 'page_hidden' : 'page_shown', actor, id, { clanId: id });
      return NextResponse.json({ ok: true });
    }
    case 'showHighlight': {
      const id = num(body.highlightId);
      if (id == null || !(await showHighlight(id, actor))) return NextResponse.json({ error: 'That clip is gone.' }, { status: 404 });
      logAction('highlight_shown', actor, null, { highlightId: id });
      return NextResponse.json({ ok: true });
    }
    case 'block': {
      const r = await addBlockedDomain(String(body.domain ?? ''), body.reason, actor);
      if (r.ok) logAction('domain_blocked', actor, null, { domain: r.value, reason: body.reason });
      return r.ok ? NextResponse.json({ ok: true, domain: r.value }) : NextResponse.json({ error: r.error }, { status: 400 });
    }
    case 'unblock': {
      const id = num(body.id);
      if (id == null) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      await removeBlockedDomain(id);
      logAction('domain_unblocked', actor, null, { id });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
