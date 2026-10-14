'use client';

import { useEffect, useRef } from 'react';
import MotionImg from '@/components/MotionImg';
import ClanCrest from '@/components/ClanCrest';

// The last hour before an event starts: the hero gives way to one big, escalating clock built from the
// event's own banner, icon and name. "Heat" (0 at T-60m → 1 at zero) drives everything — ember density,
// the glow under the clock, the banner's push-in — and the copy steps through the relog ask. The last
// minute pulses, the last ten seconds slam in one digit at a time, and zero flashes into "<event> is live".
// Pure presentation: EventHero decides when to show it and hands over the clock.

export const FINAL_HOUR_MS = 3_600_000;
/** How long the "is live" moment holds after zero before the normal hero comes back. */
export const FINAL_HOUR_GO_MS = 6_000;

interface Props {
  name: string;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  bannerPosition?: number | null;
  hostName?: string;
  prizePool: number;
  teamsCount: number;
  /** Start time and current time, ms. */
  target: number;
  now: number;
}

function stepCopy(secs: number): { phase: string; sub: string } {
  if (secs > 900)
    return { phase: 'The final hour', sub: 'Log out and back in before the start — your starting totals are set at logout.' };
  if (secs > 300) return { phase: 'Relog now', sub: 'Hiscores only save when you log out. That is what sets your starting totals.' };
  if (secs > 60) return { phase: 'Take your positions', sub: 'Your starting spot is drawn the moment the clock hits zero.' };
  if (secs > 10) return { phase: 'Final minute', sub: 'Plugin users: the arrow points you to the spot at zero.' };
  return { phase: 'Brace', sub: '' };
}

