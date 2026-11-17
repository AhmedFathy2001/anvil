'use client';

import type { ComponentPropsWithRef } from 'react';
import { twMerge } from 'tailwind-merge';

type Props = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  tone?: 'gold' | 'indigo';
};

/**
 * One option of a one-of choice, drawn by us instead of the browser. Still a real
 * `<input type="radio">` — arrow keys move within its `name` group, it submits with a form, a
 * wrapping `<label>` selects it — only `appearance-none` swaps the OS dot for ours (a filled ring
 * with a dark inset). Every input property passes through, so a call site swaps `<input type="radio"`
 * for `<Radio` and keeps its own layout. For a short row of choices, Segmented is the other option.
 *
 * It sits on the FIRST LINE of the text beside it, by itself: pinned to the top of the row and
 * pushed down by half of what a line of that text has to spare (`1lh` is the line height it
 * inherits, and it is 1rem tall). So a one-line label and a label with a description under it line
 * up the same way, and a call site needs neither `items-center` nor a hand-picked `mt-*`. A margin
 * passed in `className` still replaces it (tailwind-merge), for text that sets its own size inside
 * the label.
 */
export default function Radio({ tone = 'gold', className, ...rest }: Props) {
  return (
    <input
      type="radio"
      {...rest}
      className={twMerge(
        'm-0 mt-[calc((1lh-1rem)/2)] h-4 w-4 shrink-0 self-start cursor-[inherit] appearance-none rounded-full border border-text-dim/70 bg-brown-dark transition-colors',
        'hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
        'disabled:cursor-not-allowed',
        tone === 'indigo'
          ? 'checked:border-indigo-400 checked:bg-indigo-400 checked:shadow-[inset_0_0_0_3px_var(--brown-dark)]'
          : 'checked:border-gold checked:bg-gold checked:shadow-[inset_0_0_0_3px_var(--brown-dark)]',
        className,
      )}
    />
  );
}
