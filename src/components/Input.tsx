'use client';

import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

// Themed text input — the canonical look for every <input> in the app (text,
// number, url, search, etc.). Bakes in the brown-dark/gold theme so callers stop
// repeating the same class string. twMerge lets any `className` cleanly override a
// baked default (e.g. pass `bg-card-bg` or `flex-1` and it wins over the default).
type Props = React.InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={twMerge(
        'w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground placeholder:text-text-muted/60 focus:outline-none focus:border-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    />
  );
});

export default Input;
