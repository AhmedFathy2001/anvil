import { NextResponse } from 'next/server';

import { jsonWithEtag } from '@/lib/httpEtag';
import { pluginAct, pluginView } from '@/lib/pluginUi/views';

/**
 * The plugin side panel's views, built here and drawn by the plugin (`plugin-ui` capability;
 * lib/pluginUi/nodes for the shape).
 *
 * GET ?v=<view>&<args>: one view. POST {act, args, fields}: one action (goals), answered with the
 * view to show next. Every read keeps the visibility rule of the route it replaces — a card is only
 * what /api/players/<rsn>/card would hand the same caller — and an unknown view or action is a 404,
 * so the plugin can only ever ask for what's listed in lib/pluginUi/views.
 */

export const dynamic = 'force-dynamic';

const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 200;

function strings(o: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) if (str(v)) out[k] = v;
  }
  return out;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const args: Record<string, string> = {};
  for (const [k, v] of params) if (k !== 'v' && str(v)) args[k] = v;
  const view = await pluginView(request, params.get('v') ?? '', args);
  if (!view) return NextResponse.json({ error: 'No such view' }, { status: 404 });
  return jsonWithEtag(request, view);
}

export async function POST(request: Request) {
  let body: { act?: unknown; args?: unknown; fields?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const view = str(body?.act) ? await pluginAct(request, body.act, strings(body.args), strings(body.fields)) : null;
  if (!view) return NextResponse.json({ error: 'No such action' }, { status: 404 });
  return NextResponse.json(view);
}
