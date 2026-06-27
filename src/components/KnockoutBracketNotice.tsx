"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatRoundOf32Deadline,
  getRoundOf32LockAt,
} from "@/lib/knockout-bracket";
import type { Match } from "@/lib/types";

interface KnockoutBracketNoticeProps {
  bracketLocked: boolean;
  matches: Pick<Match, "stage" | "round" | "kickoff_at" | "status">[];
  picksOnSynced: number;
  syncedFixtures: number;
  expectedFixtures: number;
}

export function KnockoutBracketNotice({
  bracketLocked,
  matches,
  picksOnSynced,
  syncedFixtures,
  expectedFixtures,
}: KnockoutBracketNoticeProps) {
  const pathname = usePathname();
  const [dismissedPaths, setDismissedPaths] = useState<Record<string, true>>({});

  const dismissed = dismissedPaths[pathname] === true;

  const lockAt = getRoundOf32LockAt(matches);
  const deadlineLabel = formatRoundOf32Deadline(lockAt);
  const totalToPick = syncedFixtures > 0 ? syncedFixtures : expectedFixtures;
  const needsPicks = picksOnSynced < syncedFixtures || syncedFixtures === 0;

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
    setDismissedPaths((prev) => ({ ...prev, [pathname]: true }));
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
        className="absolute inset-0 bg-black/70"
        aria-label="Close notice"
        onClick={dismiss}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#FF007A]/40 bg-white shadow-2xl sm:max-w-lg">
        <div className="bg-gradient-to-r from-[#0a1628] via-[#0056b3] to-[#FF007A] px-5 py-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#FFD700]">
            Knockout Stage
          </p>
          <h2
            id="knockout-bracket-notice-title"
            className="mt-1 text-2xl font-black uppercase tracking-tight text-white"
          >
            Fill In Your Bracket
          </h2>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-center text-sm leading-relaxed text-gray-700">
            Submit your{" "}
            <strong className="text-gray-900">full NCAA-style bracket</strong> —
            winner and score for every knockout match — before lock at{" "}
            <strong className="text-gray-900">{deadlineLabel}</strong>. Group
            stage games can still be in progress.
          </p>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center">
            <p className="text-2xl font-black text-[#0056b3]">
              {picksOnSynced}/{totalToPick}
            </p>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Knockout matches picked
            </p>
          </div>

          {needsPicks && (
            <p className="mt-3 text-center text-xs font-medium text-[#FF007A]">
              Fill your bracket now — it locks when Round of 32 kicks off!
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={dismiss}
              className="min-h-11 flex-1 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-bold uppercase tracking-wide text-gray-700 transition hover:bg-gray-50"
            >
              Close
            </button>
            <Link
              href="/bracket"
              onClick={dismiss}
              className="min-h-11 flex-1 rounded-full bg-[#FF007A] px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:opacity-90"
            >
              Fill In Bracket
            </Link>
          </div>

          <Link
            href="/rules"
            onClick={dismiss}
            className="mt-4 block text-center text-xs font-medium text-[#0056b3] hover:underline"
          >
            View knockout rules
          </Link>
        </div>
      </div>
    </div>
  );
}
