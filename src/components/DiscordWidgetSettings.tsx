'use client';

import { useEffect, useState } from 'react';

import { useClanPrefixValue } from '@/components/ClanLink';
import ToggleSetting from '@/components/ToggleSetting';
import { clanFetch } from '@/lib/clanFetch';

type Status =
  | { state: 'no-server' | 'disabled' | 'unknown' | 'unreachable'; guildId?: string }
  | {
      state: 'ok';
      guildId: string;
      name: string;
      online: number;
      inGame: number;
      matched: number;
      listed: number;
      hasDiscordInvite: boolean;
      hasInvite: boolean;
      clicks: Record<string, number>;
      joins: { code: string; uses: number; madeByAnvil: boolean }[];
    };

const SRC_LABEL: Record<string, string> = {
  home: 'Clan home (members)',
  public: 'Clan page (visitors)',
  embed: 'Embed on other sites',
  badge: 'Badge on other sites',
};

function Line({ tone, title, children }: { tone: 'ok' | 'warn'; title: string; children?: React.ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-xl border px-3.5 py-3 text-[13px] ${tone === 'ok' ? 'border-accent-green-light/30 bg-accent-green-light/[0.06]' : 'border-[#e9b23a]/35 bg-[#e9b23a]/[0.07]'}`}>
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: tone === 'ok' ? 'var(--color-accent-green-light)' : '#e9b23a' }} />
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        {children && <div className="text-text-muted">{children}</div>}
      </div>
    </div>
  );
}

/**
 * The "who's around" card (components/ClanHall): whether each of its sources is working, the
 * switches, and the embed codes. Each problem says exactly what to click, because the usual one —
 * Discord's widget being off — is a setting on Discord's side that no Anvil switch can reach.
 */
export default function DiscordWidgetSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const prefix = useClanPrefixValue();

  useEffect(() => {
    clanFetch('/api/admin/discord/widget')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d ?? { state: 'unreachable' }))
      .catch(() => setStatus({ state: 'unreachable' }));
  }, []);

  // Only read once the status has loaded, which is client-side, so the server render never needs it.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = `${origin}${prefix}/api/discord`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-semibold">Who&apos;s around</h3>
        <p className="mt-1 text-sm text-text-muted">
          A live card on your clan&apos;s home page: who&apos;s on Discord, who&apos;s in game (through the Anvil plugin and
          Discord&apos;s RuneLite activity), who&apos;s in voice, and for members what each person is up to on Anvil.
        </p>
      </div>

      {!status ? (
        <p className="text-sm text-text-muted">Checking your Discord…</p>
      ) : status.state === 'no-server' ? (
        <Line tone="warn" title="No Discord server connected">
          Invite the bot above. The card finds your server through it.
        </Line>
      ) : status.state === 'disabled' ? (
        <Line tone="warn" title="Discord’s widget is switched off for your server">
          <ol className="mt-1 list-decimal pl-5">
            <li>In Discord, open Server Settings → Widget.</li>
            <li>Turn on “Enable Server Widget”.</li>
            <li>Optional: choose an invite channel there too.</li>
          </ol>
        </Line>
      ) : status.state !== 'ok' ? (
        <Line tone="warn" title="Couldn’t reach your server’s widget">
          Discord didn’t answer just now. This page checks again when you reload it.
        </Line>
      ) : (
        <>
          <Line tone="ok" title={`Connected to ${status.name}`}>
            {status.online} on Discord right now, {status.inGame} in game.
          </Line>
          <Line
            tone={status.listed === 0 || status.matched / status.listed >= 0.5 ? 'ok' : 'warn'}
            title={`${status.matched} of ${status.listed} Discord names match an RSN on your roster`}
          >
            Matched people show their rank, team and XP. To match more, turn on nickname sync under Roles &amp; channels, which
            sets Discord nicknames to RSNs.
          </Line>
          {!status.hasInvite && (
            <Line tone="warn" title="No Join button yet">
              Add a Discord invite URL above, or pick an invite channel in Discord’s widget settings.
            </Line>
          )}
        </>
      )}

      <div className="flex flex-col gap-4 border-t border-card-border pt-4">
        <ToggleSetting settingKey="discord_widget_enabled" label="Show the card on your clan's home page" defaultOn />
        <ToggleSetting
          settingKey="discord_widget_public_names"
          label="Show names to visitors too"
          helpText="Off: members and staff see who's around; visitors see only the counts and voice rooms."
        />
        <ToggleSetting
          settingKey="discord_widget_embed"
          label="Allow the embed and badge on other sites"
          helpText="Counts only, never names. Only works while your clan is public."
          defaultOn
        />
      </div>

      {status?.state === 'ok' && (
        <div className="flex flex-col gap-2 border-t border-card-border pt-4">
          <div className="text-sm font-semibold">Joins, last 30 days</div>
          {Object.keys(status.clicks).length === 0 && status.joins.length === 0 ? (
            <p className="text-[13px] text-text-muted">No Join clicks yet. They show here once people use the card.</p>
          ) : (
            <div className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
              {Object.entries(status.clicks)
                .sort((a, b) => b[1] - a[1])
                .map(([src, n]) => (
                  <div key={src} className="flex justify-between gap-3 border-b border-card-border-soft py-1">
                    <span className="text-text-muted">{SRC_LABEL[src] ?? src}</span>
                    <span className="tabular-nums">{n} click{n === 1 ? '' : 's'}</span>
                  </div>
                ))}
              {status.joins.map((j) => (
                <div key={j.code} className="flex justify-between gap-3 border-b border-card-border-soft py-1">
                  <span className="text-text-muted">{j.madeByAnvil ? 'Joined through Anvil’s invite' : 'Joined through your invite'}</span>
                  <span className="tabular-nums">{j.uses} all time</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-text-dim">
            Clicks are counted by Anvil. Joins are Discord&apos;s own count for the invite, which needs the bot to have
            Manage Server (or Manage Channels, for the invite Anvil made).
          </p>
        </div>
      )}

      {status?.state === 'ok' && origin && (
        <div className="flex flex-col gap-2 border-t border-card-border pt-4">
          <div className="text-sm font-semibold">Embed it elsewhere</div>
          <CodeLine label="Card (iframe)" code={`<iframe src="${base}/embed" width="380" height="290" frameborder="0"></iframe>`} />
          <CodeLine label="Badge (forums, READMEs)" code={`[![Discord](${base}/badge)](${base}/join?src=badge)`} />
          <CodeLine label="Badge, in-game count" code={`[![In game](${base}/badge?show=game)](${base}/join?src=badge)`} />
        </div>
      )}
    </div>
  );
}

function CodeLine({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1 text-xs text-text-muted">{label}</div>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-card-border bg-background px-3 py-2 font-mono text-xs text-text-muted">
          {code}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              ?.writeText(code)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              })
              .catch(() => {});
          }}
          className="shrink-0 rounded-lg border border-card-border px-3 text-xs text-text-muted hover:border-gold/45 hover:text-foreground"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