function compactGp(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

export default function FinalHourCountdown({
  name,
  iconUrl = null,
  bannerUrl = null,
  bannerPosition = null,
  hostName,
  prizePool,
  teamsCount,
  target,
  now,
}: Props) {
  const msLeft = target - now;
  const secs = Math.max(0, Math.ceil(msLeft / 1000));
  const live = msLeft <= 0;
  const heat = live ? 1 : 1 - Math.min(secs, 3600) / 3600;
  const heatRef = useRef(heat);
  useEffect(() => {
    heatRef.current = heat;
  }, [heat]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Embers rising off the base; more and faster as heat climbs. Skipped entirely for reduced motion.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cx = cv.getContext('2d');
    if (!cx) return;
    const dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;
    const size = () => {
      w = cv.width = cv.offsetWidth * dpr;
      h = cv.height = cv.offsetHeight * dpr;
    };
    size();
    window.addEventListener('resize', size);
    type P = { x: number; y: number; v: number; r: number; a: number };
    let ps: P[] = [];
    let raf = 0;
    const frame = () => {
      const k = heatRef.current;
      const want = 18 + k * 130;
      while (ps.length < want)
        ps.push({ x: Math.random() * w, y: h + Math.random() * 40, v: (0.4 + Math.random() * 1.4) * (1 + k * 1.5) * dpr, r: (0.6 + Math.random() * 1.8) * dpr, a: Math.random() * 6.28 });
      cx.clearRect(0, 0, w, h);
      ps = ps.filter((p) => p.y > -10).slice(0, Math.ceil(want) + 5);
      for (const p of ps) {
        p.y -= p.v;
        p.a += 0.03;
        p.x += Math.sin(p.a) * 0.6;
        const alpha = Math.min(1, p.y / h + 0.15);
        cx.fillStyle = `rgba(255,${Math.round(150 - k * 90)},${Math.round(40 - k * 30)},${alpha})`;
        cx.beginPath();
        cx.arc(p.x, p.y, p.r, 0, 6.28);
        cx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, []);

  const mins = Math.floor(Math.min(secs, 3600) / 60);
  const rem = Math.min(secs, 3600) % 60;
  const final10 = !live && secs <= 10;
  const pulse = !live && secs <= 60 && secs > 10;
  const copy = stepCopy(secs);
  const glow = `drop-shadow(0 0 ${6 + heat * 28}px rgba(255,${Math.round(140 - heat * 100)},40,${0.3 + heat * 0.6}))`;

  return (
    <div
      className={`relative mb-6 overflow-hidden rounded-2xl border bg-[#120c08] text-center ${pulse ? 'fh-beat' : ''} ${live ? 'fh-flash' : ''}`}
      style={{ borderColor: `rgba(255,${Math.round(190 - heat * 120)},60,${0.25 + heat * 0.5})` }}
      aria-live="polite"
    >
      {/* The event's own banner as the backdrop, pushing in slowly as the clock runs down. */}
      {bannerUrl && (
        <div className="pointer-events-none absolute inset-0">
          <MotionImg
            src={bannerUrl}
            className="h-full w-full object-cover opacity-35 transition-transform duration-1000"
            style={{ objectPosition: `50% ${bannerPosition ?? 50}%`, transform: `scale(${1.05 + heat * 0.15})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#120c08]/60 via-[#120c08]/70 to-[#120c08]" />
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 transition-[background] duration-1000"
        style={{ background: `radial-gradient(120% 90% at 50% 115%, rgba(255,106,26,${heat * 0.5}), transparent 60%)` }}
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="relative px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-3 flex justify-center">
          <ClanCrest name={hostName || name} logoUrl={iconUrl} size={64} rounded="rounded-2xl" className="border-2 border-gold/40 text-2xl shadow-lg shadow-black/40" />
        </div>
        {hostName && <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">{hostName}</div>}
        <h1 className="mt-1 break-words text-2xl font-extrabold leading-tight text-gold sm:text-4xl" style={{ textWrap: 'balance' }}>
          {name}
        </h1>

        {live ? (
          <div className="fh-slam mt-6 text-5xl font-black uppercase tracking-wide text-[#ffe9a8] sm:text-7xl" style={{ textShadow: '0 0 50px #ff6a1a' }}>
            It&apos;s live
          </div>
        ) : (
          <>
            <div className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-foreground sm:text-sm">{copy.phase}</div>
            {final10 ? (
              <div
                key={secs}
                className="fh-slam mt-2 text-[9rem] font-black leading-none text-[#ffe9a8] tabular-nums sm:text-[14rem]"
                style={{ textShadow: '0 0 40px #ff6a1a, 0 0 90px #d7262b' }}
              >
                {secs}
              </div>
            ) : (
              <div className="mt-3 flex items-start justify-center gap-2 font-mono tabular-nums sm:gap-3" style={{ filter: glow }}>
                {[
                  { v: mins, u: 'Minutes' },
                  { v: rem, u: 'Seconds' },
                ].map((s, i) => (
                  <div key={s.u} className="flex items-start gap-2 sm:gap-3">
                    {i > 0 && <span className="fh-blink text-6xl font-extrabold leading-none text-gold/60 sm:text-8xl">:</span>}
                    <div className="flex flex-col items-center">
                      <span className="bg-gradient-to-b from-[#ffe9a8] via-[#f2c14e] to-[#b07a1e] bg-clip-text text-7xl font-extrabold leading-none text-transparent sm:text-9xl">
                        {String(s.v).padStart(2, '0')}
                      </span>
                      <span className="mt-2 text-[10px] uppercase tracking-[0.28em] text-text-muted">{s.u}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mx-auto mt-6 h-1 max-w-md overflow-hidden rounded bg-white/10">
          <div className="h-full bg-gradient-to-r from-gold via-[#ff6a1a] to-[#d7262b] transition-[width] duration-1000 ease-linear" style={{ width: `${heat * 100}%` }} />
        </div>
        {!live && copy.sub && <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">{copy.sub}</p>}
        {live && <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">Drawing your starting spot…</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-muted">
          {prizePool > 0 && (
            <span>
              <span className="font-semibold text-gold">{compactGp(prizePool)} gp</span> on the line
            </span>
          )}
          <span>
            {teamsCount} team{teamsCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
