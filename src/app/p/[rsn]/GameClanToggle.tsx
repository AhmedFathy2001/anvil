'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The owner's switch for the in-game clan line on their own character (lib/gameClans). Hidden, the
 * clan leaves this page for everyone else and the character leaves that clan's ghost page.
 */
export default function GameClanToggle({ accountId, hidden }: { accountId: number; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/profile/accounts/${accountId}/game-clan`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hidden: !hidden }),
          });
          if (res.ok) router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="text-[12px] text-text-dim underline-offset-2 transition-colors hover:text-gold hover:underline disabled:opacity-50"
      title={hidden ? 'Only you can see your clan here' : 'Hide your clan from this page and the clan’s page'}
    >
      {hidden ? 'hidden · show' : 'hide'}
    </button>
  );
}
