'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';

import { usePageActive } from '@/hooks/usePageActive';

/**
 * An uploaded image that may be animated (a clan's logo or banner, an event's icon or banner) and
 * stops animating while nobody is looking (hooks/usePageActive).
 *
 * Freezing draws the CURRENT frame into a canvas laid exactly over the image and takes the <img> out
 * of rendering, which is what stops the browser decoding frames. No still copy is needed on the
 * server, so logos uploaded before this existed freeze too. Drawing a cross-origin image only taints
 * the canvas for reading back, never for showing it, so the media bucket needs no CORS for this.
 *
 * A still image goes through the same swap; it costs one draw when the page goes idle and looks
 * identical, which is cheaper than finding out whether every image animates.
 */
export default function MotionImg({
  src,
  alt = '',
  className,
  style,
  width,
  height,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
}) {
  const active = usePageActive();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const show = (frozen: boolean) => {
      img.style.display = frozen ? 'none' : '';
      canvas.style.display = frozen ? '' : 'none';
    };
    if (active) return show(false);
    if (!img.complete || !img.naturalWidth) return;
    const rect = img.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const cs = getComputedStyle(img);
    try {
      drawFitted(ctx, img, canvas.width, canvas.height, cs.objectFit, cs.objectPosition);
    } catch {
      return; // a decode problem: leave it animating rather than show a blank box
    }
    show(true);
  }, [active, src]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- object-storage URLs, and frames must stay ours to freeze */}
      <img ref={imgRef} src={src} alt={alt} width={width} height={height} className={className} style={style} />
      <canvas ref={canvasRef} aria-hidden className={className} style={{ ...style, display: 'none' }} />
    </>
  );
}

/** Draw `img` into a w×h box the way CSS object-fit/object-position would (cover and fill). */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  fit: string,
  position: string,
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (fit !== 'cover') {
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const [px, py] = parsePosition(position);
  ctx.drawImage(img, (iw - sw) * px, (ih - sh) * py, sw, sh, 0, 0, w, h);
}

function parsePosition(position: string): [number, number] {
  const parts = position.trim().split(/\s+/);
  const pct = (p: string | undefined) => {
    if (!p) return 0.5;
    if (p === 'left' || p === 'top') return 0;
    if (p === 'right' || p === 'bottom') return 1;
    if (p.endsWith('%')) return Math.min(1, Math.max(0, parseFloat(p) / 100));
    return 0.5;
  };
  return [pct(parts[0]), pct(parts[1])];
}
