import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, gearOverrides } from '@/db/schema';
import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { effectiveGear, invalidateGear, monsterKeyOf } from '@/lib/dps/store';
import { sanitizeItemPatch, sanitizeMonsterPatch } from '@/lib/dps/overrides';
import { sanitizeRule } from '@/lib/dps/effects';

type Kind = 'item' | 'monster' | 'effect';
const KINDS = new Set<Kind>(['item', 'monster', 'effect']);

// PUT — add or change an item, monster or effect rule; or hide/unhide one.
//   { kind: 'item', key: '<item id>', data: {…partial item}, hidden?, note? }
//   { kind: 'monster', key: 'Name#Version' (or omit to add, with data.n/v), data, hidden?, note? }
//   { kind: 'effect', key?: '<rule id>', data: {…EffectRule} }
export async function PUT(request: Request) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { kind?: Kind; key?: string; data?: unknown; hidden?: boolean; note?: string } | null;
  if (!body || !body.kind || !KINDS.has(body.kind)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const { data: current } = await effectiveGear();
  let key = String(body.key ?? '').trim();
  let data: Record<string, unknown> = {};
  try {
    if (body.kind === 'item') {
      const id = Number(key);
      if (!Number.isInteger(id) || id <= 0) throw new Error('Items are keyed by their game item id.');
      // Known already (from the dataset or an earlier addition): a partial patch will do.
      const exists = current.items.some((i) => i.id === id);
      data = body.data === undefined ? {} : sanitizeItemPatch(body.data, !exists);
    } else if (body.kind === 'monster') {
      const exists = key ? current.monsters.some((m) => monsterKeyOf(m) === key) : false;
      const patch = body.data === undefined ? {} : sanitizeMonsterPatch(body.data, !exists);
      if (!exists) key = monsterKeyOf({ n: patch.n!, v: patch.v });
      data = patch;
    } else {
      key ||= crypto.randomUUID().slice(0, 8);
      data = sanitizeRule(body.data, key) as unknown as Record<string, unknown>;
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  const at = new Date().toISOString();
  const prior = await db.query.gearOverrides.findFirst({ where: and(eq(gearOverrides.kind, body.kind), eq(gearOverrides.key, key)) });
  await db
    .insert(gearOverrides)
    .values({ kind: body.kind, key, data, hidden: body.hidden === true, note: body.note?.slice(0, 200) ?? null, updatedByUserId: gate.actor.user.userId, updatedAt: at })
    .onConflictDoUpdate({
      target: [gearOverrides.kind, gearOverrides.key],
      set: {
        // Merge onto the earlier override, so hiding an item doesn't forget a stat fix made before.
        data: { ...((prior?.data as Record<string, unknown>) ?? {}), ...data },
        hidden: body.hidden ?? prior?.hidden ?? false,
        note: body.note?.slice(0, 200) ?? prior?.note ?? null,
        updatedByUserId: gate.actor.user.userId,
        updatedAt: at,
      },
    });
  await db
    .insert(clanAuditLog)
    .values({ clanId: null, eventType: 'gear_override_changed', actorUserId: gate.actor.user.userId, newValue: JSON.stringify({ kind: body.kind, key, hidden: body.hidden, data }) })
    .catch(() => {});
  invalidateGear();
  return NextResponse.json({ ok: true, key });
}

// DELETE ?kind=&key= — revert to the dataset (or remove an added entry / a rule).
export async function DELETE(request: Request) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  const u = new URL(request.url);
  const kind = u.searchParams.get('kind') as Kind | null;
  const key = u.searchParams.get('key');
  if (!kind || !KINDS.has(kind) || !key) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  await db.delete(gearOverrides).where(and(eq(gearOverrides.kind, kind), eq(gearOverrides.key, key)));
  await db
    .insert(clanAuditLog)
    .values({ clanId: null, eventType: 'gear_override_reverted', actorUserId: gate.actor.user.userId, newValue: JSON.stringify({ kind, key }) })
    .catch(() => {});
  invalidateGear();
  return NextResponse.json({ ok: true });
}
