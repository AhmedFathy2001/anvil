import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { getSettingMap } from '@/lib/settings';
import { IDENTITY_KEYS, getBotIdentity, saveBotIdentity, type IdentityMode } from '@/lib/discordIdentity';

// How the bot looks in this clan's Discord server (lib/discordIdentity).
export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [s, effective] = await Promise.all([getSettingMap(clan.id, Object.values(IDENTITY_KEYS)), getBotIdentity(clan.id)]);
  return NextResponse.json({
    mode: (s.get(IDENTITY_KEYS.mode) as IdentityMode) || 'anvil',
    name: s.get(IDENTITY_KEYS.name) ?? '',
    avatarUrl: s.get(IDENTITY_KEYS.avatar) ?? '',
    effective,
    clan: { name: clan.name, logoUrl: clan.logoUrl },
  });
}

// PUT — { mode: 'anvil' | 'clan' | 'custom', name?, avatarUrl? }: save and apply to the server now.
export async function PUT(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { mode?: IdentityMode; name?: string; avatarUrl?: string } | null;
  if (!body?.mode) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const r = await saveBotIdentity(clan.id, { mode: body.mode, name: body.name, avatarUrl: body.avatarUrl });
  // Saved either way; `applied: false` means Discord refused and says why (e.g. a missing permission).
  return NextResponse.json({ saved: true, applied: r.ok, error: r.error ?? null });
}
