'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import Select from '@/components/Select';
// From lib/startLocations, not lib/startProof: this is a client component, and the starting-shot
// module pulls in node:crypto and the keyword secret behind it.
import { DEFAULT_START_RADIUS, START_LOCATIONS } from '@/lib/startLocations';

// A pan/zoom map of the Gielinor surface you drop a pin on, for the starting shot's location pool
// (lib/startProof). Typing raw game coordinates is a thing nobody but a bot writer can do from
// memory, so the host clicks the bank they mean and we keep the numbers.
//
// Tiles come straight from the RuneScape Wiki's map service — the same renders the wiki's own
// article maps use. There is no library involved: a slippy map is a grid of <img> at computed
// offsets, and Leaflet would be 150 kB to do arithmetic we need to do anyway (the click has to come
// back as game coordinates, not a LatLng we then convert).
//
// The geometry, once, so the rest reads simply:
//   * a tile is 256 px and covers `256 / 2^z` game squares, so 2^z px per square
//   * game x grows east and game y grows NORTH, while screen y grows down — hence the sign flips

const TILE_PX = 256;
/**
 * The wiki's current render. Dated versions are immutable, so this pins a known-good map rather
 * than tracking a moving target; refresh it by opening any wiki article with a map (e.g.
 * oldschool.runescape.wiki/w/Grand_Exchange) and reading the version out of its tile URLs.
 */
const TILE_VERSION = '2026-08-12_a';
const tileUrl = (z: number, tx: number, ty: number) =>
  `https://maps.runescape.wiki/osrs/versions/${TILE_VERSION}/tiles/rendered/0/${z}/0_${tx}_${ty}.png`;
/**
 * The wiki's older, version-less tile path. Used only as a fallback for a tile that 404s, so the
 * picker degrades to an out-of-date map instead of a black hole if that version is ever retired.
 */
const legacyTileUrl = (z: number, tx: number, ty: number) =>
  `https://maps.runescape.wiki/osrs/tiles/0_2019-10-31_1/${z}/0_${tx}_${ty}.png`;

const MIN_ZOOM = 0;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 2;
/** Where the map opens when there's no pin yet — Lumbridge, because everyone knows where it is. */
const HOME = { x: 3222, y: 3218 };

export interface MapSpot {
  x: number;
  y: number;
  radius: number;
}

interface Props {
  /** The pin, or null for an empty map. */
  value: MapSpot | null;
  onChange: (spot: MapSpot) => void;
  /** Viewport height in px. */
  height?: number;
}

