// The collection-log page as a picture — the grid a player knows from the game, for Discord.
//
// An embed's text cannot hold an image inline, and 27 bullet points is not how anyone reads a log:
// they look for the gaps. So /stats clog attaches this as the embed image — every slot on the page,
// the item's icon, the count the log records, and the ones still missing dimmed.
//
// SIGNED, NOT PUBLIC. The URL names an account and a page, and the bot is the only thing that mints
// one: an HMAC over both (purpose-labelled, so it can't be replayed as any other signature) means
// nobody can walk account ids to read logs, or point it at a member of a private clan. It shows
// nothing the embed carrying it doesn't already say.

import crypto from 'node:crypto';
import { ImageResponse } from 'next/og';

import { requireSecret } from '@/lib/env';
import { itemIconUrl } from '@/lib/tileIcons';

const PURPOSE = 'clog-image:v1';

function secret(): string {
  return requireSecret('ADMIN_SESSION_SECRET', 'dev-admin-secret');
}

function signatureFor(accountId: number, page: string, version: string): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`${PURPOSE}|${accountId}|${page}|${version}`)
    .digest('base64url')
    .slice(0, 22);
}

/**
 * The query string for one account's page. `version` is the sync stamp: Discord caches an image by
 * URL forever, so a new sync must be a new URL or the grid would never change.
 */
export function clogImageQuery(accountId: number, page: string, version: string): string {
  const q = new URLSearchParams({ a: String(accountId), p: page, v: version, s: signatureFor(accountId, page, version) });
  return q.toString();
}

/** The account and page a signed query names, or null when the signature doesn't hold. */
export function verifyClogImageQuery(params: URLSearchParams): { accountId: number; page: string } | null {
  const accountId = Number(params.get('a'));
  const page = params.get('p') ?? '';
  const version = params.get('v') ?? '';
  const sig = params.get('s') ?? '';
  if (!Number.isInteger(accountId) || accountId <= 0 || !page) return null;
  const expected = Buffer.from(signatureFor(accountId, page, version));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  return { accountId, page };
}

const C = {
  bg: '#141010',
  slot: '#2a221c',
  slotEdge: '#3b3028',
  gold: '#e0aa1e',
  count: '#ffff00',
  text: '#f5efe6',
  muted: '#a89b86',
};

const COLS = 9;
const CELL = 64;
const GAP = 6;
const PAD = 24;
/** The biggest pages run past a hundred slots; past this the picture stops being readable. */
const MAX_SLOTS = 135;

export interface ClogSlot {
  id: number;
  name: string;
  /** 0 = not obtained. */
  quantity: number;
}

export function clogGridImage(opts: { title: string; page: string; slots: ClogSlot[] }): ImageResponse {
  const slots = opts.slots.slice(0, MAX_SLOTS);
  const obtained = opts.slots.filter((s) => s.quantity > 0).length;
  const rows = Math.max(1, Math.ceil(slots.length / COLS));
  const width = PAD * 2 + COLS * CELL + (COLS - 1) * GAP;
  const height = PAD * 2 + 64 + rows * CELL + (rows - 1) * GAP + (opts.slots.length > MAX_SLOTS ? 30 : 0);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, padding: PAD }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', height: 52, marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.gold }}>{opts.page}</div>
            <div style={{ fontSize: 16, color: C.muted }}>{opts.title}</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: obtained === opts.slots.length ? C.gold : C.text }}>
            {`${obtained}/${opts.slots.length}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP }}>
          {slots.map((s, i) => (
            <div
              key={`${s.id}-${i}`}
              style={{
                width: CELL,
                height: CELL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                background: C.slot,
                border: `1px solid ${C.slotEdge}`,
                borderRadius: 6,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>, there is no next/image here */}
              <img src={itemIconUrl(s.id)} width={42} height={38} alt="" style={{ objectFit: 'contain', opacity: s.quantity > 0 ? 1 : 0.22 }} />
              {s.quantity > 1 && (
                <div style={{ position: 'absolute', top: 2, left: 4, fontSize: 14, fontWeight: 700, color: C.count }}>
                  {s.quantity >= 100_000 ? `${Math.floor(s.quantity / 1000)}K` : String(s.quantity)}
                </div>
              )}
            </div>
          ))}
        </div>
        {opts.slots.length > MAX_SLOTS && (
          <div style={{ display: 'flex', marginTop: 10, fontSize: 16, color: C.muted }}>
            {`+${opts.slots.length - MAX_SLOTS} more on the site`}
          </div>
        )}
      </div>
    ),
    { width, height },
  );
}
