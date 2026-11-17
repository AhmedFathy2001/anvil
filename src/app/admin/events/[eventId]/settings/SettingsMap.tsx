'use client';

import ClanLink from '@/components/ClanLink';
import { settingsMap, type MapFacts } from '@/lib/eventSettingsMap';
import type { SettingsKind } from '@/lib/eventSettingsTabs';

/**
 * Every setting of this event and what it is set to now, each a link to the setting. Read-only: the
 * settings keep their own tabs and anchors. Dates are formatted here, in the viewer's own time zone.
 */
export default function SettingsMap({ eventId, kind, facts }: { eventId: number; kind: SettingsKind; facts: Omit<MapFacts, 'fmtDate'> }) {
  const groups = settingsMap(eventId, kind, { ...facts, fmtDate: (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) });
  return (
    <section id="map" className="scroll-mt-28 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        All settings at a glance
      </h2>
      <p className="mb-4 mt-1 text-sm text-text-muted">What each setting is now. Click one to change it.</p>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className="min-w-0">
            <h3 className="text-sm font-semibold">
              <ClanLink href={g.href} className="hover:text-gold">{g.label}</ClanLink>
            </h3>
            <p className="mb-1 text-xs text-text-muted">{g.blurb}</p>
            <ul className="divide-y divide-card-border/50">
              {g.rows.map((r) => (
                <li key={r.id}>
                  <ClanLink href={r.href} className="flex items-baseline justify-between gap-3 py-1.5 text-sm hover:text-gold">
                    <span className="min-w-0 truncate">{r.label}</span>
                    {r.value && (
                      <span className="shrink-0 text-right text-xs text-text-muted" suppressHydrationWarning>
                        {r.value}
                      </span>
                    )}
                  </ClanLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
