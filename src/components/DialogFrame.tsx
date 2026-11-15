'use client';

import type { ReactNode } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useGuardedClose } from '@/components/UnsavedChanges';

/**
 * The shared frame for the tile-authoring dialogs (Skill XP, KC, collection log, library, Add team).
 * Escape, the backdrop, the x and any Cancel button all go through ONE close function, which asks
 * "Discard what you typed?" first while `dirty` is true. `children` gets that function.
 */
export default function DialogFrame({
  dirty,
  onClose,
  overlayClassName,
  panelClassName,
  ariaLabel,
  children,
}: {
  dirty: boolean;
  onClose: () => void;
  overlayClassName: string;
  panelClassName: string;
  ariaLabel: string;
  children: (requestClose: () => void) => ReactNode;
}) {
  const requestClose = useGuardedClose(dirty, onClose);
  const ref = useModalA11y<HTMLDivElement>({ onClose: requestClose });
  return (
    <div className={overlayClassName} onClick={requestClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`${panelClassName} focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {children(requestClose)}
      </div>
    </div>
  );
}
