'use client';

import { useEffect, useState } from 'react';
import { endsInLabel } from './endsIn';

/** "It ends Nov 20, 18:00 (in 3 days)." in the viewer's own time zone; nothing until the browser has the time. */
export default function EndsAt({ endDate }: { endDate: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return;
    const left = endsInLabel(end.getTime(), Date.now());
    const when = end.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    setText(left ? `It ends ${when} (${left}).` : '');
  }, [endDate]);
  return text ? <> {text}</> : null;
}
