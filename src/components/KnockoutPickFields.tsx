"use client";

import type { Match, PickWinner } from "@/lib/types";

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
}: KnockoutPickFieldsProps) {
  const penaltiesMode = outcomeMode === "penalties";

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
            {(
              [
                ["home", match.home_team_name],
                ["away", match.away_team_name],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => onPickedWinnerChange(value)}
                className={`rounded-lg border px-2 py-2 text-[10px] font-bold uppercase transition md:text-xs ${
                  pickedWinner === value
                    ? "border-[#FF007A] bg-[#FF007A] text-white"
                    : "border-gray-300 bg-white text-gray-800 hover:border-[#FF007A]"
                }`}
              >
                {label.length > 12 ? `${label.slice(0, 10)}…` : label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(
              [
                ["home", match.home_team_name],
                ["away", match.away_team_name],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => onPickedWinnerChange(value)}
                className={`rounded-lg border px-2 py-2 text-[10px] font-bold uppercase transition md:text-xs ${
                  pickedWinner === value
                    ? "border-[#0056b3] bg-[#0056b3] text-white"
                    : "border-gray-300 bg-white text-gray-800 hover:border-[#0056b3]"
                }`}
              >
                {label.length > 12 ? `${label.slice(0, 10)}…` : label}
              </button>
            ))}
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
    </>
  );
}

export function outcomeModeFromPick(
  pick?: { predicts_penalties?: boolean }
): KnockoutOutcomeMode {
  return pick?.predicts_penalties ? "penalties" : "regulation";
}
