'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';

/**
 * The board's in-game chat feed switch (lib/chatFeed). Saves on toggle, like the clan's settings.
 */
export default function EventChatFeedCard({ eventId }: { eventId: number }) {
  const [state, setState] = useState<{ chatFeed: boolean; standingsHidden: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clanFetch(`/api/admin/events/${eventId}/chat-feed`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setState(d))
      .catch(() => setError('Could not load'));
  }, [eventId]);

  async function save(next: boolean) {
    if (!state) return;
    const before = state;
    setState({ ...state, chatFeed: next });
    setSaving(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/chat-feed`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatFeed: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save');
      setState(await res.json());
    } catch (err) {
      setState(before);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-card-border bg-card-bg p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-gold" />
        <h2 className="text-base font-semibold text-foreground">In-game chat feed</h2>
      </div>
      {state ? (
        <Checkbox
          checked={state.chatFeed}
          disabled={saving}
          onChange={save}
          label="Show every team's drops and tile completions in players' RuneLite chat"
          description="Off by default. When on, everyone on this board — every team, guests from other clans included — sees the others' notable drops and completed tiles in their chat while the event runs. Players can still turn the feed off in the plugin, and choose what they see on their profile."
        />
      ) : (
        <p className="text-sm text-text-muted">Loading…</p>
      )}
      {state?.chatFeed && state.standingsHidden && (
        <p className="mt-3 text-xs text-text-muted">
          Standings are hidden right now, so each player only hears their own team until they are revealed.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-accent-red">{error}</p>}
    </section>
  );
}
