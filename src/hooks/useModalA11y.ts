'use client';

import { useEffect, useRef } from 'react';

interface Options {
  onClose: () => void;
  /** Optional: disables the focus trap + initial focus (keeps ESC + scroll lock). */
  skipFocusManagement?: boolean;
  /**
   * Is this actually a modal? Default true.
   *
   * A docked side panel uses the same component as the drawer it replaces on narrow screens, and
   * inherited the drawer's modal behaviour with it — so opening a tile in the two-pane layout
   * locked the page's scroll and trapped Tab inside the panel, while the list it sits beside was
   * still right there to be scrolled and clicked. Pass false for a panel that lives IN the page:
   * Escape still closes it, and nothing else about the page changes.
   */
  modal?: boolean;
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
// The page's scroll is held while ANY modal is open, counted: each modal used to remember the value it
// found and put it back on close, so a modal opened over another (a combo part's proofs over its
// tile) remembered "hidden" and left the page unable to scroll once both had closed.
let scrollLocks = 0;
let scrollBefore = '';
function lockPageScroll() {
  if (scrollLocks++ === 0) {
    scrollBefore = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}
function unlockPageScroll() {
  if (scrollLocks > 0 && --scrollLocks === 0) document.body.style.overflow = scrollBefore;
}

export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  onClose,
  skipFocusManagement,
  modal = true,
}: Options) {
  const trapped = modal && !skipFocusManagement;
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

    if (trapped) {
      const focusables = getFocusable();
      (focusables[0] ?? el).focus({ preventScroll: true });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !trapped) return;

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

    // Only a real modal takes the page's scroll away — an in-page panel leaves it alone.
    if (modal) lockPageScroll();
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (modal) unlockPageScroll();
      if (trapped) previouslyFocused?.focus?.();
    };
  }, [onClose, skipFocusManagement, modal, trapped]);

  return ref;
}
