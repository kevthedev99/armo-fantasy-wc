"use client";

import { useEffect, useState } from "react";

/** Shown on each full site load — dismissible until the next reload. */
export function BracketUpdateAlert() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bracket-update-alert-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75"
        aria-label="Close alert"
        onClick={() => setOpen(false)}
      />
      <div className="relative max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#FFD700]/50 bg-white shadow-2xl">
        <div className="sticky top-0 border-b border-[#FFD700]/30 bg-gradient-to-r from-[#0a1628] via-[#0056b3] to-[#FF007A] px-5 py-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#FFD700]">
            Alert Update
          </p>
          <h2
            id="bracket-update-alert-title"
            className="mt-1 text-xl font-black uppercase tracking-tight text-white sm:text-2xl"
          >
            Knockout Bracket Change
          </h2>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-gray-800">
            Since there has been recent confusion with the Knockout Brackets, you
            can now{" "}
            <strong className="text-gray-900">
              modify your bracket up until each game starts
            </strong>
            . However, remember if you chose a team to move on deep and they get
            eliminated early, it affects your bracket down the line.
          </p>
          <p className="rounded-xl border border-[#0056b3]/20 bg-[#0056b3]/5 px-4 py-3 text-sm leading-relaxed text-gray-700">
            Picks lock when a match <strong className="text-gray-900">starts</strong>{" "}
            and cannot be changed after the game{" "}
            <strong className="text-gray-900">ends</strong>. If you expect
            penalties, pick only who wins the shootout — not the full-time score.
          </p>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 w-full rounded-full bg-[#FF007A] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
