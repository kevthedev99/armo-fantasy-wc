"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import {
  formatRoundOf32StartLabel,
  ROUND_OF_32_START_DATE,
} from "@/lib/knockout-bracket";

interface KnockoutBracketNoticeProps {
  bracketLocked: boolean;
}

function storageKey(kickoffIso: string): string {
  return `knockout-bracket-notice-dismissed:${kickoffIso}`;
}

function readDismissed(kickoffIso: string): boolean {
  if (typeof window === "undefined") return true;
  return !!localStorage.getItem(storageKey(kickoffIso));
}

const dismissListeners = new Set<() => void>();

function subscribeDismiss(onChange: () => void) {
  dismissListeners.add(onChange);
  return () => {
    dismissListeners.delete(onChange);
  };
}

function notifyDismiss() {
  dismissListeners.forEach((listener) => listener());
}

function useBracketNoticeDismissed(kickoffIso: string) {
  return useSyncExternalStore(
    subscribeDismiss,
    () => readDismissed(kickoffIso),
    () => true
  );
}

export function KnockoutBracketNotice({
  bracketLocked,
}: KnockoutBracketNoticeProps) {
  const deadlineLabel = formatRoundOf32StartLabel();
  const dismissed = useBracketNoticeDismissed(ROUND_OF_32_START_DATE);

  const open = !bracketLocked && !dismissed;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function dismiss() {
    localStorage.setItem(storageKey(ROUND_OF_32_START_DATE), "1");
    notifyDismiss();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center sm:p-6"
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
      <div className="relative w-full max-w-md rounded-2xl border border-[#FF007A]/30 bg-white p-5 shadow-2xl sm:p-6">
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
            className="min-h-11 flex-1 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-bold uppercase tracking-wide text-gray-700 transition hover:bg-gray-50"
          >
            Close
          </button>
          <Link
            href="/rules"
            onClick={dismiss}
            className="min-h-11 flex-1 rounded-full bg-[#0056b3] px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-90"
          >
            Rules Page
          </Link>
        </div>
      </div>
    </div>
  );
}
