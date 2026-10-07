// A revealed bingo board as one Discord-friendly image.
//
// Discord fetches embed images anonymously, including for clan-only/invited events. The URL is
// therefore purpose-signed rather than public-by-id: knowing that event 42 exists is not enough to
// render it, and the signature cannot be replayed for another event or another image endpoint.

import crypto from 'node:crypto';
import { ImageResponse } from 'next/og';

import { requireSecret } from '@/lib/env';
import { deriveTileIcon } from '@/lib/tileIcons';

const PURPOSE = 'board-reveal-image:v1';

function secret(): string {
  return requireSecret('ADMIN_SESSION_SECRET', 'dev-admin-secret');
}

function signatureFor(eventId: number, version: string): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`${PURPOSE}|${eventId}|${version}`)
    .digest('base64url')
    .slice(0, 22);
}

/** Version changes the URL when a board is hidden and revealed again, defeating Discord's cache. */
export function boardRevealImageQuery(eventId: number, version: string): string {
  const q = new URLSearchParams({ e: String(eventId), v: version, s: signatureFor(eventId, version) });
  return q.toString();
}

export function verifyBoardRevealImageQuery(params: URLSearchParams): { eventId: number } | null {
  const eventId = Number(params.get('e'));
  const version = params.get('v') ?? '';
  const sig = params.get('s') ?? '';
  if (!Number.isInteger(eventId) || eventId <= 0 || !version || !sig) return null;
  const expected = Buffer.from(signatureFor(eventId, version));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  return { eventId };
}

const C = {
  bg: '#141010',
  card: '#211a16',
  border: '#493927',
  gold: '#e0aa1e',
  goldLight: '#ffd35c',
  text: '#f5efe6',
  muted: '#a89b86',
};

export interface BoardRevealTile {
  id: number;
  position: number;
  label: string;
  points?: number | null;
  optional?: number | boolean | null;
  icon?: string | null;
  tileType?: string | null;
  trackedStat?: string | null;
  statType?: string | null;
  trackedItemIds?: string | null;
  itemRequirements?: string | null;
  timedActivity?: string | null;
  targetNpcs?: string | null;
}

/**
 * Render the board itself, not a generic event card. Classic grids retain their square shape; list
 * events use four columns. Very large task lists are capped because a 1,000-row bitmap is neither
 * legible nor accepted reliably by Discord—the footer links to the complete interactive board.
 */
export function boardRevealImage(opts: {
  eventName: string;
  format: string;
  scoringMode: string;
  boardSize: number;
  tiles: BoardRevealTile[];
}): ImageResponse {
  const ordered = [...opts.tiles].sort((a, b) => a.position - b.position);
  const square = opts.format === 'bingo' && opts.scoringMode !== 'points' && opts.boardSize > 0;
  const cap = square ? 144 : 72;
  const shown = ordered.slice(0, cap);
  const cols = square ? Math.max(1, Math.min(12, opts.boardSize)) : Math.min(4, Math.max(1, shown.length));
  const width = 1400;
  const gap = 10;
  const pad = 34;
  const cellW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols);
  const cellH = square ? Math.max(112, Math.min(184, cellW)) : 132;
  const rows = Math.max(1, Math.ceil(shown.length / cols));
  const header = 116;
  const footer = ordered.length > shown.length ? 48 : 26;
  const height = pad * 2 + header + rows * cellH + Math.max(0, rows - 1) * gap + footer;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, padding: pad, fontFamily: 'sans-serif' }}>
        <div style={{ height: header, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', color: C.gold, fontSize: 22, textTransform: 'uppercase', letterSpacing: 3 }}>Board revealed</div>
            <div style={{ display: 'flex', color: C.text, fontSize: 44, fontWeight: 700, marginTop: 6, maxWidth: 1050, overflow: 'hidden' }}>{opts.eventName}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, color: C.goldLight }}>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>{ordered.length}</div>
            <div style={{ display: 'flex', fontSize: 20, color: C.muted }}>{ordered.length === 1 ? 'tile' : 'tiles'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap }}>
          {shown.map((tile) => {
            const icon = deriveTileIcon(tile);
            return (
              <div
                key={tile.id}
                style={{
                  width: cellW,
                  height: cellH,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: C.card,
                  border: `2px solid ${tile.optional ? '#5e4c32' : C.border}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: square ? 48 : 58, height: square ? 48 : 58, display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img */}
                  {icon ? <img src={icon} width={square ? 46 : 56} height={square ? 46 : 56} alt="" style={{ objectFit: 'contain' }} /> : <div style={{ display: 'flex', color: C.gold, fontSize: 34 }}>◆</div>}
                </div>
                <div style={{ minWidth: 0, display: 'flex', flex: 1, flexDirection: 'column' }}>
                  <div style={{ display: 'flex', color: C.text, fontWeight: 700, fontSize: square ? 17 : 22, lineHeight: 1.2, maxHeight: square ? 62 : 56, overflow: 'hidden' }}>{tile.label}</div>
                  {(opts.scoringMode === 'points' || tile.optional) && (
                    <div style={{ display: 'flex', marginTop: 7, fontSize: 15, color: tile.optional ? C.muted : C.goldLight }}>
                      {tile.optional ? 'Bonus' : `${tile.points ?? 0} pts`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ height: footer, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', color: C.muted, fontSize: 17 }}>
          <div style={{ display: 'flex' }}>{ordered.length > shown.length ? `+${ordered.length - shown.length} more on the interactive board` : 'Open the interactive board for tile details'}</div>
          <div style={{ display: 'flex', color: C.gold, fontWeight: 700 }}>Anvil</div>
        </div>
      </div>
    ),
    { width, height },
  );
}
