import { clanHealth } from '@/lib/clanHealth';
import { clanActivity } from '@/lib/clanHealthDb';
import { billingStatus } from '@/lib/clanBilling';
import { notFound } from 'next/navigation';

import { operatorEmail } from '@/lib/staffSight';
import { allClans } from '@/lib/platformView';
import { myLiveGrants } from '@/lib/actAs';
import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';
import { db } from '@/db';
import { clans as clansTable } from '@/db/schema';
import { foundViaLabel } from '@/lib/noticeRules';
import { count, desc, isNotNull } from 'drizzle-orm';
import ClansClient, { type ClanHealthRow } from './ClansClient';

export const dynamic = 'force-dynamic';

export default async function StaffClansPage() {
  // The layout gates this too; asked again here because this page decides what the operator may
  // DO, and that answer has to come from the same live read rather than from the shell's memory.
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();

  const [clans, activity, grants, sources] = await Promise.all([
    allClans(),
    clanActivity().catch(() => new Map()),
    myLiveGrants(actor.user.userId),
    // "Where did you find Anvil?" answers, most common first (asked on /clans/new).
    // clan-scope: global -- a platform-wide tally.
    db
      .select({ via: clansTable.foundVia, n: count() })
      .from(clansTable)
      .where(isNotNull(clansTable.foundVia))
      .groupBy(clansTable.foundVia)
      .orderBy(desc(count())),
  ]);

  // How each clan is doing (lib/clanHealth), judged here so the list can filter and sort by it.
  const now = Date.now();
  const health: Record<number, ClanHealthRow> = {};
  for (const c of clans) {
    const a = activity.get(c.id);
    const b = billingStatus(c, now);
    health[c.id] = {
      ...clanHealth(
        {
          createdAt: c.createdAt,
          members: c.members,
          memberCap: c.memberCap,
          plugin7d: a?.plugin7d ?? 0,
          pluginPrev7d: a?.pluginPrev7d ?? 0,
          eventsTotal: c.events + (a?.competitions ?? 0),
          running: a?.running ?? 0,
          scheduled: a?.scheduled ?? 0,
          lastActiveAt: a?.lastActiveAt ?? null,
          billing: b.state,
          billingDaysLeft: b.daysLeft,
        },
        now,
      ),
      plugin7d: a?.plugin7d ?? 0,
      lastActiveAt: a?.lastActiveAt ?? null,
      billing: b.state,
    };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Clans</h1>
      <p className="mt-1 text-sm text-gray-400">
        Lifecycle and entitlement only. A clan&rsquo;s events, roster and settings are the clan&rsquo;s
        — reaching those needs a grant in that clan, which this page does not confer.
      </p>
      {sources.length > 0 && (
        <p className="mt-3 text-xs text-text-dim">
          Found Anvil via:{' '}
          {sources.map((s, i) => (
            <span key={s.via ?? i} className="text-gray-300">
              {i ? ' · ' : ''}
              {foundViaLabel(s.via) ?? s.via} {s.n}
            </span>
          ))}
        </p>
      )}
      <div className="mt-6">
        <ClansClient
          health={health}
          // Owner and billing emails are whole for the top platform role only (lib/staffSight).
          clans={clans.map((c) => ({
            ...c,
            ownerEmail: operatorEmail(actor.role, c.ownerEmail),
            contactEmail: operatorEmail(actor.role, c.contactEmail),
          }))}
          canWrite={hasPlatformRole(actor.role, 'staff')} grants={grants} />
      </div>
    </div>
  );
}
