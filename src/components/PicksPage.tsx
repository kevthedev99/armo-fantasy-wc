"use client";

import { useMemo, useState } from "react";
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

export function PicksPage({ matches, picks: initialPicks, settings }: PicksPageProps) {
  const [picks, setPicks] = useState(initialPicks);
  const [tab, setTab] = useState<"group" | "knockout">("group");

  const pickMap = useMemo(() => {
    const map = new Map<number, Pick>();
    picks.forEach((p) => map.set(p.match_id, p));
    return map;
  }, [picks]);

  const groupMatches = matches.filter((m) => m.stage === "group");
  const knockoutMatches = matches.filter((m) => m.stage === "knockout");

  const visibleMatches = tab === "group" ? groupMatches : knockoutMatches;

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
      <header className="bg-[#0056b3] px-6 py-8 text-white">
        <h1 className="text-4xl font-black uppercase tracking-tight md:text-5xl">
          Matches
        </h1>
        <p className="mt-2 text-sm uppercase tracking-wide text-white/80">
          Group stage fixtures — make your picks before kickoff.
        </p>
      </header>

      <p className="border-b border-gray-200 bg-white px-6 py-3 text-xs text-gray-600">
        Change picks anytime before kickoff — once a match starts, picks lock
        permanently. Group stage: pick winner (or tie) and exact score for
        bonus. Knockouts: pick winner and when the winning goal was scored.
      </p>

      <div className="flex flex-wrap gap-2 px-6 py-4">
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
          <div className="flex flex-wrap gap-2">
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
          Knockout picks unlock automatically once every group stage match is
          finished.
        </p>
      ) : visibleMatches.length === 0 ? (
        <p className="px-6 py-12 text-center text-gray-600">
          No matches loaded yet. Run the sync cron or check your API-Football
          key.
        </p>
      ) : (
        <div className="grid gap-4 px-6 pb-12 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              pick={pickMap.get(match.id)}
              onSaved={handleSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
