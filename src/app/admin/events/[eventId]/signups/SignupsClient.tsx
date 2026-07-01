'use client';

import type { Event } from '@/lib/types';
import { useState } from 'react';
import SignupAdminPanel from '../SignupAdminPanel';

interface Props {
  event: Event;
  viewerRole: string;
  viewerId: number;
  confirmationsRequired: number;
}

export default function SignupsClient({ event, viewerRole, viewerId, confirmationsRequired }: Props) {
  const [currentEvent, setCurrentEvent] = useState(event);
  return (
    <SignupAdminPanel
      event={currentEvent}
      onEventUpdated={setCurrentEvent}
      viewerRole={viewerRole}
      viewerId={viewerId}
      confirmationsRequired={confirmationsRequired}
    />
  );
}
