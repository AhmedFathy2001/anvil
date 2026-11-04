// A channel panel as a PNG (lib/overlay/streamPanels has the kinds, sizes and links). Kept apart from
// the route so the drawing can be rendered without a request, a session or a database.

import { ImageResponse } from 'next/og';

import { BODY, C, DISPLAY, ogFonts } from '@/lib/ogKit';
import { PANEL_HEIGHT, PANEL_META, PANEL_WIDTH, panelEventName, type PanelKind } from '@/lib/overlay/streamPanels';

// The little board in the corner: which of the 3×3 cells are lit. Fixed, so every panel matches.
const LIT = [true, false, true, false, true, false, true, true, false];

export async function panelImage(kind: PanelKind, eventName: string, headers: Record<string, string> = {}): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 44px',
          background: C.card,
          border: `3px solid ${C.borderHi}`,
          borderRadius: 24,
          fontFamily: BODY,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 430 }}>
          <div style={{ display: 'flex', color: C.muted, fontSize: 20, letterSpacing: 3, textTransform: 'uppercase' }}>{PANEL_META[kind].kicker}</div>
          <div style={{ display: 'flex', color: C.goldLight, fontFamily: DISPLAY, fontWeight: 700, fontSize: 56, lineHeight: 1.05, marginTop: 4 }}>
            {PANEL_META[kind].title}
          </div>
          <div style={{ display: 'flex', color: C.text, fontSize: 22, marginTop: 8 }}>{panelEventName(eventName)}</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', width: 108, gap: 6 }}>
          {LIT.map((on, i) => (
            <div
              key={i}
              style={{ width: 32, height: 32, borderRadius: 6, background: on ? C.gold : C.cell, border: `2px solid ${on ? C.gold : C.border}` }}
            />
          ))}
        </div>
      </div>
    ),
    { width: PANEL_WIDTH, height: PANEL_HEIGHT, fonts: await ogFonts(), headers },
  );
}
