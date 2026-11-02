'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';
import { parseEventRules } from '@/lib/eventRules';
import type { Event } from '@/lib/types';
import { WORLD_MODES } from '@/lib/worldModes';

/**
 * Which game-mode worlds count on this board (rules.worldModes).
 *
 * By default none do: Leagues, Deadman and hardcore run their own characters, so a drop there is not
 * the main game's. A clan running its bingo ON Leagues ticks Leagues, and then plugin submissions
 * from Leagues worlds count here. Saves only its own rules key — the API merges it over the rest.
 */
export default function GameModeWorldsPanel({ event }: { event: Event }) {
  const router = useRouter();
  const stored = parseEventRules(event.rules).worldModes;
  const [picked, setPicked] = useState<string[]>(stored);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dirty = picked.length !== stored.length || picked.some((k) => !stored.includes(k));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await clanFetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // null clears the key: counting no mode is the default and stores nothing.
        body: JSON.stringify({ rules: { worldModes: picked.length ? picked : null } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'Could not save.' });
        return;
      }
      setMsg({ type: 'success', text: 'Saved.' });
      router.refresh();
    } catch {
      setMsg({ type: 'error', text: 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-card-border rounded-xl p-5 bg-card-bg">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Game-mode worlds
      </h2>
      <p className="text-sm text-text-muted mb-4">
        Leagues, Deadman, hardcore and other modes use their own characters, so drops and kills there don&apos;t count on
        this board. Tick a mode if you&apos;re running this board on it. Drops, kills and other plugin submissions from
        those worlds then count here. Tiles tracked from the hiscores (kill counts, XP) still read the main game&apos;s
        hiscores.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {WORLD_MODES.map((m) => (
          <Checkbox
            key={m.key}
            checked={picked.includes(m.key)}
            disabled={saving}
            onChange={(on) => {
              setPicked(on ? [...picked, m.key] : picked.filter((k) => k !== m.key));
              setMsg(null);
            }}
            label={m.label}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {msg && <span className={`text-xs ${msg.type === 'error' ? 'text-red-400' : 'text-accent-green-light'}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
