'use client';

import { Fragment, useMemo, useState } from 'react';
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
  // Owner (site user) — multi-account: a person's accounts share this so the pool groups them into
  // one draftable card. Null for guests (no linked user) → their own solo card.
  ownerUserId?: number | null;
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

  // Group the pool by owner so a person's several accounts show as ONE draftable card — picking any
  // one drafts them all (the server assigns the whole group to the team). Guests (no owner) stay solo.
  const groups = useMemo(() => {
    const byOwner = new Map<string, Player[]>();
    for (const p of poolPlayers) {
      const key = p.ownerUserId != null ? `u${p.ownerUserId}` : `p${p.id}`;
      const arr = byOwner.get(key);
      if (arr) arr.push(p);
      else byOwner.set(key, [p]);
    }
    return [...byOwner.entries()].map(([key, members]) => ({ key, members }));
  }, [poolPlayers]);

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
      {groups.map((group) => {
        const rep = group.members[0];
        const multi = group.members.length > 1;
        // Profile lives on the person's primary account; any group member may carry it (backfilled).
        const profileMember = group.members.find((m) => hasProfileDetail(m.profile)) ?? rep;
        const tz = profileMember.timezone ?? profileMember.profile?.timezone ?? null;
        const canExpand = hasProfileDetail(profileMember.profile);
        const isExpanded = expanded.has(rep.id);
        return (
          <Fragment key={group.key}>
            <div
              className={`border rounded-xl p-3 text-center transition-all ${
                interactive
                  ? 'border-gold/40 bg-card-bg'
                  : 'border-card-border bg-card-bg'
              } ${picking ? 'opacity-50' : ''}`}
            >
              <div className="flex flex-col items-center gap-0.5">
                {group.members.map((m, i) => (
                  <div key={m.id} className="flex items-center justify-center gap-1.5 flex-wrap">
                    {onPlayerClick ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onPlayerClick(m.name); }}
                        className="font-medium text-sm text-gold hover:text-gold-light transition-colors underline decoration-gold/30 underline-offset-2"
                        title="View Hiscores"
                      >
                        {m.name}
                      </button>
                    ) : (
                      <span className="font-medium text-sm">{m.name}</span>
                    )}
                    {i === 0 && tz && (
                      <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{tz}</span>
                    )}
                  </div>
                ))}
              </div>
              {multi && (
                <div className="mt-0.5 text-[10px] text-text-muted">{group.members.length} accounts · drafted together</div>
              )}
              {canExpand && (
                <button
                  onClick={() => toggle(rep.id)}
                  className="mt-1 text-[10px] text-text-muted hover:text-gold transition-colors"
                  title="Sign-up answers"
                >
                  Answers {isExpanded ? '▾' : '▸'}
                </button>
              )}
              {interactive && (
                <button
                  disabled={picking}
                  onClick={() => onPick?.(rep.id)}
                  className="block w-full mt-1.5 text-xs font-medium bg-gold/10 text-gold border border-gold/20 px-2 py-1 rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-50"
                >
                  {multi ? 'Pick all' : 'Pick'}
                </button>
              )}
            </div>
            {canExpand && isExpanded && profileMember.profile && (
              <div className="col-span-full border border-card-border rounded-xl p-3 bg-brown-dark/40">
                <div className="text-xs font-medium text-foreground/80 mb-2">
                  {profileMember.name} — sign-up answers
                </div>
                <PlayerProfileDetail profile={profileMember.profile} />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
