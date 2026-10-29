'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';

interface Suggestion {
  id: number;
  title: string;
  details: string | null;
  points: number | null;
  status: 'pending' | 'accepted' | 'rejected';
  note: string | null;
  clanName: string;
  by: string | null;
  createdAt: string;
}

/**
 * Tiles co-host clans suggested for this board, waiting on the host: accept one as a new tile (or,
 * on a fixed grid, over one of the existing ones), or turn it down. Renders nothing until someone
 * has suggested something.
 */
export default function TileSuggestionsPanel({
  eventId,
  fixedGrid,
  tiles,
}: {
  eventId: number;
  fixedGrid: boolean;
  tiles: { id: number; label: string }[];
}) {
  const router = useRouter();
  const [list, setList] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<Record<number, string>>({});
  const [note, setNote] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const res = await clanFetch(`/api/events/${eventId}/tile-suggestions`);
    if (res.ok) setList(((await res.json()) as { suggestions: Suggestion[] }).suggestions ?? []);
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(s: Suggestion, body: Record<string, unknown>) {
    setBusy(s.id);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/tile-suggestions/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not go through.');
      await load();
      if (body.action === 'accept') router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const pending = list.filter((s) => s.status === 'pending');
  if (list.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-gold/30 bg-card-bg">
      <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-3.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold">Tile suggestions from co-hosts</h2>
        <span className="ml-auto text-[12px] text-text-muted">{pending.length} waiting</span>
      </div>
      <ul className="divide-y divide-card-border-soft">
        {list.slice(0, 30).map((s) => (
          <li key={s.id} className={`space-y-2 px-5 py-3 ${s.status !== 'pending' ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold">{s.title}</span>
              {s.points != null && <span className="text-[12px] text-gold">{s.points} pts</span>}
              <span className="text-[12px] text-text-muted">
                from {s.clanName}
                {s.by ? ` · ${s.by}` : ''}
              </span>
              {s.status !== 'pending' && (
                <span className="ml-auto text-[12px] text-text-muted">{s.status === 'accepted' ? 'Accepted' : 'Turned down'}</span>
              )}
            </div>
            {s.details && <p className="whitespace-pre-line text-[13px] text-text-muted">{s.details}</p>}
            {s.status === 'pending' && (
              <div className="flex flex-wrap items-center gap-2">
                {fixedGrid ? (
                  <>
                    <Select
                      className="w-60"
                      value={target[s.id] ?? ''}
                      onChange={(v) => setTarget((t) => ({ ...t, [s.id]: v }))}
                      options={tiles.map((t) => ({ value: String(t.id), label: t.label }))}
                      placeholder="Write it over…"
                      ariaLabel="Tile to write it over"
                      searchable
                    />
                    <button
                      type="button"
                      disabled={busy !== null || !target[s.id]}
                      onClick={() => void decide(s, { action: 'accept', tileId: Number(target[s.id]) })}
                      className="rounded-lg bg-gold px-3 py-2 text-[13px] font-semibold text-brown-dark disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void decide(s, { action: 'accept' })}
                    className="rounded-lg bg-gold px-3 py-2 text-[13px] font-semibold text-brown-dark disabled:opacity-50"
                  >
                    Add as a tile
                  </button>
                )}
                <Input
                  className="w-56"
                  value={note[s.id] ?? ''}
                  onChange={(e) => setNote((n) => ({ ...n, [s.id]: e.target.value }))}
                  placeholder="Why not? (optional)"
                  aria-label="Reason for turning it down"
                />
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void decide(s, { action: 'reject', note: note[s.id] })}
                  className="rounded-lg border border-card-border px-3 py-2 text-[13px] text-text-muted hover:text-accent-red disabled:opacity-50"
                >
                  Turn down
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="px-5 pb-3 text-[13px] text-accent-red">{error}</p>}
    </section>
  );
}
