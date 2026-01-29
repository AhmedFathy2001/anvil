'use client';

import { useState, useEffect } from 'react';

interface Props {
  date: string | Date;
  format?: 'datetime' | 'date' | 'time';
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
      case 'time':
        result = d.toLocaleTimeString();
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
