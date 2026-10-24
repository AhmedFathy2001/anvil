import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { labScenarios } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { checkScenario } from '@/lib/labScenarios';
import SCENARIO_TEMPLATES from '@/data/labScenarioTemplates.json';

// /api/staff/lab/scenarios — the replay scripts the dev client pulls with `::anvil sync`
// (GET /api/plugin/lab/scenarios). PUT upserts by name; DELETE ?name= removes one.

export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const rows = await db.select().from(labScenarios).orderBy(asc(labScenarios.name));
  return NextResponse.json({ scenarios: rows, templates: SCENARIO_TEMPLATES });
}

export async function PUT(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  let body: { name?: unknown; description?: unknown; params?: unknown; steps?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const problems = checkScenario(name, body.steps, body.params);
  if (problems.length) return NextResponse.json({ error: problems.join(' ') }, { status: 400 });
  const description = typeof body.description === 'string' ? body.description.slice(0, 500) : '';
  const set = {
    description,
    params: (body.params ?? {}) as Record<string, string>,
    steps: body.steps as unknown[],
    updatedBy: gate.actor.user.userId,
    updatedAt: new Date().toISOString(),
  };
  await db.insert(labScenarios).values({ name, ...set }).onConflictDoUpdate({ target: labScenarios.name, set });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const name = new URL(request.url).searchParams.get('name')?.trim();
  if (!name) return NextResponse.json({ error: 'name' }, { status: 400 });
  await db.delete(labScenarios).where(eq(labScenarios.name, name));
  return NextResponse.json({ ok: true });
}
