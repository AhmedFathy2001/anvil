import { requireClan } from '@/lib/clanContext';
import { getClanDisplayName } from '@/lib/pluginConfig';
import EventForm from '@/components/EventForm';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

/**
 * Schedule a competition.
 *
 * WHAT THIS PAGE USED TO BE. A second events product: its own list of competitions (which
 * /admin/events already shows, weeklies merged in), its own create form (which /admin/events/new
 * already is — it posts to the same endpoint the moment a weekly kind is picked), and its own
 * inline participants panel with its own refresh and re-baseline buttons (which the competition's
 * workspace already owns, at /admin/events/weekly/<id>). Three surfaces, all superseded, still
 * carrying a top-level nav group of their own called "Weekly" so the admin area appeared to hold
 * two kinds of event that were managed in two different places.
 *
 * WHY IT STILL EXISTS AT ALL. A moderator may schedule a competition and may not create a board,
 * and lib/adminAccess draws that line by PATH — /admin/weekly is moderator-tier, /admin/events is
 * not. Deleting the route would quietly take a capability away from every moderator on the
 * platform. So the route stays and everything duplicated behind it goes: this is the same
 * EventForm the new-event page renders, showing only the competitions.
 *
 * Editing and deleting an existing competition moved to its own workspace, next to its roster and
 * its baselines — the same place a board keeps its Settings tab.
 */
export default async function NewCompetitionPage() {
  const clan = await requireClan();
  const clanName = await getClanDisplayName(clan.id, '');

  return (
    <div>
      <ClanLink
        href="/admin/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-gold"
      >
        &larr; All events
      </ClanLink>

      <header className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-gold sm:text-3xl">Schedule a competition</h1>
        <p className="text-sm text-text-muted">
          Skill, Boss or Efficiency of the Week. The whole roster is entered automatically — there is
          nothing to author and nobody to draft.
        </p>
      </header>

      <div className="max-w-4xl rounded-xl border border-card-border bg-card-bg p-6 shadow-lg shadow-black/20">
        {/* Prizes are set on the competition itself once it exists, from its own workspace — that is
            a treasurer's decision and it is the only place the coffer balance is in front of you. */}
        <EventForm weeklyOnly suggestedName={clanName ? `${clanName} SOTW` : ''} />
      </div>
    </div>
  );
}
