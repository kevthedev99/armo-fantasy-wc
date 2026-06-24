"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatRoundOf32Deadline,
  getRoundOf32Kickoff,
} from "@/lib/knockout-bracket";
import type { Match } from "@/lib/types";

interface KnockoutBracketNoticeProps {
  matches: Match[];
  knockoutUnlocked: boolean;
  bracketLocked: boolean;
}

function storageKey(kickoffIso: string): string {
  return `knockout-bracket-notice-dismissed:${kickoffIso}`;
}

function readDismissed(kickoffIso: string | null): boolean {
  if (!kickoffIso || typeof window === "undefined") return true;
  return !!localStorage.getItem(storageKey(kickoffIso));
}

export function KnockoutBracketNotice({
  matches,
  knockoutUnlocked,
  bracketLocked,
}: KnockoutBracketNoticeProps) {
  const ro32Kickoff = getRoundOf32Kickoff(matches);
  const kickoffIso = ro32Kickoff?.toISOString() ?? null;
  const deadlineLabel = ro32Kickoff
    ? formatRoundOf32Deadline(ro32Kickoff)
    : null;

  const [dismissed, setDismissed] = useState(() => readDismissed(kickoffIso));

  const open =
    knockoutUnlocked && !bracketLocked && !!deadlineLabel && !dismissed;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function dismiss() {
    if (kickoffIso) {
      localStorage.setItem(storageKey(kickoffIso), "1");
    }
    setDismissed(true);
  }

  if (!open || !deadlineLabel) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="knockout-bracket-notice-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close notice"
        onClick={dismiss}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[#FF007A]/30 bg-white p-6 shadow-2xl">
        <h2
          id="knockout-bracket-notice-title"
          className="text-center text-sm font-black uppercase tracking-wide text-[#FF007A]"
        >
          Knockout Bracket
        </h2>
        <p className="mt-4 text-center text-sm leading-relaxed text-gray-700">
          You must submit all knockout picks before the Round of 32 starts on{" "}
          <strong className="text-gray-900">{deadlineLabel}</strong> — see the
          Rules page for details.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-bold uppercase tracking-wide text-gray-700 transition hover:bg-gray-50"
          >
            Close
          </button>
          <Link
            href="/rules"
            onClick={dismiss}
            className="flex-1 rounded-full bg-[#0056b3] px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-90"
          >
            Rules Page
          </Link>
        </div>
      </div>
    </div>
  );
}
