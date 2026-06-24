"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import { getMatchBucket } from "@/lib/match-status";
import {
  formatRoundOf32Deadline,
  isKnockoutBracketLocked,
  isPickLocked,
  resolveRoundOf32Kickoff,
} from "@/lib/knockout-bracket";
import { isMatchFinished } from "@/lib/scoring";
import type { AppSettings, Match, Pick } from "@/lib/types";
import { MatchCard } from "./MatchCard";

interface PicksPageProps {
  matches: Match[];
  picks: Pick[];
  settings: AppSettings;
}

const KNOCKOUT_ROUNDS = [
  "Round of 32",
  "8th Finals",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "3rd Place Final",
  "Third place",
  "Final",
];

type PicksView = "upcoming" | "past";

function sortUpcoming(matches: Match[], allMatches: Match[]): Match[] {
  return [...matches]
    .filter((m) => !isMatchFinished(m.status))
    .sort((a, b) => {
      const aLive = getMatchBucket(a) === "live";
      const bLive = getMatchBucket(b) === "live";
      if (aLive !== bLive) return aLive ? -1 : 1;

      const aLocked = isPickLocked(a, allMatches);
      const bLocked = isPickLocked(b, allMatches);
      if (aLocked !== bLocked) return aLocked ? 1 : -1;

      return new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();
    });
}

function sortPast(matches: Match[]): Match[] {
  return [...matches]
    .filter((m) => isMatchFinished(m.status))
    .sort(
      (a, b) =>
        new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime()
    );
}

export function PicksPage({ matches, picks: initialPicks, settings }: PicksPageProps) {
  const [picks, setPicks] = useState(initialPicks);
  const [tab, setTab] = useState<"group" | "knockout">("group");
  const [view, setView] = useState<PicksView>("upcoming");

  const pickMap = useMemo(() => {
    const map = new Map<number, Pick>();
    picks.forEach((p) => map.set(p.match_id, p));
    return map;
  }, [picks]);

  const groupMatches = matches.filter((m) => m.stage === "group");
  const knockoutMatches = matches.filter((m) => m.stage === "knockout");

  const stageMatches = tab === "group" ? groupMatches : knockoutMatches;
  const visibleMatches =
    view === "past"
      ? sortPast(stageMatches)
      : sortUpcoming(stageMatches, matches);

  const bracketLocked = isKnockoutBracketLocked(matches);
  const ro32Kickoff = resolveRoundOf32Kickoff(matches);

  const lockedWithoutPick = visibleMatches.filter(
    (m) => isPickLocked(m, matches) && !pickMap.has(m.id)
  ).length;

  function handleSaved(pick: Pick) {
    setPicks((prev) => {
      const idx = prev.findIndex((p) => p.match_id === pick.match_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = pick;
        return next;
      }
      return [...prev, pick];
    });
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-[#0056b3] px-4 py-8 text-center text-white sm:px-6 sm:text-left">
        <h1 className="text-4xl font-black uppercase tracking-tight md:text-5xl">
          Matches
        </h1>
        <p className="mt-2 text-sm uppercase tracking-wide text-white/80">
          Group stage fixtures — make your picks before kickoff.
        </p>
      </header>

      <p className="border-b border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-600 sm:px-6 sm:text-left">
        Group stage: change picks until each match kicks off (+5 for exact
        score). Knockout: fill your full bracket before Round of 32 starts
        {` (${format(ro32Kickoff, "MMM d, h:mm a")})`} — then the entire
        bracket locks, like March Madness.
      </p>

      {tab === "knockout" &&
        settings.knockout_unlocked &&
        !bracketLocked && (
          <p className="border-b border-[#FF007A]/20 bg-[#FF007A]/5 px-4 py-2 text-center text-xs font-medium text-[#c4005f] sm:px-6 sm:text-left">
            Bracket open — submit every knockout pick before{" "}
            {formatRoundOf32Deadline(ro32Kickoff)}.
          </p>
        )}

      {view === "upcoming" && lockedWithoutPick > 0 && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:px-6 sm:text-left">
          {lockedWithoutPick} match{lockedWithoutPick !== 1 ? "es" : ""} already
          started with no pick — those are locked and cannot be changed.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-gray-200 bg-white px-4 py-4 sm:justify-start sm:px-6">
        <button
          type="button"
          onClick={() => setView("upcoming")}
          className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
            view === "upcoming"
              ? "bg-[#0056b3] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setView("past")}
          className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
            view === "past"
              ? "bg-[#0056b3] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Past Games
        </button>

        <span className="mx-1 hidden h-5 w-px bg-gray-300 sm:block" aria-hidden />

        <button
          type="button"
          onClick={() => setTab("group")}
          className={`rounded-full px-5 py-2 text-xs font-bold uppercase ${
            tab === "group"
              ? "bg-[#FF007A] text-white"
              : "bg-white text-gray-700 ring-1 ring-gray-300"
          }`}
        >
          Group Stage
        </button>
        <button
          type="button"
          onClick={() => setTab("knockout")}
          disabled={!settings.knockout_unlocked}
          className={`rounded-full px-5 py-2 text-xs font-bold uppercase ${
            tab === "knockout"
              ? "bg-[#FF007A] text-white"
              : "bg-white text-gray-700 ring-1 ring-gray-300"
          } ${!settings.knockout_unlocked ? "cursor-not-allowed opacity-50" : ""}`}
        >
          Knockout
          {!settings.knockout_unlocked && " (locked)"}
        </button>
        {tab === "knockout" && settings.knockout_unlocked && (
          <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-start">
            {KNOCKOUT_ROUNDS.filter((r) =>
              knockoutMatches.some((m) => m.round === r)
            ).map((round) => (
              <span
                key={round}
                className="rounded-full bg-[#0056b3]/10 px-3 py-1 text-[10px] font-bold uppercase text-[#0056b3]"
              >
                {round}
              </span>
            ))}
          </div>
        )}
      </div>

      {tab === "knockout" && !settings.knockout_unlocked ? (
        <p className="px-6 py-12 text-center text-gray-600">
          Knockout picks unlock once every group stage match is finished — then
          fill your full bracket before Round of 32 starts.
        </p>
      ) : visibleMatches.length === 0 ? (
        <p className="px-6 py-12 text-center text-gray-600">
          {view === "past"
            ? "No past games in this stage yet."
            : "No upcoming matches loaded yet. Run the sync cron or check your API-Football key."}
        </p>
      ) : (
        <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-4 px-4 pb-12 sm:max-w-none sm:grid-cols-2 sm:px-6 lg:max-w-7xl lg:grid-cols-3">
          {visibleMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              pick={pickMap.get(match.id)}
              allMatches={matches}
              onSaved={handleSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
