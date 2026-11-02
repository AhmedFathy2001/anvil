'use client';

import { useRouter } from 'next/navigation';
import type { Submission, Tile } from '@/lib/types';
import ClanLink from '@/components/ClanLink';
import { ProofsToCheck } from '../events/[eventId]/EventNextStep';

export interface ProofBoard {
  eventId: number;
  name: string;
  submissions: Submission[];
  tiles: Tile[];
}

/** One "Proofs to check" list per board, refreshed from the server after each action. */
export default function ProofsClient({
  boards,
  teamNameById,
  browse,
}: {
  boards: ProofBoard[];
  teamNameById: Record<number, string>;
  /** Running and recently ended boards, for browsing every proof (flagged or not). */
  browse: { eventId: number; name: string }[];
}) {
  const router = useRouter();
  const all =
    browse.length > 0 ? (
      <div className="mt-10">
        <h2 className="display text-lg font-semibold mb-1">Browse every proof</h2>
        <p className="text-sm text-text-muted mb-3">Unflagged proofs count on their own. Open a board to skim them all, newest first.</p>
        <ul className="flex flex-wrap gap-2">
          {browse.map((b) => (
            <li key={b.eventId}>
              <ClanLink
                href={`/admin/proofs/${b.eventId}`}
                className="inline-block px-3 py-1.5 text-sm rounded-lg border border-card-border hover:border-gold/50 hover:text-gold transition-colors"
              >
                {b.name}
              </ClanLink>
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  if (boards.length === 0) {
    return (
      <>
        <div className="border border-dashed border-card-border rounded-xl p-8 text-center text-text-muted">
          All caught up. Anything the system isn&apos;t sure about shows up here.
        </div>
        {all}
      </>
    );
  }
  return (
    <div>
      <div className="space-y-10">
        {boards.map((b) => (
          <div key={b.eventId}>
            <h2 className="display text-xl font-semibold mb-2">{b.name}</h2>
            <ProofsToCheck
              eventId={b.eventId}
              submissions={b.submissions}
              tiles={b.tiles}
              teamNameById={teamNameById}
              onChange={() => router.refresh()}
              allHref={`/admin/proofs/${b.eventId}`}
            />
          </div>
        ))}
      </div>
      {all}
    </div>
  );
}
