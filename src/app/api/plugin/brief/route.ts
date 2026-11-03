import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { GET as configRoute } from '@/app/api/plugin/config/route';
import { GET as weeklyRoute } from '@/app/api/plugin/weekly-leaderboard/route';
import { db } from '@/db';
import { clans } from '@/db/schema';
import { type BriefFacts, composeBrief } from '@/lib/chatBrief';
import { getChatFeedPrefs } from '@/lib/chatFeed';
import { effectiveBrief, effectiveLook } from '@/lib/chatLook';
import { listClanEvents } from '@/lib/clanEvents';
import { goalsWithProgress } from '@/lib/goals';
import { playedCharacter, resolvePluginCharacter } from '@/lib/pluginAccount';
import { pluginRoster } from '@/lib/pluginRoster';
import type { HomeConfig } from '@/lib/pluginUi/homeUi';
import { rateLimitByKey } from '@/lib/rate-limit';
import { supporterForUser } from '@/lib/supporter';

export const dynamic = 'force-dynamic';

// GET /api/plugin/brief — what the plugin prints once per login (lib/chatBrief), and the palette it
// colours every Anvil chat line with (lib/chatLook) until the next one. Built from the same answers
// the Clan tab is (the config and weekly routes, for this caller), so the two never disagree.

const nearlyDone = (t: { complete: boolean; current: number; goal: number }) =>
  !t.complete && t.goal > 1 && t.current < t.goal && t.current / t.goal >= 0.75;

export async function GET(request: Request) {
  const who = await resolvePluginCharacter(request);
  if (!who) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await rateLimitByKey('brief', String(who.accountId), { limit: 10, windowMs: 10 * 60_000 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many' }, { status: 429 });

  const [prefs, supporter] = await Promise.all([getChatFeedPrefs(who.userId), supporterForUser(who.userId).catch(() => null)]);
  const tier = supporter?.tier.id ?? null;
  const look = effectiveLook(prefs, tier);
  if (!prefs.login) return NextResponse.json({ lines: [], look });

  const items = effectiveBrief(prefs, tier);
  const facts: BriefFacts = { bingo: null, weeklies: [], clanEvents: [], goal: null };
  const now = Date.now();
  const me = playedCharacter(request);

  const res = await configRoute(request);
  const cfg = res.ok ? ((await res.json()) as HomeConfig & { event?: { startDate: string | null; endDate: string | null; forceEndedAt?: string | null } | null }) : null;

  const ev = cfg?.event;
  const at = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
  const live = !!ev && !ev.forceEndedAt && !(at(ev.startDate) > now) && !(at(ev.endDate) <= now);
  if (live && ev && (items.includes('bingo') || items.includes('tiles'))) {
    const roster = await pluginRoster(request, ev.id, { query: '', team: null, page: 1, pageSize: 50 }).catch(() => null);
    const teams = roster && roster.mode === 'teams' ? roster.teams : [];
    const mine = teams.find((t) => t.yours) ?? null;
    const flat = (cfg?.panel?.tiles ?? []).flatMap((t) => [t, ...(t.parts ?? [])]);
    facts.bingo = {
      name: ev.name,
      rank: mine?.rank ?? null,
      teams: teams.length,
      nearly: flat.filter(nearlyDone).map((t) => t.label),
    };
  }

  if (items.includes('weekly')) {
    const liveWeeklies = (cfg?.panel?.weeklies ?? []).filter((w) => w.status === 'active').slice(0, 2);
    facts.weeklies = await Promise.all(
      liveWeeklies.map(async (w) => {
        const url = new URL(request.url);
        url.pathname = '/api/plugin/weekly-leaderboard';
        url.search = `?id=${w.id}${me ? `&rsn=${encodeURIComponent(me.rsn)}` : ''}`;
        const r = await weeklyRoute(new Request(url, { headers: request.headers }));
        type Row = { rank: number; gained: number };
        const b = r.ok ? ((await r.json()) as { entries?: Row[]; you?: Row | null }) : null;
        const you = b?.you ?? null;
        const ahead = you && you.rank > 1 ? (b?.entries ?? []).find((e) => e.rank === you.rank - 1)?.gained ?? null : null;
        const kind = w.type === 'skill' ? 'SOTW' : w.type === 'efficiency' ? 'EOTW' : 'BOTW';
        return {
          label: `${kind} ${w.metricLabel}`,
          unit: w.type === 'skill' ? ('XP' as const) : w.type === 'efficiency' ? ('h' as const) : ('KC' as const),
          rank: you?.rank ?? null,
          gained: you?.gained ?? 0,
          ahead,
        };
      }),
    );
  }

  if (items.includes('clanEvents') && cfg?.activeClan?.slug) {
    // clan-scope: global -- the clan this caller's own config named.
    const clan = await db.query.clans.findFirst({ where: eq(clans.slug, cfg.activeClan.slug), columns: { id: true } });
    if (clan) {
      const list = await listClanEvents(clan.id, { userId: who.userId, now, withinDays: 1 });
      facts.clanEvents = list.map((e) => ({ title: e.title, startsInMin: Math.round((Date.parse(e.occurrence.start) - now) / 60_000) }));
    }
  }

  if (items.includes('goals') && me) {
    const goals = await goalsWithProgress(who.accountId, me.rsn).catch(() => []);
    const best = goals
      .filter((g) => !g.done && g.current != null && g.of > 0)
      .map((g) => ({ text: g.label, pct: ((g.current as number) / g.of) * 100 }))
      .sort((a, b) => b.pct - a.pct)[0];
    facts.goal = best ?? null;
  }

  return NextResponse.json({ lines: composeBrief(items, facts), look });
}
