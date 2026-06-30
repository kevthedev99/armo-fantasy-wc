"use client";

import { useState } from "react";
import { BlockedTeamPickDialog } from "@/components/BlockedTeamPickDialog";
import { EliminationMark } from "@/components/EliminatedTeamName";
import type { Match, PickWinner } from "@/lib/types";
import { PENALTIES_PICK_SENTINEL } from "@/lib/pick-storage";

export type KnockoutOutcomeMode = "regulation" | "penalties";

interface KnockoutPickFieldsProps {
  match: Match;
  outcomeMode: KnockoutOutcomeMode;
  onOutcomeModeChange: (mode: KnockoutOutcomeMode) => void;
  pickedWinner: PickWinner;
  onPickedWinnerChange: (winner: PickWinner) => void;
  homeScore: string;
  awayScore: string;
  onHomeScoreChange: (value: string) => void;
  onAwayScoreChange: (value: string) => void;
  disabled?: boolean;
  homeEliminated?: boolean;
  awayEliminated?: boolean;
  /** When set, the winner cannot be changed (NCAA forced bracket path). */
  lockedWinner?: PickWinner | null;
}

export function KnockoutPickFields({
  match,
  outcomeMode,
  onOutcomeModeChange,
  pickedWinner,
  onPickedWinnerChange,
  homeScore,
  awayScore,
  onHomeScoreChange,
  onAwayScoreChange,
  disabled = false,
  homeEliminated = false,
  awayEliminated = false,
  lockedWinner = null,
}: KnockoutPickFieldsProps) {
  const penaltiesMode = outcomeMode === "penalties";
  const [blockedDialog, setBlockedDialog] = useState<{
    blockedTeamName: string;
    lockedTeamName: string;
  } | null>(null);

  const lockedTeamName =
    lockedWinner === "home"
      ? match.home_team_name
      : lockedWinner === "away"
        ? match.away_team_name
        : null;

  function renderWinnerButton(
    value: PickWinner,
    label: string,
    activeClass: string,
    hoverClass: string
  ) {
    const eliminated =
      value === "home" ? homeEliminated : value === "away" ? awayEliminated : false;
    const winnerLocked =
      lockedWinner != null && lockedWinner !== value;
    const teamName = value === "home" ? match.home_team_name : match.away_team_name;

    function handleClick() {
      if (disabled) return;
      if (winnerLocked && lockedTeamName) {
        setBlockedDialog({
          blockedTeamName: teamName,
          lockedTeamName,
        });
        return;
      }
      onPickedWinnerChange(value);
    }

    return (
      <button
        key={value}
        type="button"
        disabled={disabled}
        aria-disabled={winnerLocked || undefined}
        onClick={handleClick}
        className={`rounded-lg border px-2 py-2 text-[10px] font-bold uppercase transition md:text-xs ${
          pickedWinner === value
            ? activeClass
            : `border-gray-300 bg-white text-gray-800 ${winnerLocked ? "" : hoverClass}`
        } ${eliminated ? "opacity-70" : ""} ${
          winnerLocked ? "cursor-not-allowed opacity-55" : ""
        }`}
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
  }

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOutcomeModeChange("regulation")}
          className={`rounded-lg border px-2 py-2 text-[10px] font-bold uppercase transition md:text-xs ${
            !penaltiesMode
              ? "border-[#0056b3] bg-[#0056b3] text-white"
              : "border-gray-300 bg-white text-gray-800 hover:border-[#0056b3]"
          }`}
        >
          Full Time Score
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOutcomeModeChange("penalties")}
          className={`rounded-lg border px-2 py-2 text-[10px] font-bold uppercase transition md:text-xs ${
            penaltiesMode
              ? "border-[#0056b3] bg-[#0056b3] text-white"
              : "border-gray-300 bg-white text-gray-800 hover:border-[#0056b3]"
          }`}
        >
          Penalties
        </button>
      </div>

      {penaltiesMode ? (
        <>
          <p className="mb-3 text-center text-[10px] leading-relaxed text-gray-600">
            Pick who wins the shootout — no pen score needed. Earn the{" "}
            <strong>round points</strong> if it goes to penalties,{" "}
            <strong>+5</strong> more for the right winner.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {renderWinnerButton(
              "home",
              match.home_team_name,
              "border-[#FF007A] bg-[#FF007A] text-white",
              "hover:border-[#FF007A]"
            )}
            {renderWinnerButton(
              "away",
              match.away_team_name,
              "border-[#FF007A] bg-[#FF007A] text-white",
              "hover:border-[#FF007A]"
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {renderWinnerButton(
              "home",
              match.home_team_name,
              "border-[#0056b3] bg-[#0056b3] text-white",
              "hover:border-[#0056b3]"
            )}
            {renderWinnerButton(
              "away",
              match.away_team_name,
              "border-[#0056b3] bg-[#0056b3] text-white",
              "hover:border-[#0056b3]"
            )}
          </div>

          <div className="mb-2 flex items-center justify-center gap-2">
            <input
              type="number"
              min={0}
              max={20}
              disabled={disabled}
              value={homeScore}
              onChange={(e) => onHomeScoreChange(e.target.value)}
              className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
              placeholder="0"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              min={0}
              max={20}
              disabled={disabled}
              value={awayScore}
              onChange={(e) => onAwayScoreChange(e.target.value)}
              className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
              placeholder="0"
            />
          </div>
          <p className="mb-3 text-center text-[10px] text-gray-500">
            Round points for correct winner, +5 for exact score after 90/ET.
          </p>
        </>
      )}
      {blockedDialog && (
        <BlockedTeamPickDialog
          blockedTeamName={blockedDialog.blockedTeamName}
          lockedTeamName={blockedDialog.lockedTeamName}
          onClose={() => setBlockedDialog(null)}
        />
      )}
    </>
  );
}

export function outcomeModeFromPick(
  pick?: {
    predicts_penalties?: boolean;
    winning_goal_minute_pred?: number | null;
  }
): KnockoutOutcomeMode {
  if (
    pick?.predicts_penalties ||
    pick?.winning_goal_minute_pred === PENALTIES_PICK_SENTINEL
  ) {
    return "penalties";
  }
  return "regulation";
}
