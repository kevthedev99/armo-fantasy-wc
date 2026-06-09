"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  formatPickSummary,
  getMatchLockMessage,
  isMatchFinished,
  isMatchLocked,
} from "@/lib/scoring";
import type { Match, Pick, PickWinner } from "@/lib/types";

interface MatchCardProps {
  match: Match;
  pick?: Pick;
  onSaved: (pick: Pick) => void;
}

export function MatchCard({ match, pick, onSaved }: MatchCardProps) {
  const locked = isMatchLocked(match);
  const lockMessage = getMatchLockMessage(match);
  const [pickedWinner, setPickedWinner] = useState<PickWinner>(
    pick?.picked_winner ?? "home"
  );
  const [homeScore, setHomeScore] = useState(
    pick?.home_score_pred?.toString() ?? ""
  );
  const [awayScore, setAwayScore] = useState(
    pick?.away_score_pred?.toString() ?? ""
  );
  const [goalMinute, setGoalMinute] = useState(
    pick?.winning_goal_minute_pred?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = formatPickSummary(match, {
    ...pick,
    picked_winner: pickedWinner,
    home_score_pred: homeScore ? parseInt(homeScore, 10) : null,
    away_score_pred: awayScore ? parseInt(awayScore, 10) : null,
  } as Pick);

  async function savePick() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        pickedWinner,
        homeScorePred: homeScore !== "" ? parseInt(homeScore, 10) : null,
        awayScorePred: awayScore !== "" ? parseInt(awayScore, 10) : null,
        winningGoalMinutePred:
          goalMinute !== "" ? parseInt(goalMinute, 10) : null,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save pick.");
      return;
    }

    onSaved(data.pick);
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        {match.group_name && (
          <span className="rounded-full bg-[#0056b3] px-3 py-1 text-[10px] font-bold uppercase text-white">
            {match.group_name}
          </span>
        )}
        {!match.group_name && (
          <span className="rounded-full bg-[#0056b3] px-3 py-1 text-[10px] font-bold uppercase text-white">
            {match.round}
          </span>
        )}
        <div className="text-right">
          <time className="block text-[10px] font-medium uppercase text-gray-500">
            {format(new Date(match.kickoff_at), "EEE, MMM d, h:mm a")}
          </time>
          {isMatchFinished(match.status) &&
            match.home_score !== null &&
            match.away_score !== null && (
              <span className="text-[10px] font-bold text-[#0056b3]">
                FT {match.home_score}-{match.away_score}
              </span>
            )}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-center gap-2 text-center text-sm font-black uppercase">
        {match.home_team_logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={match.home_team_logo}
            alt=""
            className="h-5 w-5 object-contain"
          />
        )}
        <span className="truncate">{match.home_team_name}</span>
        <span className="text-gray-400">vs</span>
        <span className="truncate">{match.away_team_name}</span>
        {match.away_team_logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={match.away_team_logo}
            alt=""
            className="h-5 w-5 object-contain"
          />
        )}
      </div>

      {summary && (
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-[#32CD32] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Pick
          </span>
          <span className="rounded-full bg-[#32CD32]/15 px-3 py-1 text-xs font-bold uppercase text-[#1a7a1a]">
            {summary}
          </span>
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2">
        {(
          [
            ["home", match.home_team_name],
            ["draw", "Tie"],
            ["away", match.away_team_name],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={locked}
            onClick={() => setPickedWinner(value)}
            className={`rounded-lg border px-2 py-2 text-[10px] font-bold uppercase transition md:text-xs ${
              pickedWinner === value
                ? "border-[#0056b3] bg-[#0056b3] text-white"
                : "border-gray-300 bg-white text-gray-800 hover:border-[#0056b3]"
            } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {label.length > 12 ? `${label.slice(0, 10)}…` : label}
          </button>
        ))}
      </div>

      {match.stage === "group" ? (
        <>
          <div className="mb-2 flex items-center justify-center gap-2">
            <input
              type="number"
              min={0}
              max={20}
              disabled={locked}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
              placeholder="0"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              min={0}
              max={20}
              disabled={locked}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
              placeholder="0"
            />
          </div>
          <p className="mb-3 text-center text-[10px] text-gray-500">
            Pick a winner, then set both scores for the +5 bonus. Scores must
            match the chosen winner.
          </p>
        </>
      ) : (
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-medium uppercase text-gray-500">
            Winning goal minute (±5 for bonus)
          </label>
          <input
            type="number"
            min={1}
            max={130}
            disabled={locked}
            value={goalMinute}
            onChange={(e) => setGoalMinute(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. 78"
          />
        </div>
      )}

      {error && <p className="mb-2 text-center text-xs text-red-600">{error}</p>}

      {!locked ? (
        <button
          type="button"
          onClick={savePick}
          disabled={saving}
          className="w-full rounded-lg bg-[#0056b3] py-2 text-sm font-bold uppercase text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : pick ? "Update Pick" : "Save Pick"}
        </button>
      ) : (
        <p className="text-center text-xs font-medium text-gray-500">
          {lockMessage || "Locked — match has started"}
        </p>
      )}
    </article>
  );
}
