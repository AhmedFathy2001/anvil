import ClanLink from '@/components/ClanLink';
import type { MyClan } from '@/lib/myClans';

/** The clans a profile has a tab for: those with a seat, member clans first, then by name. */
export function profileClans(clans: MyClan[]): MyClan[] {
  return clans
    .filter((c) => c.seat)
    .sort((a, b) => (a.seat === b.seat ? a.name.localeCompare(b.name) : a.seat === 'member' ? -1 : 1));
}

/**
 * One profile, a tab per clan. The locker is assembled per clan (boards, teams, this week), so each
 * tab is that clan's /c/<slug>/profile; "Everywhere" is the apex view of the person. Opening the
 * profile from inside a clan lands on that clan's tab, and opening it on the apex lands on the home
 * clan (app/profile/page.tsx) — so it is always one page, whichever door you came in by.
 */
export default function ProfileTabs({ clans, current }: { clans: MyClan[]; current: string | null }) {
  const tabs = profileClans(clans);
  if (tabs.length === 0) return null;
  const tab = (active: boolean) =>
    `-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-[14px] transition-colors ${
      active ? 'border-gold text-foreground' : 'border-transparent text-text-muted hover:text-foreground'
    }`;
  return (
    <nav aria-label="Your clans" className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-card-border">
      {tabs.map((c) => (
        <ClanLink key={c.id} href={`/c/${c.slug}/profile`} className={tab(current === c.slug)} aria-current={current === c.slug ? 'page' : undefined}>
          {c.name}
          <span
            className={`rounded-full border px-1.5 text-[10.5px] ${
              c.seat === 'member' ? 'border-gold-dark text-gold' : 'border-card-border text-text-muted'
            }`}
          >
            {c.seat === 'member' ? 'member' : c.clanKind === 'creator' ? 'player' : 'guest'}
          </span>
        </ClanLink>
      ))}
      {/* A raw anchor: ClanLink would prefix /profile back into the current clan. Leaving the clan for
          the person view is the point of this tab. */}
      {/* eslint-disable-next-line clan-scope/clan-prefix -- intentional apex link out of the clan locker */}
      <a href="/profile?everywhere=1" className={tab(current === null)} aria-current={current === null ? 'page' : undefined}>
        Everywhere
      </a>
    </nav>
  );
}

/** The way into settings, beside the name on every tab. */
export function SettingsButton() {
  return (
    <ClanLink
      href="/settings"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-gold/40 hover:text-gold-light"
    >
      <span aria-hidden>⚙</span> Settings
    </ClanLink>
  );
}
