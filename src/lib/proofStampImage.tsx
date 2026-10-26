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
        position: 'absolute', top: top + 8 * scale, right: 8 * scale, display: 'flex',
        padding: `${3 * scale}px ${8 * scale}px`, fontSize: 12 * scale, fontWeight: 700, color: GOLD,
        background: 'rgba(20,18,14,0.85)', border: `${1.5 * scale}px solid ${GOLD}`, borderRadius: 4 * scale,
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
  // The plugin's banner was drawn at native size on a frame usually ~1000px wide; the stored frame
  // is downscaled to at most 1600, so scale the type with it.
  const s = Math.min(1.6, Math.max(0.75, width / 1000));
  const splitY = model.split != null ? Math.round(height * model.split) : null;

  const layer = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: BODY }}>
        <div
          style={{
            position: 'absolute', top: 12 * s, left: 12 * s, display: 'flex', flexDirection: 'column',
            maxWidth: width * 0.62, padding: `${10 * s}px ${14 * s}px`, borderRadius: 8 * s,
            background: 'rgba(20,18,14,0.9)', border: `${2 * s}px solid ${GOLD}`,
          }}
        >
          <div style={{ display: 'flex', color: GOLD, fontSize: 14 * s, fontWeight: 700 }}>{model.title}</div>
          {model.detail ? (
            <div style={{ display: 'flex', color: '#fff', fontSize: 18 * s, fontWeight: 700, marginTop: 2 * s }}>{model.detail}</div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 * s, color: '#dcdcdc', fontSize: 12 * s }}>
            {model.meta.map((m) => (
              <div key={m} style={{ display: 'flex' }}>{m}</div>
            ))}
          </div>
          {model.lines.length > 0 ? (
            <div
              style={{
                display: 'flex', flexDirection: 'column', marginTop: 6 * s, paddingTop: 5 * s,
                borderTop: `${1 * s}px solid rgba(212,160,23,0.5)`, color: '#e8d9a8', fontSize: 11 * s, fontFamily: MONO,
              }}
            >
              <div style={{ display: 'flex', color: '#a89b86', marginBottom: 2 * s }}>Game messages (ticks from the credit, as the client reported them)</div>
              {model.lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', whiteSpace: 'pre' }}>{l}</div>
              ))}
            </div>
          ) : null}
          <div style={{ display: 'flex', marginTop: 6 * s, color: '#a89b86', fontSize: 10 * s }}>{model.footer}</div>
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
