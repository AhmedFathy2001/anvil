'use client';

import { useEffect } from 'react';

// Stops <input type="number"> from changing under you.
//
// Browsers step a focused number field on the mouse wheel and on ArrowUp/ArrowDown. On a long
// admin form that means scrolling the page past a field you just typed in silently rewrites it
// (a 500 KC goal becomes 497), and an arrow key meant for the caret nudges the value instead.
// One document-level listener covers every number input on the site, including ones added later,
// so no call site has to remember an onWheel handler.
//
// Wheel: the field is blurred rather than the event cancelled, so the page still scrolls and the
// value stays put. Blur commits like any other blur (NumberInput clamps, save-on-blur fields save),
// which is what leaving the field already does. Arrows: cancelled outright; the caret stays.
// The spinner buttons are hidden in globals.css.
function isNumberInput(el: EventTarget | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === 'number';
}

export default function NumberInputGuard() {
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      const el = document.activeElement;
      if (isNumberInput(el) && el === e.target) el.blur();
    }
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && isNumberInput(e.target)) e.preventDefault();
    }
    // Capture phase, so a component stopping propagation can't let a step through.
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true });
      document.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, []);
  return null;
}
