'use client';

import { useState, useEffect } from 'react';
import { parseStamp } from '@/lib/dbTime';
import { formatExactTime } from '@/lib/eventTime';

interface Props {
  date: string | Date;
  /** 'short' is "Jun 28, 8:00 PM" (lib/eventTime formatExactTime), read from either stored format. */
  format?: 'datetime' | 'date' | 'time' | 'short';
  className?: string;
}

export default function LocalTime({ date, format = 'datetime', className }: Props) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    const d = new Date(date);
    let result: string;

    switch (format) {
      case 'date':
        result = d.toLocaleDateString();
        break;
      case 'short':
        result = formatExactTime(typeof date === 'string' ? parseStamp(date) ?? d.getTime() : d.getTime());
        break;
      case 'time':
        result = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        break;
      default:
        result = d.toLocaleString();
    }

    setFormatted(result);
  }, [date, format]);

  // Show nothing during SSR to avoid hydration mismatch
  if (!formatted) return null;

  return <span className={className}>{formatted}</span>;
}
