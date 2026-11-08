// Draws a proof stamp (lib/proofStamp) onto a clean plugin frame.
//
// The banner is rendered with next/og as a transparent layer the size of the frame, then sharp lays
// it over the picture. Done once, when the proof arrives — the result is an ordinary stored image, so
// every place that shows or posts proof keeps working off `submissions.imageUrl` untouched.

import { ImageResponse } from 'next/og';
import sharp from 'sharp';

import { BODY, MONO, ogFonts } from '@/lib/ogKit';
import type { StampModel } from '@/lib/proofStamp';

const GOLD = '#d4a017';
const MAX_SIDE = 2400;

function Tag({ text, top, scale }: { text: string; top: number; scale: number }) {
  return (
    <div
      style={{
        position: 'absolute', top: top + 6 * scale, right: 6 * scale, display: 'flex',
        padding: `${2 * scale}px ${6 * scale}px`, fontSize: 9 * scale, fontWeight: 700, color: GOLD,
        background: 'rgba(20,18,14,0.85)', border: `${1 * scale}px solid ${GOLD}`, borderRadius: 3 * scale,
      }}
    >
      {text}
    </div>
  );
}

/** The clean frame with the stamp drawn on, as WebP. */
export async function bakeStamp(clean: Buffer, model: StampModel): Promise<Buffer> {
  // Stored frames are downscaled to 1600 on upload; anything far past that is not one of ours, and
  // the overlay is rendered at full size, so refuse rather than draw a huge canvas.
  const { width = 0, height = 0 } = await sharp(clean, { limitInputPixels: MAX_SIDE * MAX_SIDE }).metadata();
  if (!width || !height) throw new Error('unreadable proof image');
  if (width > MAX_SIDE || height > MAX_SIDE) throw new Error(`proof image too large (${width}x${height})`);
  // Scale the type with the frame (stored frames are downscaled to at most 1600). The card is kept
  // compact — about a third of the frame wide, long lines wrap — so it never hides the proof itself;
  // "Hide stamp" shows the clean frame for anything under it.
  const s = Math.min(1.6, Math.max(0.75, width / 1000));
  const cardWidth = Math.round(width * 0.34);
  const splitY = model.split != null ? Math.round(height * model.split) : null;

  const layer = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: BODY }}>
        <div
          style={{
            position: 'absolute', top: 8 * s, left: 8 * s, display: 'flex', flexDirection: 'column',
            width: cardWidth, padding: `${6 * s}px ${8 * s}px`, borderRadius: 5 * s,
            background: 'rgba(20,18,14,0.85)', border: `${1.25 * s}px solid ${GOLD}`, lineHeight: 1.25,
          }}
        >
          <div style={{ display: 'flex', color: GOLD, fontSize: 9 * s, fontWeight: 700, letterSpacing: 0.3 * s }}>{model.title}</div>
          {model.detail ? (
            <div style={{ display: 'flex', color: '#fff', fontSize: 12 * s, fontWeight: 700, marginTop: 1 * s }}>{model.detail}</div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 3 * s, color: '#dcdcdc', fontSize: 8.5 * s }}>
            {model.meta.map((m) => (
              <div key={m} style={{ display: 'flex' }}>{m}</div>
            ))}
          </div>
          {model.lines.length > 0 ? (
            <div
              style={{
                display: 'flex', flexDirection: 'column', marginTop: 4 * s, paddingTop: 3 * s,
                borderTop: `${0.75 * s}px solid rgba(212,160,23,0.5)`, color: '#e8d9a8', fontSize: 7.5 * s, fontFamily: MONO,
              }}
            >
              <div style={{ display: 'flex', color: '#a89b86', marginBottom: 1 * s }}>Game messages (ticks from credit, client-reported)</div>
              {model.lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', whiteSpace: 'pre-wrap' }}>{l}</div>
              ))}
            </div>
          ) : null}
          {model.anvil?.length ? (
            <div
              style={{
                display: 'flex', flexDirection: 'column', marginTop: 4 * s, paddingTop: 3 * s,
                borderTop: `${0.75 * s}px solid rgba(212,160,23,0.5)`, color: '#f2c94c', fontSize: 7.5 * s,
              }}
            >
              <div style={{ display: 'flex', color: '#a89b86', marginBottom: 1 * s }}>Anvil (shown whatever the chat filter)</div>
              {model.anvil.map((l, i) => (
                <div key={i} style={{ display: 'flex', whiteSpace: 'pre-wrap' }}>{l}</div>
              ))}
            </div>
          ) : null}
          <div style={{ display: 'flex', marginTop: 3 * s, color: '#a89b86', fontSize: 7 * s }}>{model.footer}</div>
        </div>
        {splitY != null ? <Tag text="AT DROP" top={0} scale={s} /> : null}
        {splitY != null ? <Tag text="MOMENTS LATER" top={splitY} scale={s} /> : null}
      </div>
    ),
    { width, height, fonts: await ogFonts() },
  );
  const overlay = Buffer.from(await layer.arrayBuffer());
  return sharp(clean).composite([{ input: overlay, top: 0, left: 0 }]).webp({ quality: 80 }).toBuffer();
}
