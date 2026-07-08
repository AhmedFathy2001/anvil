'use client';

import { Fragment, useState } from 'react';
import type { SignupProfile } from '@/lib/signup';
import PlayerProfileDetail, { hasProfileDetail } from '@/components/PlayerProfileDetail';

interface Player {
  id: number;
  eventId: number;
  name: string;
  teamId: number | null;
  pickNumber: number | null;
  pickedAt: string | null;
  timezone?: string | null;
  profile?: SignupProfile | null;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

interface Props {
  players: Player[];
  teams: Team[];
  interactive: boolean;
  onPick?: (playerId: number) => void;
  onPlayerClick?: (rsn: string) => void;
  picking?: boolean;
}

export default function DraftPlayerPool({ players, teams, interactive, onPick, onPlayerClick, picking }: Props) {
  const poolPlayers = players.filter((p) => p.teamId === null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (poolPlayers.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-card-border rounded-xl">
        <p className="text-text-muted">Player pool is empty.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {poolPlayers.map((player) => {
        const tz = player.timezone ?? player.profile?.timezone ?? null;
        const canExpand = hasProfileDetail(player.profile);
        const isExpanded = expanded.has(player.id);
        return (
          <Fragment key={player.id}>
            <div
              className={`border rounded-xl p-3 text-center transition-all ${
                interactive
                  ? 'border-gold/40 bg-card-bg'
                  : 'border-card-border bg-card-bg'
              } ${picking ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {onPlayerClick ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPlayerClick(player.name); }}
                    className="font-medium text-sm text-gold hover:text-gold-light transition-colors underline decoration-gold/30 underline-offset-2"
                    title="View Hiscores"
                  >
                    {player.name}
                  </button>
                ) : (
                  <span className="font-medium text-sm">{player.name}</span>
                )}
                {tz && (
                  <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{tz}</span>
                )}
              </div>
              {canExpand && (
                <button
                  onClick={() => toggle(player.id)}
                  className="mt-1 text-[10px] text-text-muted hover:text-gold transition-colors"
                  title="Sign-up answers"
                >
                  Answers {isExpanded ? '▾' : '▸'}
                </button>
              )}
              {interactive && (
                <button
                  disabled={picking}
                  onClick={() => onPick?.(player.id)}
                  className="block w-full mt-1.5 text-xs font-medium bg-gold/10 text-gold border border-gold/20 px-2 py-1 rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-50"
                >
                  Pick
                </button>
              )}
            </div>
            {canExpand && isExpanded && player.profile && (
              <div className="col-span-full border border-card-border rounded-xl p-3 bg-brown-dark/40">
                <div className="text-xs font-medium text-foreground/80 mb-2">
                  {player.name} — sign-up answers
                </div>
                <PlayerProfileDetail profile={player.profile} />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
