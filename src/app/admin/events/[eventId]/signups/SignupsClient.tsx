'use client';

import type { Event } from '@/lib/types';
import { useState } from 'react';
import SignupAdminPanel from '../SignupAdminPanel';
import type { SurveyQuestionView } from '@/lib/survey';

interface Props {
  event: Event;
  viewerRole: string;
  viewerId: number;
  confirmationsRequired: number;
  /** This board's own sign-up questions, so the panel can show answers under the right prompt. */
  signupQuestions: SurveyQuestionView[];
}

export default function SignupsClient({
  event,
  viewerRole,
  viewerId,
  confirmationsRequired,
  signupQuestions,
}: Props) {
  const [currentEvent, setCurrentEvent] = useState(event);
  return (
    <SignupAdminPanel
      event={currentEvent}
      onEventUpdated={setCurrentEvent}
      viewerRole={viewerRole}
      viewerId={viewerId}
      confirmationsRequired={confirmationsRequired}
      signupQuestions={signupQuestions}
    />
  );
}
