'use client';

import { useEffect, useState } from 'react';
import EventForm from '@/components/EventForm';

// Renders the "+ New event" button. Click opens a centered modal containing the
// event creation form. Putting the form in a modal (instead of inline) keeps the
// page layout stable — no surrounding sections shift around when the form opens.
export default function CreateEventToggle() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while modal is open. Cleaned up on unmount or close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors shadow-sm shadow-gold/20"
      >
        + New event
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-event-title"
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-2xl my-auto border border-gold/30 bg-card-bg rounded-2xl shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-card-border">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-gold rounded-full" />
                <h2 id="create-event-title" className="font-semibold text-lg">Create Event</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-text-muted hover:text-foreground rounded-md w-8 h-8 flex items-center justify-center hover:bg-brown-light transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <EventForm />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
