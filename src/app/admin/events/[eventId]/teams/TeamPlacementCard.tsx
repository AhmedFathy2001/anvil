'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Event } from '@/lib/types';
import TeamPlacementFields from '@/components/TeamPlacementFields';
import { DEFAULT_AUTO_TEAM_COUNT, placementOf, type TeamPlacement } from '@/lib/teamPlacement';
import { clanFetch } from '@/lib/clanFetch';

/**
 * Team placement, changed on the Teams page where the teams live. Same fields component and same
 * PATCH the Sign-ups settings card uses (that card keeps working too).
 */
export default function TeamPlacementCard({ event, disabled }: { event: Event; disabled?: boolean }) {
  const router = useRouter();
  const stored = placementOf(event);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<TeamPlacement>(stored);
  const [teamCount, setTeamCount] = useState(event.teamCount ?? DEFAULT_AUTO_TEAM_COUNT);
  const [teamCap, setTeamCap] = useState(event.teamCap ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await clanFetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamPlacement: placement,
          ...(placement === 'auto' ? { teamCount } : {}),
          ...(placement === 'pick' ? { teamCap: teamCap > 0 ? teamCap : null } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not save team placement.');
      }
      setSaved(true);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save team placement.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} disabled={disabled} className="text-gold hover:underline disabled:opacity-50">
          Change team placement
        </button>
        {saved && <span className="text-xs text-green-400">Saved</span>}
      </span>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <TeamPlacementFields
        placement={placement}
        onPlacementChange={setPlacement}
        teamCount={teamCount}
        onTeamCountChange={setTeamCount}
        teamCap={teamCap}
        onTeamCapChange={setTeamCap}
      />
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className="bg-gold text-brown-dark font-semibold rounded-lg px-4 py-1.5 text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Save placement'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-text-muted hover:text-foreground px-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
