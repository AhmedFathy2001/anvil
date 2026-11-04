import Link from 'next/link';

import { requirePlatformPage } from '@/lib/platformAccess';
import { botClipStatus } from '@/lib/highlights/botToken';
import { clipsEnabled, highlightsForStaff } from '@/lib/highlights/store';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  ready: 'clip',
  pending: 'clipping…',
  failed: 'clip failed',
  limited: 'rate-limited',
  off: 'not clipped',
  none: 'stream link',
};

/**
 * Stream highlights across every streamed event (lib/highlights), newest first, for the owner's
 * marketing. "Featurable" keeps the clips whose host said Anvil may use them in its own promotion —
 * only those may go anywhere outside their event. Read-only.
 */
export default async function StaffHighlightsPage({ searchParams }: { searchParams: Promise<{ featurable?: string }> }) {
  await requirePlatformPage('support');
  const featurable = (await searchParams).featurable === '1';
  const [rows, bot] = await Promise.all([highlightsForStaff({ featurable, limit: 200 }), botClipStatus()]);
  const tab = (on: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-gold/50 bg-gold/10 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`;

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Stream highlights
      </h1>
      <p className="mb-4 text-sm text-text-muted">
        Clips the Anvil bot made on streamed events, and links into the streams. Only use a clip outside its event when
        it&rsquo;s marked featurable: its host opted in to Anvil promoting it.
      </p>

      {!bot.configured && (
        <div className="mb-4 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm text-text-muted">
          The Anvil bot isn&rsquo;t set up on this server (TWITCH_BOT_CLIENT_ID, TWITCH_BOT_CLIENT_SECRET,
          TWITCH_BOT_REFRESH_TOKEN), so nothing is clipped.
        </div>
      )}
      {bot.configured && bot.needsReauth && (
        <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          <b className="text-gold">Re-authorize the Anvil bot for clips.</b> Its Twitch token doesn&rsquo;t carry{' '}
          <code>clips:edit</code>, so nothing is being clipped (stream links still work). Run{' '}
          <code>deploy/twitch-bot-token.mjs</code> again logged in as the bot account, and set the new
          TWITCH_BOT_REFRESH_TOKEN for the site and the chat bot.
        </div>
      )}
      {bot.configured && !clipsEnabled() && (
        <div className="mb-4 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm text-text-muted">
          Clipping is off on this deployment (the preview never clips unless HIGHLIGHTS_CLIPS=on). Stream links still
          work.
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <Link href="/staff/highlights" className={tab(!featurable)}>
          All
        </Link>
        <Link href="/staff/highlights?featurable=1" className={tab(featurable)}>
          Featurable
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-card-border bg-card-bg px-4 py-8 text-center text-sm text-text-muted">
          {featurable ? 'No featurable clips yet.' : 'No highlights yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-text-dim">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">What</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/60">
              {rows.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11.5px] text-text-muted">{h.occurredAt.slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-3 py-2">
                    {h.title}
                    {h.featurable && <span className="ml-2 rounded bg-accent-green/15 px-1.5 py-0.5 text-[10.5px] text-accent-green-light">featurable</span>}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {h.eventName} <span className="text-text-dim">· {h.clanName} · {h.eventVisibility}</span>
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {h.platform} / {h.channelName} <span className="text-text-dim">({h.channelOwner})</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {h.clipUrl ? (
                      <a href={h.clipUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light">
                        Clip
                      </a>
                    ) : (
                      <span className="text-text-dim">{STATUS[h.clipStatus] ?? h.clipStatus}</span>
                    )}
                    {h.vodUrl && (
                      <a href={h.vodUrl} target="_blank" rel="noopener noreferrer" className="ml-3 text-text-muted hover:text-gold">
                        Stream
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
