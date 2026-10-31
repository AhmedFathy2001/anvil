'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Step 3: get the plugin running and the member list in.
//
// THE STEP THAT WAS MISSING. The wizard used to end at Discord and hand over to "Create your first
// event", and the only mention of the plugin was a checklist line that disappeared once setup was
// finished. Of October 2026's eight new clans, four never got a roster, and none of those four
// owners' plugins had ever sent anything: they never reached the plugin at all.
//
// It watches for the result instead of asking to be told. While the roster is missing it refreshes
// the page's server data every few seconds, so pressing the button in game ticks this off without
// coming back to click anything. Only while the tab is visible, and only on this step.

const POLL_MS = 10_000;

export default function InGameStep({
  inGameClanName,
  verified,
  memberCount,
}: {
  inGameClanName: string;
  verified: boolean;
  memberCount: number;
}) {
  const router = useRouter();
  const loaded = memberCount > 1;
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [loaded, router]);

  function checkNow() {
    setChecking(true);
    router.refresh();
    setTimeout(() => setChecking(false), 1500);
  }

  if (loaded) {
    return (
      <div className="rounded-lg border border-accent-green/30 bg-accent-green/10 px-4 py-3 text-sm">
        <p className="text-accent-green-light font-medium">
          ✓ {memberCount} members loaded{verified ? `, and “${inGameClanName}” is verified as yours` : ''}.
        </p>
        <p className="text-text-muted mt-1 leading-relaxed">
          From now on the plugin keeps the list up to date by itself whenever an admin logs in.
        </p>
      </div>
    );
  }

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: 'Install the plugin',
      body: (
        <>
          In RuneLite: <strong>Configuration</strong> (the wrench) → <strong>Plugin Hub</strong> → search{' '}
          <strong>Anvil</strong> → <strong>Install</strong>.
        </>
      ),
    },
    {
      title: 'Sign in',
      body: (
        <>
          Open the <strong>Anvil</strong> side panel and press <strong>Sign in with Discord</strong>. Use the
          same Discord account you are signed in with here.
        </>
      ),
    },
    {
      title: 'Sync your clan',
      body: (
        <>
          Log in to OSRS, open your <strong>clan window</strong>
          {inGameClanName ? <> for “{inGameClanName}”</> : null}, and press the <strong>Anvil</strong> button
          in its title bar.
        </>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex-none w-6 h-6 rounded-full bg-gold/15 text-gold text-xs font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <div className="text-sm leading-relaxed">
              <p className="font-medium text-foreground">{s.title}</p>
              <p className="text-text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-text-muted leading-relaxed">
        Any clan rank works, as long as you are in the clan.
        {verified
          ? ''
          : ' That first sync also proves the clan is yours, so nobody else can claim its name on Anvil.'}{' '}
        <a href="/guide/plugin" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
          Plugin guide with pictures ↗
        </a>
      </p>

      <div className="flex items-center gap-3 rounded-lg border border-card-border px-4 py-3 text-sm">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-gold/60 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
        </span>
        <span className="text-text-muted flex-1">Waiting for your member list. This ticks itself when it arrives.</span>
        <button
          type="button"
          onClick={checkNow}
          disabled={checking}
          className="text-gold hover:underline disabled:opacity-60"
        >
          {checking ? 'Checking…' : 'Check now'}
        </button>
      </div>
    </div>
  );
}
