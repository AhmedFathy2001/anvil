'use client';

import { useState } from 'react';
import { CheckboxBox } from '@/components/Checkbox';

/** "Show my colours on my names in game chat" (users.game_chat_flair). Default on. */
export default function SupporterGameChatToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/profile/game-chat-flair', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on: next }),
    }).catch(() => null);
    if (res?.ok) setOn(next);
    else setError('Could not save.');
    setBusy(false);
  }

  return (
    <label className="mt-3 flex items-start gap-2 text-[13px] text-text-muted">
      <CheckboxBox className="mt-0.5" checked={on} disabled={busy} onChange={(e) => void change(e.target.checked)} />
      <span>
        Show my colours on my characters&rsquo; names in game chat, for other players using the Anvil plugin
        {error && <span className="ml-2 text-red-400">{error}</span>}
      </span>
    </label>
  );
}
