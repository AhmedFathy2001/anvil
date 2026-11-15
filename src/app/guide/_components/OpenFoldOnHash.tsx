'use client';

import { useEffect } from 'react';

/**
 * Open a folded guide section when the address (or a contents link) points at it, or at anything
 * inside it. Browsers open a closed <details> for a target inside it, not for the section around it,
 * so the contents list would otherwise land on a closed heading.
 */
export default function OpenFoldOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      const fold = el.querySelector(':scope > details') ?? el.closest('details');
      if (fold instanceof HTMLDetailsElement && !fold.open) {
        fold.open = true;
        el.scrollIntoView();
      }
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
