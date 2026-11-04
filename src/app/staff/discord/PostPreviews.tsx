'use client';

import { useEffect, useState } from 'react';

import Input from '@/components/Input';
import { CheckboxBox } from '@/components/Checkbox';

interface Sample {
  id: string;
  group: string;
  label: string;
}

/** Send sample posts of each type to any channel, to see how they look (lib/discordSamples). */
export default function PostPreviews() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [hook, setHook] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/staff/discord/samples')
      .then((r) => r.json())
      .then((d: { samples?: Sample[] }) => {
        setSamples(d.samples ?? []);
        setPicked(new Set((d.samples ?? []).map((s) => s.id)));
      })
      .catch(() => {});
  }, []);

  const groups = [...new Set(samples.map((s) => s.group))];
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/staff/discord/samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook: hook, ids: [...picked] }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; failed?: string[] };
      if (!res.ok && d.error) setMsg(d.error);
      else setMsg(`Sent ${d.sent ?? 0}${d.failed?.length ? `. Failed: ${d.failed.join(', ')}` : ''}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-4">
      <h2 className="mb-1 font-semibold">Preview posts</h2>
      <p className="mb-3 text-sm text-text-muted">
        Sends a sample of each post type, with a made-up player and a stand-in screenshot, to any channel. Paste that
        channel&apos;s webhook link; it&apos;s used for this send only and never saved.
      </p>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{g}</div>
            {samples
              .filter((s) => s.group === g)
              .map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckboxBox checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
                  {s.label}
                </label>
              ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          type="url"
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          aria-label="Webhook link for the preview channel"
          className="min-w-0 flex-[1_1_18rem] rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || !hook.trim() || picked.size === 0}
          onClick={() => void send()}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark disabled:opacity-50"
        >
          {busy ? 'Sending…' : `Send ${picked.size}`}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-gray-200">{msg}</p>}
    </section>
  );
}
