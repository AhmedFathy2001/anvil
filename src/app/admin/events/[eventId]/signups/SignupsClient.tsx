'use client';

import type { Event } from '@/lib/types';
import { useState } from 'react';
import SignupAdminPanel from '../SignupAdminPanel';

export default function SignupsClient({ event }: { event: Event }) {
  const [currentEvent, setCurrentEvent] = useState(event);
  return <SignupAdminPanel event={currentEvent} onEventUpdated={setCurrentEvent} />;
}
