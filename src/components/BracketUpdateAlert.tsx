"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SCORING, getKnockoutBasePoints } from "@/lib/scoring";

export type FinalAlertMatch = {
  id: number;
  round: string;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  kickoff_at: string;
  status: string;
};

function Flag({
  src,
  name,
  size,
}: {
  src: string | null;
  name: string;
  size: "sm" | "lg";
}) {
  const box =
    size === "lg" ? "h-9 w-9 sm:h-14 sm:w-14" : "h-6 w-6 sm:h-8 sm:w-8";
  const text = size === "lg" ? "text-[10px] sm:text-xs" : "text-[8px] sm:text-[9px]";

  if (!src) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-500 ${box} ${text}`}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className={`shrink-0 object-contain ${box}`} />
  );
}

function MatchupRecap({
  label,
  match,
  size,
}: {
  label: string;
  match: FinalAlertMatch | null;
  size: "sm" | "lg";
}) {
  const isFinal = size === "lg";

  return (
    <div
      className={`rounded-xl border px-2.5 py-2 sm:px-4 sm:py-3 ${
        isFinal
          ? "border-[#FFD700]/40 bg-gradient-to-b from-[#fff8e1] to-white"
          : "border-orange-300/40 bg-orange-50/80"
      }`}
    >
      <p
        className={`text-center font-bold uppercase tracking-[0.18em] ${
          isFinal
            ? "text-[10px] text-[#b8860b] sm:text-xs"
            : "text-[9px] text-orange-700 sm:text-[10px]"
        }`}
      >
        {label}
      </p>

      {match ? (
        <div className="mt-1.5 flex items-center justify-center gap-1.5 sm:mt-3 sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <Flag
              src={match.home_team_logo}
              name={match.home_team_name}
              size={size}
            />
            <span
              className={`max-w-full truncate text-center font-black text-gray-900 ${
                isFinal ? "text-sm sm:text-lg" : "text-[11px] sm:text-sm"
              }`}
            >
              {match.home_team_name}
            </span>
          </div>
          <span
            className={`shrink-0 font-black text-gray-400 ${
              isFinal ? "text-sm sm:text-xl" : "text-[10px] sm:text-xs"
            }`}
          >
            VS
          </span>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <Flag
              src={match.away_team_logo}
              name={match.away_team_name}
              size={size}
            />
            <span
              className={`max-w-full truncate text-center font-black text-gray-900 ${
                isFinal ? "text-sm sm:text-lg" : "text-[11px] sm:text-sm"
              }`}
            >
              {match.away_team_name}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-center text-xs text-gray-500 sm:text-sm">
          Matchup loading…
        </p>
      )}
    </div>
  );
}

/** Shown once per site visit on any page — dismissible until the next full load. */
export function BracketUpdateAlert({
  thirdPlace,
  finalMatch,
}: {
  thirdPlace: FinalAlertMatch | null;
  finalMatch: FinalAlertMatch | null;
}) {
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

  const thirdPts = getKnockoutBasePoints("3rd Place Final");
  const finalPts = getKnockoutBasePoints("Final");
  const exactBonus = SCORING.group.exactScoreBonus;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
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
      <div className="relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#FFD700]/50 bg-white shadow-2xl">
        <div className="shrink-0 border-b border-[#FFD700]/30 bg-gradient-to-r from-[#0a1628] via-[#0056b3] to-[#FF007A] px-4 py-3 text-center sm:px-5 sm:py-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#FFD700] sm:text-[10px]">
            Alert Update
          </p>
          <h2
            id="bracket-update-alert-title"
            className="final-alert-title font-display mt-1 text-2xl uppercase tracking-wide sm:mt-2 sm:text-4xl"
          >
            The Final Is Here
          </h2>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3 sm:space-y-4 sm:p-6">
          <p className="text-center text-xs leading-snug text-gray-800 sm:text-sm sm:leading-relaxed">
            There are{" "}
            <strong className="text-gray-900">two games remaining</strong> — the
            Third Place Match and the Final Match.
          </p>

          <MatchupRecap label="The Final" match={finalMatch} size="lg" />

          <MatchupRecap
            label="Third Place Match"
            match={thirdPlace}
            size="sm"
          />

          <div className="rounded-xl border border-[#0056b3]/20 bg-[#0056b3]/5 px-3 py-2.5 text-xs leading-snug text-gray-700 sm:px-4 sm:py-3 sm:text-sm sm:leading-relaxed">
            <p className="font-bold uppercase tracking-wide text-[#0056b3]">
              Point reminder
            </p>
            <ul className="mt-1.5 space-y-1 sm:mt-2 sm:space-y-1.5">
              <li>
                Third Place correct winner:{" "}
                <strong className="text-gray-900">+{thirdPts} pts</strong>
              </li>
              <li>
                Final correct winner:{" "}
                <strong className="text-gray-900">+{finalPts} pts</strong>
              </li>
              <li>
                Exact score bonus:{" "}
                <strong className="text-gray-900">+{exactBonus} pts</strong> on
                top
              </li>
            </ul>
          </div>

          <p className="rounded-xl border border-[#32CD32]/25 bg-[#32CD32]/5 px-3 py-2.5 text-xs leading-snug text-gray-700 sm:px-4 sm:py-3 sm:text-sm sm:leading-relaxed">
            Picks lock at kickoff. Check times on the{" "}
            <Link
              href="/games"
              onClick={() => setOpen(false)}
              className="font-bold text-[#0056b3] underline decoration-[#0056b3]/40 underline-offset-2 hover:text-[#FF007A]"
            >
              Games
            </Link>{" "}
            tab — all listed in Pacific time.
          </p>
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white px-3 py-2.5 sm:px-6 sm:py-4">
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
