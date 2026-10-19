'use client';

import { useRouter } from 'next/navigation';
import type { Submission, Tile } from '@/lib/types';
import { ProofsToCheck } from '../events/[eventId]/EventNextStep';

export interface ProofBoard {
  eventId: number;
  name: string;
  submissions: Submission[];
  tiles: Tile[];
}

/** One "Proofs to check" list per board, refreshed from the server after each action. */
export default function ProofsClient({ boards, teamNameById }: { boards: ProofBoard[]; teamNameById: Record<number, string> }) {
  const router = useRouter();
  if (boards.length === 0) {
    return (
      <div className="border border-dashed border-card-border rounded-xl p-8 text-center text-text-muted">
        All caught up. Anything the system isn&apos;t sure about shows up here.
      </div>
    );
  }
  return (
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
          />
        </div>
      ))}
    </div>
  );
}
