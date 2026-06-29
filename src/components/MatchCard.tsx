"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  KnockoutPickFields,
  outcomeModeFromPick,
  type KnockoutOutcomeMode,
} from "@/components/KnockoutPickFields";
import { useIsPickLocked } from "@/hooks/useIsPickLocked";
import { useTeamElimination } from "@/hooks/useTeamElimination";
import { getPickLockMessage } from "@/lib/knockout-bracket";
import {
  EliminatedTeamName,
  EliminationMark,
} from "@/components/EliminatedTeamName";
import { FinishedMatchPickSummary } from "@/components/FinishedMatchPickSummary";
import {
  formatScore,
  getMatchBucket,
  getStatusLabel,
} from "@/lib/match-status";
import {
  formatPickSummary,
  isMatchFinished,
  normalizeGroupScore,
  validateKnockoutPick,
  validatePickScores,
} from "@/lib/scoring";
import {
  isMatchSideEliminated,
} from "@/lib/team-elimination-display";
import type { Match, Pick, PickWinner } from "@/lib/types";

interface MatchCardProps {
  match: Match;
  pick?: Pick;
  allMatches: Match[];
  userPicks: Pick[];
  onSaved: (pick: Pick) => void;
}

export function MatchCard({
  match,
  pick,
  allMatches,
  userPicks,
  onSaved,
}: MatchCardProps) {
  const locked = useIsPickLocked(match, allMatches);
  const lockMessage = getPickLockMessage(match, allMatches);
  const checkEliminated = useTeamElimination(userPicks, allMatches);
  const homeEliminated = isMatchSideEliminated(match, "home", checkEliminated);
  const awayEliminated = isMatchSideEliminated(match, "away", checkEliminated);
  const isKnockout = match.stage === "knockout";
  const [pickedWinner, setPickedWinner] = useState<PickWinner>(
    pick?.picked_winner ?? "home"
  );
  const [homeScore, setHomeScore] = useState(
    pick?.home_score_pred != null ? String(pick.home_score_pred) : "0"
  );
  const [awayScore, setAwayScore] = useState(
    pick?.away_score_pred != null ? String(pick.away_score_pred) : "0"
  );
  const [outcomeMode, setOutcomeMode] = useState<KnockoutOutcomeMode>(
    isKnockout ? outcomeModeFromPick(pick) : "regulation"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedHome = normalizeGroupScore(homeScore);
  const resolvedAway = normalizeGroupScore(awayScore);

  const isLive = getMatchBucket(match) === "live";
  const summary = pick ? formatPickSummary(match, pick) : null;

  const winnerOptions: ReadonlyArray<readonly [PickWinner, string]> = isKnockout
    ? [
        ["home", match.home_team_name],
        ["away", match.away_team_name],
      ]
    : [
        ["home", match.home_team_name],
        ["draw", "Tie"],
        ["away", match.away_team_name],
      ];

  async function savePick() {
    if (locked) return;

    setSaving(true);
    setError(null);

    const predictsPenalties = isKnockout && outcomeMode === "penalties";
    const homeScorePred = predictsPenalties
      ? null
      : normalizeGroupScore(homeScore);
    const awayScorePred = predictsPenalties
      ? null
      : normalizeGroupScore(awayScore);

    const scoreError = isKnockout
      ? validateKnockoutPick(
          pickedWinner,
          homeScorePred ?? 0,
          awayScorePred ?? 0,
          predictsPenalties
        )
      : validatePickScores(
          pickedWinner,
          homeScorePred ?? 0,
          awayScorePred ?? 0
        );
    if (scoreError) {
      setSaving(false);
      setError(scoreError);
      return;
    }

    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        pickedWinner,
        homeScorePred,
        awayScorePred,
        ...(isKnockout ? { predictsPenalties } : {}),
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

  const previewPick = {
    ...pick,
    picked_winner: pickedWinner,
    home_score_pred:
      isKnockout && outcomeMode === "penalties" ? null : resolvedHome,
    away_score_pred:
      isKnockout && outcomeMode === "penalties" ? null : resolvedAway,
    predicts_penalties: isKnockout && outcomeMode === "penalties",
  } as Pick;

  const cardClass = isLive
    ? pick
      ? "border-red-400 bg-red-50/70 ring-2 ring-red-200"
      : "border-red-400 bg-red-50 ring-2 ring-red-200"
    : locked
      ? pick
        ? "border-gray-300 bg-gray-50"
        : "border-amber-300 bg-amber-50/80"
      : "border-gray-200 bg-white";

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm ${cardClass} ${locked && !isLive ? "opacity-95" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        {match.group_name ? (
          <span className="rounded-full bg-[#0056b3] px-3 py-1 text-[10px] font-bold uppercase text-white">
            {match.group_name}
          </span>
        ) : (
          <span className="rounded-full bg-[#0056b3] px-3 py-1 text-[10px] font-bold uppercase text-white">
            {match.round}
          </span>
        )}
        <div className="text-right">
          {isLive ? (
            <span className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase text-red-600">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              Live · {getStatusLabel(match.status)}
            </span>
          ) : (
            <time className="block text-[10px] font-medium uppercase text-gray-500">
              {format(new Date(match.kickoff_at), "EEE, MMM d, h:mm a")}
            </time>
          )}
          {isLive && match.home_score !== null && match.away_score !== null && (
            <span className="text-[10px] font-bold text-red-700">
              {formatScore(match)}
            </span>
          )}
          {isMatchFinished(match.status) &&
            match.home_score !== null &&
            match.away_score !== null && (
              <span className="text-[10px] font-bold text-[#0056b3]">
                FT {match.home_score}-{match.away_score}
              </span>
            )}
        </div>
      </div>

      <div className="mb-4 flex flex-col items-center gap-2">
        {isLive && match.home_score !== null && match.away_score !== null && (
          <p className="font-display text-2xl font-black tracking-wide text-red-700">
            {formatScore(match)}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-black uppercase">
        {match.home_team_logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={match.home_team_logo}
            alt=""
            className={`h-5 w-5 object-contain ${homeEliminated ? "grayscale opacity-70" : ""}`}
          />
        )}
        <EliminatedTeamName
          name={match.home_team_name}
          eliminated={homeEliminated}
        />
        <span className="text-gray-400">vs</span>
        <EliminatedTeamName
          name={match.away_team_name}
          eliminated={awayEliminated}
        />
        {match.away_team_logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={match.away_team_logo}
            alt=""
            className={`h-5 w-5 object-contain ${awayEliminated ? "grayscale opacity-70" : ""}`}
          />
        )}
        </div>
      </div>

      {locked ? (
        <>
          {isMatchFinished(match.status) ? (
            <FinishedMatchPickSummary match={match} pick={pick} size="sm" />
          ) : (
            <>
              {pick && summary ? (
                <div className="mb-3 flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
                      isLive ? "bg-red-600" : "bg-gray-500"
                    }`}
                  >
                    {isLive ? "Live pick" : "Locked pick"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      isLive
                        ? "bg-red-100 text-red-800"
                        : "bg-[#32CD32]/15 text-[#1a7a1a]"
                    }`}
                  >
                    {summary}
                  </span>
                </div>
              ) : (
                <div className="mb-3 rounded-lg border border-amber-400/60 bg-amber-100/80 px-3 py-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-900">
                    No pick made
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800">
                    This match is locked — you can&apos;t add or change a pick now.
                  </p>
                </div>
              )}
            </>
          )}
          <p className="text-center text-xs font-medium text-gray-500">
            🔒 {lockMessage || "Locked — match has started"}
          </p>
        </>
      ) : (
        <>
          {summary && (
            <div className="mb-3 flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <span className="rounded-full bg-[#32CD32] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                Saved
              </span>
              <span className="rounded-full bg-[#32CD32]/15 px-3 py-1 text-xs font-bold uppercase text-[#1a7a1a]">
                {formatPickSummary(match, previewPick)}
              </span>
            </div>
          )}

          {isKnockout ? (
            <KnockoutPickFields
              match={match}
              outcomeMode={outcomeMode}
              onOutcomeModeChange={setOutcomeMode}
              pickedWinner={pickedWinner}
              onPickedWinnerChange={setPickedWinner}
              homeScore={homeScore}
              awayScore={awayScore}
              onHomeScoreChange={setHomeScore}
              onAwayScoreChange={setAwayScore}
              homeEliminated={homeEliminated}
              awayEliminated={awayEliminated}
            />
          ) : (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {winnerOptions.map(([value, label]) => {
                  const eliminated =
                    value === "home"
                      ? homeEliminated
                      : value === "away"
                        ? awayEliminated
                        : false;
                  return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPickedWinner(value)}
                    className={`rounded-lg border px-2 py-2 text-[10px] font-bold uppercase transition md:text-xs ${
                      pickedWinner === value
                        ? "border-[#0056b3] bg-[#0056b3] text-white"
                        : "border-gray-300 bg-white text-gray-800 hover:border-[#0056b3]"
                    } ${eliminated ? "opacity-70" : ""}`}
                  >
                    <span className={eliminated ? "line-through decoration-red-400/80" : ""}>
                      {label.length > 12 ? `${label.slice(0, 10)}…` : label}
                    </span>
                    {eliminated && (
                      <span className="ml-1 inline-flex align-middle">
                        <EliminationMark className="h-3.5 w-3.5 text-[9px]" />
                      </span>
                    )}
                  </button>
                  );
                })}
              </div>

              <div className="mb-2 flex items-center justify-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={20}
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
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
                  placeholder="0"
                />
              </div>
              <p className="mb-3 text-center text-[10px] text-gray-500">
                Scores default to 0-0. Scores must match your chosen winner for
                the +5 bonus.
              </p>
            </>
          )}

          {error && (
            <p className="mb-2 text-center text-xs text-red-600">{error}</p>
          )}

          <button
            type="button"
            onClick={savePick}
            disabled={saving}
            className="w-full rounded-lg bg-[#0056b3] py-2 text-sm font-bold uppercase text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : pick ? "Update Pick" : "Save Pick"}
          </button>
        </>
      )}
    </article>
  );
}
