import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import {
  addBlockedDomain,
  listBlockedDomains,
  listPromoReports,
  listStaffHidden,
  removeBlockedDomain,
  resolvePromoReport,
  staffSetPanelHidden,
  staffSetSpaceHidden,
} from '@/lib/spacePage/store';

export const dynamic = 'force-dynamic';

/** The operator log (/staff/audit): every promotions action, `platform_`-prefixed. Best effort. */
function logAction(eventType: string, actorUserId: number, clanId: number | null, detail: unknown): void {
  db.insert(clanAuditLog)
    .values({ clanId, eventType: `platform_promo_${eventType}`, actorUserId, newValue: JSON.stringify(detail).slice(0, 2000) })
    .catch(() => {});
}

/**
 * Creator page promotions (lib/spacePage), the platform's side: the report queue, what staff have
 * hidden, and the link blocklist. Support may read; staff act.
 */
export async function GET(request: Request) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const status = new URL(request.url).searchParams.get('status') === 'all' ? 'all' : 'open';
  const [reports, blocklist, hidden] = await Promise.all([listPromoReports(status), listBlockedDomains(), listStaffHidden()]);
  return NextResponse.json({ reports, blocklist, hidden });
}

/**
 * { action: 'resolve', id, how: 'hide' | 'dismiss' }
 * { action: 'hidePanel' | 'showPanel', panelId }
 * { action: 'hideSpace' | 'showSpace', clanId }
 * { action: 'block', domain, reason }  |  { action: 'unblock', id }
 */
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const actor = gate.actor.user.userId;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const num = (v: unknown) => (Number.isInteger(Number(v)) ? Number(v) : null);

  switch (action) {
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
