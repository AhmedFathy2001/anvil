'use client';

import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

// Themed multi-line input — the canonical look for every <textarea>. Same
// styling contract as Input: theme is baked in, twMerge lets `className` override.
type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={twMerge(
        'w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground placeholder:text-text-muted/60 focus:outline-none focus:border-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-y',
        className,
      )}
      {...rest}
    />
  );
});

export default Textarea;
