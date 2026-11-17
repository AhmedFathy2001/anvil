'use client';

import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';

const ACTIVE = '[aria-current], [aria-selected="true"], [data-active="true"]';

/**
 * A strip that scrolls sideways (a tab row) and says so: on phones a soft fade shows on whichever
 * edge has more beyond it, and the active tab is scrolled into view when the strip first shows it.
 * Pass the strip's own classes (overflow-x-auto etc.) as `className`; the fade only applies under
 * 640px (globals.css .tab-fade), so desktop is unchanged. Mark the active child with aria-current.
 */
export default function ScrollStrip({
  as: Tag = 'nav',
  className = '',
  style,
  children,
  ...rest
}: { as?: 'nav' | 'div' } & ComponentPropsWithoutRef<'nav'>) {
  const ref = useRef<HTMLElement | null>(null);
  const lastActive = useRef<Element | null>(null);
  const [edges, setEdges] = useState({ l: 0, r: 0 });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const l = el.scrollLeft > 4 ? 28 : 0;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4 ? 28 : 0;
    setEdges((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Bring a newly active tab into view (only when it changes, so a manual scroll is not undone).
    const active = el.querySelector(ACTIVE);
    if (active && active !== lastActive.current) {
      lastActive.current = active;
      const a = active.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      if (a.left < b.left + 28 || a.right > b.right - 28) {
        el.scrollLeft += a.left - b.left - (b.width - a.width) / 2;
      }
    }
    measure();
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return (
    <Tag
      {...rest}
      ref={ref as never}
      onScroll={measure}
      className={`tab-fade ${className}`}
      style={{ ...style, ['--fade-l' as string]: `${edges.l}px`, ['--fade-r' as string]: `${edges.r}px` }}
    >
      {children}
    </Tag>
  );
}
