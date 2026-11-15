"use client";

import { useEffect, useState } from "react";
import EventForm from "@/components/EventForm";
import DialogFrame from "@/components/DialogFrame";

// Renders the "+ New event" button. Click opens a centered modal containing the
// event creation form. Putting the form in a modal (instead of inline) keeps the
// page layout stable — no surrounding sections shift around when the form opens.
export default function CreateEventToggle() {
  const [open, setOpen] = useState(false);
  // Typed-in form: closing asks first (DialogFrame -> useGuardedClose).
  const [dirty, setDirty] = useState(false);
  const close = () => {
    setDirty(false);
    setOpen(false);
  };

  // Lock body scroll while modal is open. Cleaned up on unmount or close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
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
        <DialogFrame
          dirty={dirty}
          onClose={close}
          ariaLabel="Create event"
          overlayClassName="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          panelClassName="relative w-full max-w-4xl border border-gold/30 bg-card-bg rounded-2xl shadow-2xl shadow-black/50"
        >
          {(requestClose) => (
            <>
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-card-border">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-5 bg-gold rounded-full" />
                  <h2 className="font-semibold text-lg">Create Event</h2>
                </div>
                <button
                  onClick={requestClose}
                  aria-label="Close"
                  className="text-text-muted hover:text-foreground rounded-md w-8 h-8 flex items-center justify-center hover:bg-brown-light transition-colors"
                >
                  ×
                </button>
              </div>
              <div className="p-6">
                <EventForm onDirtyChange={setDirty} />
              </div>
            </>
          )}
        </DialogFrame>
      )}
    </>
  );
}
