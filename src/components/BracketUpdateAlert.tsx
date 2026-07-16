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
    size === "lg"
      ? "h-12 w-12 sm:h-14 sm:w-14"
      : "h-7 w-7 sm:h-8 sm:w-8";
  const text = size === "lg" ? "text-xs" : "text-[9px]";

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
      className={`rounded-xl border px-3 py-3 sm:px-4 ${
        isFinal
          ? "border-[#FFD700]/40 bg-gradient-to-b from-[#fff8e1] to-white"
          : "border-orange-300/40 bg-orange-50/80"
      }`}
    >
      <p
        className={`text-center font-bold uppercase tracking-[0.2em] ${
          isFinal
            ? "text-[11px] text-[#b8860b] sm:text-xs"
            : "text-[10px] text-orange-700"
        }`}
      >
        {label}
      </p>

      {match ? (
        <div
          className={`mt-2 flex items-center justify-center gap-2 sm:gap-3 ${
            isFinal ? "mt-3" : ""
          }`}
        >
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <Flag
              src={match.home_team_logo}
              name={match.home_team_name}
              size={size}
            />
            <span
              className={`max-w-full truncate text-center font-black text-gray-900 ${
                isFinal ? "text-base sm:text-lg" : "text-xs sm:text-sm"
              }`}
            >
              {match.home_team_name}
            </span>
          </div>
          <span
            className={`shrink-0 font-black text-gray-400 ${
              isFinal ? "text-lg sm:text-xl" : "text-xs"
            }`}
          >
            VS
          </span>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <Flag
              src={match.away_team_logo}
              name={match.away_team_name}
              size={size}
            />
            <span
              className={`max-w-full truncate text-center font-black text-gray-900 ${
                isFinal ? "text-base sm:text-lg" : "text-xs sm:text-sm"
              }`}
            >
              {match.away_team_name}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-center text-sm text-gray-500">
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
  const pensBonus = SCORING.knockout.penaltiesWinnerBonus;

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
      <div className="relative max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#FFD700]/50 bg-white shadow-2xl">
        <div className="sticky top-0 border-b border-[#FFD700]/30 bg-gradient-to-r from-[#0a1628] via-[#0056b3] to-[#FF007A] px-5 py-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#FFD700]">
            Alert Update
          </p>
          <h2
            id="bracket-update-alert-title"
            className="final-alert-title font-display mt-2 text-3xl uppercase tracking-wide sm:text-4xl"
          >
            The Final Is Here
          </h2>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <p className="text-center text-sm leading-relaxed text-gray-800">
            There are{" "}
            <strong className="text-gray-900">two games remaining</strong> — the
            Third Place Match and the Final Match.
          </p>

          <MatchupRecap
            label="Third Place Match"
            match={thirdPlace}
            size="sm"
          />

          <MatchupRecap label="The Final" match={finalMatch} size="lg" />

          <div className="rounded-xl border border-[#0056b3]/20 bg-[#0056b3]/5 px-4 py-3 text-sm leading-relaxed text-gray-700">
            <p className="font-bold uppercase tracking-wide text-[#0056b3]">
              Point reminder
            </p>
            <ul className="mt-2 space-y-1.5">
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
              <li>
                Penalties shootout winner bonus:{" "}
                <strong className="text-gray-900">+{pensBonus} pts</strong> (if
                you pick pens and the shootout winner is right)
              </li>
            </ul>
          </div>

          <p className="rounded-xl border border-[#32CD32]/25 bg-[#32CD32]/5 px-4 py-3 text-sm leading-relaxed text-gray-700">
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
