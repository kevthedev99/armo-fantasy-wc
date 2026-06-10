"use client";

import { useMemo, useState } from "react";
import { isMatchLocked } from "@/lib/scoring";
import type { Match, Pick, Profile } from "@/lib/types";
import { PickReadOnlyCard } from "./PickReadOnlyCard";

interface UserPicksViewProps {
  profile: Profile;
  rank: number;
  picks: Pick[];
  matches: Match[];
  knockoutUnlocked: boolean;
  isCurrentUser: boolean;
}

function buildVisible(
  matches: Match[],
  pickMap: Map<number, Pick>,
  stage: "group" | "knockout"
) {
  return matches
    .filter((m) => m.stage === stage)
    .filter((match) => pickMap.has(match.id) || isMatchLocked(match))
    .map((match) => ({ match, pick: pickMap.get(match.id) }))
    .sort(
      (a, b) =>
        new Date(a.match.kickoff_at).getTime() -
        new Date(b.match.kickoff_at).getTime()
    );
}

export function UserPicksView({
  profile,
  rank,
  picks,
  matches,
  knockoutUnlocked,
  isCurrentUser,
}: UserPicksViewProps) {
  const [tab, setTab] = useState<"group" | "knockout">("group");

  const pickMap = useMemo(() => {
    const map = new Map<number, Pick>();
    picks.forEach((p) => map.set(p.match_id, p));
    return map;
  }, [picks]);

  const groupVisible = useMemo(
    () => buildVisible(matches, pickMap, "group"),
    [matches, pickMap]
  );
  const knockoutVisible = useMemo(
    () => buildVisible(matches, pickMap, "knockout"),
    [matches, pickMap]
  );

  const visible = tab === "group" ? groupVisible : knockoutVisible;
  const missedCount = visible.filter(
    (v) => !v.pick && isMatchLocked(v.match)
  ).length;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-black px-4 py-8 text-white md:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-black"
            style={{ backgroundColor: profile.avatar_color }}
          >
            {profile.display_name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-[#FFD700]">
              #{rank} · {isCurrentUser ? "Your Profile" : "Player Profile"}
            </p>
            <h1 className="break-words text-2xl font-black uppercase md:text-3xl">
              {profile.display_name}
            </h1>
            <p className="text-sm text-gray-400">@{profile.username}</p>
          </div>
          <div className="flex shrink-0 gap-6 text-center sm:text-right">
            <div>
              <p className="text-2xl font-black text-[#FFD700]">
                {profile.total_points}
              </p>
              <p className="text-[10px] uppercase text-gray-500">Points</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">
                {profile.total_wins}
              </p>
              <p className="text-[10px] uppercase text-gray-500">Wins</p>
            </div>
            <div>
              <p className="text-2xl font-black text-[#32CD32]">
                {profile.current_streak > 0 ? profile.current_streak : "—"}
              </p>
              <p className="text-[10px] uppercase text-gray-500">Streak</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 px-4 py-4 md:px-8">
        <button
          type="button"
          onClick={() => setTab("group")}
          className={`rounded-full px-5 py-2 text-xs font-bold uppercase ${
            tab === "group"
              ? "bg-[#FF007A] text-white"
              : "bg-white text-gray-700 ring-1 ring-gray-300"
          }`}
        >
          Group Stage ({groupVisible.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("knockout")}
          disabled={!knockoutUnlocked}
          className={`rounded-full px-5 py-2 text-xs font-bold uppercase ${
            tab === "knockout"
              ? "bg-[#FF007A] text-white"
              : "bg-white text-gray-700 ring-1 ring-gray-300"
          } ${!knockoutUnlocked ? "cursor-not-allowed opacity-50" : ""}`}
        >
          Knockout ({knockoutVisible.length})
          {!knockoutUnlocked && " · locked"}
        </button>
      </div>

      {missedCount > 0 && (
        <p className="px-4 pb-2 text-xs text-amber-800 md:px-8">
          {missedCount} started match{missedCount !== 1 ? "es" : ""} with no
          pick — locked at kickoff.
        </p>
      )}

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 sm:grid-cols-2 lg:grid-cols-3 md:px-8">
        {visible.length === 0 ? (
          <p className="col-span-full py-12 text-center text-gray-600">
            {isCurrentUser
              ? "No picks or started matches yet in this stage."
              : `${profile.display_name} has no picks or started matches in this stage yet.`}
          </p>
        ) : (
          visible.map(({ pick, match }) => (
            <PickReadOnlyCard key={match.id} match={match} pick={pick} />
          ))
        )}
      </div>
    </div>
  );
}
