'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';
import GuideLink from '@/components/GuideLink';
import { COMMAND_USES, TOGGLEABLE_COMMANDS } from '@/lib/discordCommandToggles';

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
      <p className="text-sm">
        <GuideLink href="/guide/commands">How to use the commands</GuideLink>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TOGGLEABLE_COMMANDS.map((c) => (
          <div key={c.name}>
            <Checkbox
              checked={!off.has(c.name)}
              disabled={busy !== null}
              onChange={(on) => void toggle(c.name, on)}
              label={<code className="text-gold">{c.label}</code>}
              description={c.help}
            />
            {/* Everything this command can be asked: the eight names alone hide most of what is there. */}
            <details className="group ml-6 mt-1">
              <summary className="cursor-pointer list-none text-xs text-text-muted hover:text-foreground">
                <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>▸</span>{' '}
                {COMMAND_USES[c.name].length === 1 ? 'How to ask it' : `${COMMAND_USES[c.name].length} things to ask`}
              </summary>
              <ul className="mt-1.5 space-y-1.5">
                {COMMAND_USES[c.name].map((u) => (
                  <li key={u.form} className="text-xs">
                    <code className="text-foreground/90">{u.form}</code>
                    <span className="block text-text-muted">{u.help}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted">
        <code>[square brackets]</code> are optional, <code>&lt;angle brackets&gt;</code> are needed. Discord fills both in as you type the command.
      </p>
      {error && <p className="text-[13px] text-accent-red">{error}</p>}
    </div>
  );
}
