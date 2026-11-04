'use client';

import SettingsCard from './settings/SettingsCard';
import { useSaveBar } from './settings/SaveBar';
import { Segmented } from './settings/controls';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DateTimePicker from '@/components/DateTimePicker';
import { parseEventRules, type StandingsVisibility } from '@/lib/eventRules';
import { standingsHidden, standingsRevealAt } from '@/lib/standingsVisibility';
import { clanFetch } from '@/lib/clanFetch';
import type { Event } from '@/lib/types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Standings: Live / Hidden until the event ends / Hidden until a date (lib/standingsVisibility).
 *
 * Changeable at any time, mid-event included: the curtain is read on every request, so switching it
 * takes effect on the next page load or plugin poll. Staff always see everything, so this panel
 * says what PLAYERS see. It saves only its own rules key — the API merges it over the rest.
 */
export default function StandingsVisibilityPanel({ event }: { event: Event }) {
  const router = useRouter();
  const stored = parseEventRules(event.rules).standings;
  const [visibility, setVisibility] = useState<StandingsVisibility>(stored.visibility);
  const [revealAt, setRevealAt] = useState(stored.revealAt ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const endMs = event.endDate ? Date.parse(event.endDate) : NaN;
  const finalWeek = Number.isFinite(endMs) ? new Date(endMs - WEEK_MS).toISOString() : null;
  const dirty = visibility !== stored.visibility || (visibility === 'at-date' && revealAt !== (stored.revealAt ?? ''));
  // One save bar per settings tab (settings/SaveBar); its own Save button only outside one.
  const inBar = useSaveBar('standings', 'Standings', dirty, () => save(), () => {
    setVisibility(stored.visibility);
    setRevealAt(stored.revealAt ?? '');
  });

  // What players see right now, from the SAVED rule.
  const savedEvent = { rules: event.rules ?? null, endDate: event.endDate ?? null, forceEndedAt: event.forceEndedAt ?? null };
  const hiddenNow = standingsHidden(savedEvent);
  const liftsAt = standingsRevealAt(savedEvent);

  async function save(): Promise<boolean> {
    if (visibility === 'at-date' && !revealAt) {
      setMsg({ type: 'error', text: 'Pick when the standings come back.' });
      return false;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await clanFetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: {
            // null clears the key: live is the default and stores nothing.
            standings: visibility === 'live' ? null : { visibility, revealAt: visibility === 'at-date' ? revealAt : null },
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'Could not save the standings setting.' });
        return false;
      }
      setMsg({ type: 'success', text: 'Saved.' });
      router.refresh();
      return true;
    } catch {
      setMsg({ type: 'error', text: 'Could not save the standings setting.' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function pick(value: StandingsVisibility) {
    setVisibility(value);
    setMsg(null);
    if (value === 'at-date' && !revealAt && finalWeek) setRevealAt(finalWeek);
  }

  return (
    <SettingsCard
      title="Standings"
      description={<>Who can see the race. While hidden, players see only their own team&apos;s progress; staff see everything and shared Discord channels pause.</>}
    >

      <Segmented
        label="Standings"
        value={visibility}
        onChange={pick}
        options={[
          { value: 'live', label: 'Live', hint: 'Everyone sees the race as it happens.' },
          { value: 'at-end', label: 'Hidden until the end', hint: 'Revealed the moment the event ends.' },
          { value: 'at-date', label: 'Hidden until a date', hint: 'Revealed at the time you pick.' },
        ]}
      />
      {visibility === 'at-date' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="w-64 max-w-full">
            <DateTimePicker
              value={revealAt}
              onChange={(value) => {
                setRevealAt(value);
                setMsg(null);
              }}
              placeholder="When the standings come back"
              ariaLabel="Standings reveal date and time"
            />
          </div>
          {finalWeek && (
            <button
              type="button"
              onClick={() => {
                setRevealAt(finalWeek);
                setMsg(null);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
              title="Seven days before the event ends"
            >
              Final week
            </button>
          )}
        </div>
      )}

      {(!inBar || msg) && (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!inBar && (
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        {msg && <span className={`text-xs ${msg.type === 'error' ? 'text-red-400' : 'text-accent-green-light'}`}>{msg.text}</span>}
        {!msg && stored.visibility !== 'live' && (
          <span className="text-xs text-text-muted" suppressHydrationWarning>
            {hiddenNow
              ? liftsAt
                ? `Hidden from players until ${new Date(liftsAt).toLocaleString()}.`
                : 'Hidden from players until the event ends.'
              : 'Revealed — everyone can see the standings now.'}
          </span>
        )}
      </div>
      )}
    </SettingsCard>
  );
}
