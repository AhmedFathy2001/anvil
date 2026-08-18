import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { getSetting, setSetting, deleteSetting } from '@/lib/settings';
import { verifyAdmin } from '@/lib/auth';
import defaultRates from '@/data/balanceRates.json';

// Admin-managed overrides for the board-balance effort model, stored as a SPARSE diff
// under the `balance_rates` settings key and merged over the curated defaults by
// mergeRates(). GET returns defaults + current overrides (the editor renders the merged
// view and diffs against defaults on save); PUT replaces the overrides after validation;
// DELETE restores the curated defaults.

const SETTING_KEY = 'balance_rates';
const FLOORS = new Set(['anyone', 'mid', 'high', 'elite']);

function cleanTriplet(v: unknown, opts: { max: number; ratio?: boolean }): [number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const nums = v.map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > opts.max)) return null;
  if (!opts.ratio && nums.some((n) => n <= 0)) return null;
  return nums as [number, number, number];
}

// Validate + strip an overrides payload down to exactly the fields the model reads.
// Invalid entries are dropped rather than erroring the whole save — the editor only
// sends what it changed, and a stray bad row shouldn't lose the rest.
function sanitize(raw: unknown): { skills: Record<string, unknown>; activities: Record<string, unknown> } {
  const out: { skills: Record<string, unknown>; activities: Record<string, unknown> } = { skills: {}, activities: {} };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;

  const skills = o.skills;
  if (skills && typeof skills === 'object') {
    for (const [key, val] of Object.entries(skills as Record<string, unknown>).slice(0, 50)) {
      if (!val || typeof val !== 'object' || key.length > 40) continue;
      const v = val as Record<string, unknown>;
      const xp = cleanTriplet(v.xpPerHour, { max: 20_000_000 });
      const floor = typeof v.floor === 'string' && FLOORS.has(v.floor) ? v.floor : undefined;
      if (xp) out.skills[key] = { xpPerHour: xp, ...(floor ? { floor } : {}) };
    }
  }

  const acts = o.activities;
  if (acts && typeof acts === 'object') {
    for (const [key, val] of Object.entries(acts as Record<string, unknown>).slice(0, 300)) {
      if (!val || typeof val !== 'object' || key.length > 60) continue;
      const v = val as Record<string, unknown>;
      const entry: Record<string, unknown> = {};
      const kill = cleanTriplet(v.killSeconds, { max: 86_400 });
      const attempt = cleanTriplet(v.attemptMinutes, { max: 1_440 });
      const success = cleanTriplet(v.successRate, { max: 1, ratio: true });
      if (kill) entry.killSeconds = kill;
      if (attempt && success) {
        entry.attemptMinutes = attempt;
        entry.successRate = success;
      }
      if (typeof v.floor === 'string' && FLOORS.has(v.floor)) entry.floor = v.floor;
      if (Object.keys(entry).length > 0) out.activities[key.trim().toLowerCase()] = entry;
    }
  }
  return out;
}

export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let overrides: unknown = null;
  const value = await getSetting(clan.id, SETTING_KEY);
  if (value) {
    try {
      overrides = JSON.parse(value);
    } catch {
      overrides = null;
    }
  }
  return NextResponse.json({ defaults: defaultRates, overrides });
}

export async function PUT(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: { overrides?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const clean = sanitize(body.overrides);
  const empty = Object.keys(clean.skills).length === 0 && Object.keys(clean.activities).length === 0;
  if (empty) {
    await deleteSetting(clan.id, SETTING_KEY);
    return NextResponse.json({ success: true, overrides: null });
  }
  await setSetting(clan.id, SETTING_KEY, JSON.stringify(clean));
  return NextResponse.json({ success: true, overrides: clean });
}

export async function DELETE() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await deleteSetting(clan.id, SETTING_KEY);
  return NextResponse.json({ success: true });
}
