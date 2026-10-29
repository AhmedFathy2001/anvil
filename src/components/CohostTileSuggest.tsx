'use client';

import { useCallback, useEffect, useState } from 'react';

import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import { clanFetch } from '@/lib/clanFetch';

interface Suggestion {
  id: number;
  title: string;
  status: 'pending' | 'accepted' | 'rejected';
  note: string | null;
  by: string | null;
}

/**
 * "Suggest a tile" for a board this clan co-hosts — shown to whoever the host opened suggestions to
 * (lib/cohostBoardAccess). Lists what the clan already suggested and what the host made of it.
 * Renders nothing when suggestions aren't open to this viewer's clan, unless `explainClosed`.
 */
export default function CohostTileSuggest({ eventId, hostName, explainClosed = false }: { eventId: number; hostName: string; explainClosed?: boolean }) {
  const [state, setState] = useState<{ open: boolean; list: Suggestion[] } | null>(null);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [points, setPoints] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    const res = await clanFetch(`/api/events/${eventId}/tile-suggestions`);
    if (!res.ok) return setState({ open: false, list: [] });
    const data = (await res.json()) as { suggestions: Suggestion[]; suggest?: string };
    setState({ open: !!data.suggest && data.suggest !== 'nobody', list: data.suggestions ?? [] });
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const res = await clanFetch(`/api/events/${eventId}/tile-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, details, points }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not send.');
      setTitle('');
      setDetails('');
      setPoints(null);
      setSent(true);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  if (!state.open && state.list.length === 0) {
    return explainClosed ? (
      <p className="text-sm text-text-muted">{hostName} hasn&apos;t opened tile suggestions to your clan on this board.</p>
    ) : null;
  }

  return (
    <div className="space-y-3">
      {state.open && (
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The tile, e.g. Any Zulrah unique" maxLength={200} aria-label="Tile" />
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Anything the host should know (optional)"
            aria-label="Details"
            className="w-full rounded border border-card-border bg-brown-dark px-3 py-2 text-sm text-foreground placeholder:text-text-muted/60 focus:border-gold focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-text-muted">Points (optional)</span>
            <NumberInput className="w-24" value={points ?? 0} min={0} max={1000} aria-label="Points" onChange={(n) => setPoints(n > 0 ? n : null)} />
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => void submit()}
              className="ml-auto rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50"
            >
              {busy ? 'Sending…' : `Suggest to ${hostName}`}
            </button>
          </div>
          {sent && <p className="text-[13px] text-accent-green-light">Sent. {hostName} sees it on their Tiles tab.</p>}
          {error && <p className="text-[13px] text-accent-red">{error}</p>}
        </div>
      )}
      {state.list.length > 0 && (
        <ul className="space-y-1 text-[13px]">
          {state.list.slice(0, 20).map((s) => (
            <li key={s.id} className="flex flex-wrap gap-2">
              <span className="font-medium">{s.title}</span>
              <span className="text-text-muted">
                {s.status === 'pending' ? 'waiting' : s.status === 'accepted' ? 'accepted ✓' : `turned down${s.note ? `: ${s.note}` : ''}`}
                {s.by ? ` · ${s.by}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
