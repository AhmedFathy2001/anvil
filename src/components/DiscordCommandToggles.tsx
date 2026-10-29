'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';
import { TOGGLEABLE_COMMANDS } from '@/lib/discordCommandToggles';

/** Admin → Discord → Commands: switch off the slash commands this server doesn't need. */
export default function DiscordCommandToggles() {
  const [off, setOff] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await clanFetch('/api/admin/discord/commands');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setOff(new Set(data.off ?? []));
      else setError(data.error ?? 'Could not load the commands.');
    })();
  }, []);

  async function toggle(name: string, on: boolean) {
    setBusy(name);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/discord/commands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, on }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not save.');
      setOff(new Set(data.off ?? []));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!off) return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        Turn off the ones your server doesn&apos;t need. Discord still lists them; asking one says your clan switched it off.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TOGGLEABLE_COMMANDS.map((c) => (
          <Checkbox
            key={c.name}
            checked={!off.has(c.name)}
            disabled={busy !== null}
            onChange={(on) => void toggle(c.name, on)}
            label={<code className="text-gold">{c.label}</code>}
            description={c.help}
          />
        ))}
      </div>
      {error && <p className="text-[13px] text-accent-red">{error}</p>}
    </div>
  );
}