export default function WorldMapPicker({ value, onChange, height = 380 }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: height });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [centre, setCentre] = useState(value ? { x: value.x, y: value.y } : HOME);
  // Set while a drag is in flight; a pointerup that moved more than a few px pans instead of pinning.
  const drag = useRef<{ id: number; startX: number; startY: number; centre: { x: number; y: number }; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = 2 ** zoom; // px per game square
  const perTile = TILE_PX / scale; // game squares per tile

  /** Screen position (px, from the frame's top-left) of a game coordinate. */
  const toScreen = useCallback(
    (x: number, y: number) => ({
      left: (x - centre.x) * scale + size.w / 2,
      top: (centre.y - y) * scale + size.h / 2,
    }),
    [centre.x, centre.y, scale, size.w, size.h],
  );

  /** Game coordinate under a point on the frame. */
  const toGame = useCallback(
    (px: number, py: number) => ({
      x: Math.round(centre.x + (px - size.w / 2) / scale),
      y: Math.round(centre.y - (py - size.h / 2) / scale),
    }),
    [centre.x, centre.y, scale, size.w, size.h],
  );

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, centre, moved: false };
    // Capture keeps a pan alive when the cursor leaves the frame. It throws on a pointer the browser
    // doesn't consider active, so it goes AFTER the state it must not take down with it.
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* pan still works, it just stops at the edge */
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    setCentre({ x: d.centre.x - dx / scale, y: d.centre.y + dy / scale });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) return; // that was a pan, not a pick
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spot = toGame(e.clientX - rect.left, e.clientY - rect.top);
    onChange({ ...spot, radius: value?.radius ?? DEFAULT_START_RADIUS });
  }

  /** Wheel zoom, anchored under the cursor so the map doesn't slide away from what you're aiming at. */
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + (e.deltaY < 0 ? 1 : -1)));
    if (next === zoom) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (rect) {
      const under = toGame(e.clientX - rect.left, e.clientY - rect.top);
      const nextScale = 2 ** next;
      setCentre({
        x: under.x - (e.clientX - rect.left - size.w / 2) / nextScale,
        y: under.y + (e.clientY - rect.top - size.h / 2) / nextScale,
      });
    }
    setZoom(next);
  }

  // The tiles covering the viewport, plus one ring so a pan doesn't reveal empty edges.
  const tiles: { key: string; tx: number; ty: number; left: number; top: number }[] = [];
  if (size.w > 0) {
    const halfW = size.w / 2 / scale;
    const halfH = size.h / 2 / scale;
    const minTx = Math.floor((centre.x - halfW) / perTile) - 1;
    const maxTx = Math.floor((centre.x + halfW) / perTile) + 1;
    const minTy = Math.floor((centre.y - halfH) / perTile) - 1;
    const maxTy = Math.floor((centre.y + halfH) / perTile) + 1;
    for (let tx = minTx; tx <= maxTx; tx++) {
      for (let ty = minTy; ty <= maxTy; ty++) {
        if (tx < 0 || ty < 0) continue;
        // A tile covers game x [tx·per, …) and y [ty·per, …), so its TOP edge is the higher y.
        const pos = toScreen(tx * perTile, (ty + 1) * perTile);
        tiles.push({ key: `${zoom}/${tx}/${ty}`, tx, ty, left: pos.left, top: pos.top });
      }
    }
  }

  const pin = value ? toScreen(value.x, value.y) : null;
  const radiusPx = value ? value.radius * scale : 0;
  const cursor = toGame(size.w / 2, size.h / 2);

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={onWheel}
        style={{ height }}
        className="relative overflow-hidden rounded-lg border border-card-border bg-black/60 touch-none select-none cursor-crosshair"
      >
        {tiles.map((t) => (
          // Tiles are 256px squares straight from the wiki's map service: next/image would want a
          // remote pattern and a loader to re-encode something already exactly the size we draw it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.key}
            src={tileUrl(zoom, t.tx, t.ty)}
            alt=""
            draggable={false}
            width={TILE_PX}
            height={TILE_PX}
            onError={(e) => {
              const img = e.currentTarget;
              if (img.dataset.fallback) return;
              img.dataset.fallback = '1';
              img.src = legacyTileUrl(zoom, t.tx, t.ty);
            }}
            style={{ position: 'absolute', left: t.left, top: t.top, width: TILE_PX, height: TILE_PX }}
            className="pointer-events-none max-w-none"
          />
        ))}

        {pin && (
          <>
            {radiusPx >= 4 && (
              <div
                className="pointer-events-none absolute rounded-full border-2 border-gold/70 bg-gold/10"
                style={{
                  left: pin.left - radiusPx,
                  top: pin.top - radiusPx,
                  width: radiusPx * 2,
                  height: radiusPx * 2,
                }}
              />
            )}
            <div
              className="pointer-events-none absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-gold border-2 border-brown-dark"
              style={{ left: pin.left, top: pin.top }}
            />
          </>
        )}

        <div className="absolute top-2 left-2 flex gap-1">
          {[['−', -1], ['+', 1]].map(([label, delta]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + (delta as number))))}
              className="w-7 h-7 rounded bg-brown-dark/90 border border-card-border text-sm leading-none text-foreground hover:border-gold/50"
              aria-label={delta === 1 ? 'Zoom in' : 'Zoom out'}
            >
              {label as string}
            </button>
          ))}
        </div>

        <div className="absolute bottom-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-brown-dark/90 border border-card-border text-text-muted">
          {value ? `pin ${value.x}, ${value.y}` : `${cursor.x}, ${cursor.y}`}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <span>Click to drop the pin · drag to pan · scroll to zoom</span>
        <span className="ml-auto flex items-center gap-1">
          <span>Jump to</span>
          {/* An ACTION menu, not a field: it jumps the map and goes straight back to empty, so the
              value is always ''. The filter box earns its place here — the list of known places is
              long. */}
          <Select
            value=""
            onChange={(label) => {
              const spot = START_LOCATIONS.find((l) => l.label === label);
              if (spot?.x != null && spot.y != null) setCentre({ x: spot.x, y: spot.y });
            }}
            options={START_LOCATIONS.filter((l) => l.x != null).map((l) => ({
              value: l.label,
              label: l.label,
            }))}
            placeholder="a known place…"
            ariaLabel="Jump to a known place"
            className="w-40"
          />
        </span>
      </div>

      <p className="text-[10px] text-text-muted/70">
        Map tiles by the{' '}
        <a href="https://oldschool.runescape.wiki/w/Map" target="_blank" rel="noreferrer" className="underline hover:text-gold">
          RuneScape Wiki
        </a>{' '}
        (Weird Gloop,{' '}
        <a href="https://weirdgloop.org/licensing/" target="_blank" rel="noreferrer" className="underline hover:text-gold">
          licence
        </a>
        ).
      </p>
    </div>
  );
}
