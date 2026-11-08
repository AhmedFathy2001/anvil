'use client';

import { useState } from 'react';

import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';
import { DISCORD_WEBHOOK_HELP_URL, type WebhookAdvice } from '@/lib/webhookPool';

export interface PoolHook {
  id: string;
  label: string;
}

export interface Capacity {
  destination: 'event' | 'clan' | 'none';
  clanKey: string | null;
  webhooks: number;
  participants: number;
  postsPerMinute: number;
  recentRateLimits: number;
  advice: WebhookAdvice | null;
  botCanAddWebhooks: boolean;
}

/**
 * The webhooks behind this event's posts (lib/webhookPool) and, when the event is big enough to hit
 * Discord's speed limit on one, the advice to add more. Shown as masked ids: the browser never sees
 * a webhook URL. With the bot, one click adds the recommended number; without it, Discord's own steps
 * and a paste box.
 */
export default function EventWebhookPool({
  eventId,
  pool,
  capacity,
  onChange,
}: {
  eventId: number;
  pool: PoolHook[];
  capacity: Capacity;
  onChange: (pool: PoolHook[], capacity: Capacity) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function act(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setMsg(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/discord-settings/pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That didn’t work. Try again.');
      onChange(Array.isArray(data.pool) ? data.pool : pool, { ...capacity, ...data.capacity, botCanAddWebhooks: capacity.botCanAddWebhooks });
      setMsg({ ok: true, text: data.message ?? 'Done.' });
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const advice = capacity.advice;
  const own = capacity.destination === 'event';
  if (!advice && !own) return msg ? <Message msg={msg} /> : null;

  return (
    <div className="space-y-3">
      {advice && (
        <div className="space-y-2.5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3.5 py-3">
          <p className="font-semibold text-foreground">
            This event is big enough to hit Discord&apos;s speed limit on one webhook
          </p>
          <p className="text-[12px] text-text-muted">
            {advice.reasons.join(' · ')}. {own ? 'This event’s channel' : 'Your clan’s bingo channel'} has{' '}
            {capacity.webhooks} webhook{capacity.webhooks === 1 ? '' : 's'}; we recommend {advice.recommended}. Extra
            webhooks in the same channel share the posts, so none of them is made to wait. (Discord also limits a channel
            as a whole, so this smooths bursts rather than making a channel unlimited.)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {capacity.botCanAddWebhooks ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act({ action: 'create', count: advice.missing })}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold/90 disabled:opacity-50"
              >
                {busy ? 'Working…' : `Let the bot add ${advice.missing} more`}
              </button>
            ) : (
              <a
                href={DISCORD_WEBHOOK_HELP_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gold/60 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
              >
                How to make a webhook in Discord
              </a>
            )}
            {!own && (
              <ClanLink href="/admin/integrations" className="text-[12px] text-gold hover:underline">
                Or manage them under Admin → Discord
              </ClanLink>
            )}
          </div>
        </div>
      )}

      {own && pool.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] text-text-muted">
            {pool.length === 1 ? 'One webhook posts' : `${pool.length} webhooks share`} this event&apos;s posts
          </p>
          <ul className="space-y-1.5">
            {pool.map((h, i) => (
              <li key={h.id} className="flex items-center gap-2 rounded-lg border border-card-border bg-bg px-2.5 py-1.5">
                <code className="flex-1 truncate text-xs text-text-muted">
                  Webhook {h.label}
                  {i === 0 ? ' (first)' : ''}
                </code>
                {pool.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act({ action: 'remove', webhookId: h.id })}
                    aria-label="Remove this webhook"
                    className="rounded-md px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(own || advice) && (
        <div className="flex flex-col gap-1.5 text-[12px] text-text-muted">
          <span>Add a webhook from the same channel</span>
          <div className="flex gap-2">
            <Input
              type="url"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              aria-label="Extra webhook URL"
            />
            <button
              type="button"
              disabled={busy || !pasted.trim()}
              onClick={() => void act({ action: 'add', webhookUrl: pasted.trim() }).then((ok) => ok && setPasted(''))}
              className="shrink-0 rounded-lg border border-card-border bg-card-bg-hover px-4 py-2 text-sm font-semibold transition-colors hover:border-gold/40 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
      {msg && <Message msg={msg} />}
    </div>
  );
}

function Message({ msg }: { msg: { ok: boolean; text: string } }) {
  return <p className={`text-[12px] ${msg.ok ? 'text-green-400' : 'text-accent-red'}`}>{msg.text}</p>;
}
