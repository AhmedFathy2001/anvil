'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PlayerStatsPanel from '@/components/PlayerStatsPanel';
import { BOSSES, SKILL_LABELS } from '@/lib/constants';
import type { SignupProfile } from '@/lib/signup';

interface Applicant {
  id: number;
  status: string;
  signedUpAt: string;
  profile: SignupProfile;
  displayName: string;
  discordUsername: string | null;
  rsn: string;
}

const BOSS_LABEL: Record<string, string> = Object.fromEntries(
  BOSSES.map((b) => [b.key, b.label]),
);

// Captains review applicants before drafting — withdrawn/rejected entries are kept
// visible (greyed) so it's clear who dropped, but the active pool is what matters.
export default function ApplicantsClient({ teamId }: { teamId: number }) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsRsn, setStatsRsn] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/${teamId}/applicants`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load applicants');
      }
      const data = await res.json();
      setApplicants(data.applicants ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const { active, inactive } = useMemo(() => {
    const isActive = (a: Applicant) => a.status === 'pending' || a.status === 'approved';
    return {
      active: applicants.filter(isActive),
      inactive: applicants.filter((a) => !isActive(a)),
    };
  }, [applicants]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return <div className="text-center py-12 text-text-muted">Loading…</div>;
  }
  if (error) {
    return (
      <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg p-3">
        {error}
      </div>
    );
  }
  if (applicants.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-card-border rounded-xl text-text-muted">
        No sign-ups yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title={`Active (${active.length})`}
        items={active}
        expanded={expanded}
        onToggle={toggle}
        onViewStats={setStatsRsn}
      />
      {inactive.length > 0 && (
        <Section
          title={`Withdrawn / rejected (${inactive.length})`}
          items={inactive}
          expanded={expanded}
          onToggle={toggle}
          onViewStats={setStatsRsn}
          muted
        />
      )}

      {statsRsn && (
        <PlayerStatsPanel rsn={statsRsn} onClose={() => setStatsRsn(null)} />
      )}
    </div>
  );
}

function Section({
  title,
  items,
  expanded,
  onToggle,
  onViewStats,
  muted,
}: {
  title: string;
  items: Applicant[];
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onViewStats: (rsn: string) => void;
  muted?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div>
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-gold rounded-full" />
          {title}
        </h2>
        <div className="text-center py-8 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
          Nobody in the pool yet.
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="font-semibold flex items-center gap-2 mb-3">
        <span className={`w-1 h-5 rounded-full ${muted ? 'bg-text-muted' : 'bg-gold'}`} />
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((a) => {
          const isExpanded = expanded.has(a.id);
          return (
            <div
              key={a.id}
              className={`border border-card-border rounded-lg bg-brown-dark/40 ${muted ? 'opacity-60' : ''}`}
            >
              <button
                onClick={() => onToggle(a.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-brown-dark transition-colors text-left"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {a.displayName}
                    <span className="text-text-muted text-xs ml-2">playing {a.rsn}</span>
                  </div>
                  {a.discordUsername && (
                    <div className="text-xs text-text-muted truncate">@{a.discordUsername}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={a.status} />
                  <span className="text-xs text-text-muted">{isExpanded ? '▾' : '▸'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-card-border space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <Stat label="Daily hours" value={a.profile.dailyHours} />
                    <Stat label="Weekly hours" value={a.profile.weeklyHours} />
                    <Stat
                      label="Submitted"
                      value={new Date(a.signedUpAt).toLocaleDateString()}
                      plain
                    />
                  </div>

                  {a.profile.bosses && a.profile.bosses.length > 0 && (
                    <ChipList
                      label="Bosses"
                      items={a.profile.bosses.map((k) => BOSS_LABEL[k] ?? k)}
                    />
                  )}
                  {a.profile.skills && a.profile.skills.length > 0 && (
                    <ChipList
                      label="Skills"
                      items={a.profile.skills.map((k) => SKILL_LABELS[k] ?? k)}
                    />
                  )}
                  {a.profile.notes && (
                    <div>
                      <div className="text-xs text-text-muted mb-1">Notes</div>
                      <p className="text-sm whitespace-pre-wrap text-foreground/90">
                        {a.profile.notes}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-card-border pt-3">
                    <button
                      onClick={() => onViewStats(a.rsn)}
                      className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
                    >
                      View stats
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  plain,
}: {
  label: string;
  value: number | string | undefined;
  plain?: boolean;
}) {
  return (
    <div>
      <div className="text-text-muted uppercase tracking-wide">{label}</div>
      <div className={`mt-0.5 ${plain ? 'text-foreground' : 'text-gold font-medium'}`}>
        {value === undefined || value === '' ? '—' : value}
      </div>
    </div>
  );
}

function ChipList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span key={it} className="text-[11px] px-1.5 py-0.5 rounded bg-gold/10 text-gold">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-text-muted/15 text-text-muted border-text-muted/25',
    approved: 'bg-accent-green/15 text-accent-green-light border-accent-green/25',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
    withdrawn: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  };
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${map[status] ?? map.pending}`}
    >
      {status}
    </span>
  );
}
