'use client';

import { useState } from 'react';

import Input from '@/components/Input';

/** The #anvil-announcements webhook. Shown masked: the link itself is a secret that can post. */
export default function AnnouncementsWebhook({ isSet }: { isSet: boolean }) {
  const [value, setValue] = useState('');
  const [state, setState] = useState<{ set: boolean; msg: string | null; busy: boolean }>({ set: isSet, msg: null, busy: false });

  async function save(next: string) {
    setState((s) => ({ ...s, busy: true, msg: null }));
    const res = await fetch('/api/staff/releases', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook: next }),
    });
    const data = (await res.json().catch(() => ({}))) as { set?: boolean; error?: string };
    setState({ set: res.ok ? !!data.set : state.set, msg: res.ok ? 'Saved.' : data.error ?? 'Could not save.', busy: false });
    if (res.ok) setValue('');
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-muted">
        {state.set ? 'Releases post to #anvil-announcements.' : 'No announcements channel set: releases only reach clans that set an Anvil updates channel.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={state.set ? 'Paste a new webhook link to replace it' : 'https://discord.com/api/webhooks/…'}
          aria-label="Announcements webhook link"
          className="min-w-0 flex-[1_1_22rem] rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={state.busy || !value.trim()}
          onClick={() => void save(value)}
          className="rounded-lg border border-gold/50 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold-light hover:bg-gold/25 disabled:opacity-50"
        >
          Save
        </button>
        {state.set && (
          <button
            type="button"
            disabled={state.busy}
            onClick={() => void save('')}
            className="rounded-lg border border-card-border px-4 py-2 text-sm text-text-muted hover:text-foreground disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>
      {state.msg && <p className="text-xs text-text-muted">{state.msg}</p>}
    </div>
  );
}
