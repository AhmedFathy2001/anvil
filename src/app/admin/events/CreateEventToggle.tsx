'use client';

import { useState } from 'react';
import EventForm from '@/components/EventForm';

export default function CreateEventToggle() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors"
      >
        + New event
      </button>
    );
  }

  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Create Event
        </h2>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-text-muted hover:text-foreground underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      </div>
      <EventForm />
    </div>
  );
}
