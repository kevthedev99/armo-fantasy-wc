"use client";

import { useEffect } from "react";

type BlockedTeamPickDialogProps = {
  blockedTeamName: string;
  lockedTeamName: string;
  onClose: () => void;
};

/** Shown when a knockout winner button is blocked by NCAA bracket chaining. */
export function BlockedTeamPickDialog({
  blockedTeamName,
  lockedTeamName,
  onClose,
}: BlockedTeamPickDialogProps) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-team-pick-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-amber-300/60 bg-white p-5 shadow-2xl sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-600">
          Bracket locked
        </p>
        <h2
          id="blocked-team-pick-title"
          className="mt-2 text-lg font-black uppercase tracking-tight text-gray-900"
        >
          Cannot select {blockedTeamName}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          You chose a different team to advance in an earlier round, so you
          cannot pick <strong className="text-gray-900">{blockedTeamName}</strong>{" "}
          here. Your bracket path locks you to{" "}
          <strong className="text-gray-900">{lockedTeamName}</strong> for this
          match. You can still change the score until kickoff.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-11 w-full rounded-full bg-[#0056b3] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
