'use client';

import { useEffect, useRef } from 'react';

interface Options {
  onClose: () => void;
  /** Optional: disables the focus trap + initial focus (keeps ESC + scroll lock). */
  skipFocusManagement?: boolean;
}

/**
 * Wires up keyboard and focus accessibility for a modal:
 *   - Escape key closes it
 *   - Tab / Shift+Tab cycles within the modal only (focus trap)
 *   - First focusable element is focused on mount
 *   - Previously focused element gets focus back on unmount
 *   - Document scroll is locked while open
 *
 * Usage:
 *   const ref = useModalA11y({ onClose });
 *   <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="title">…</div>
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  onClose,
  skipFocusManagement,
}: Options) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] => {
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.hasAttribute('disabled') && !node.getAttribute('aria-hidden'));
    };

    if (!skipFocusManagement) {
      const focusables = getFocusable();
      (focusables[0] ?? el).focus({ preventScroll: true });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || skipFocusManagement) return;

      const focusables = getFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose, skipFocusManagement]);

  return ref;
}
