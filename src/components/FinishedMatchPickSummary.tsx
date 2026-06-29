import { formatScore } from "@/lib/match-status";
import { formatPickSummary, isMatchFinished } from "@/lib/scoring";
import type { Match, Pick } from "@/lib/types";

interface FinishedMatchPickSummaryProps {
  match: Match;
  pick?: Pick;
  /** Larger score line for bracket cards. */
  size?: "sm" | "md";
}

export function FinishedMatchPickSummary({
  match,
  pick,
  size = "md",
}: FinishedMatchPickSummaryProps) {
  if (!isMatchFinished(match.status)) return null;

  const scoreClass =
    size === "md"
      ? "font-display text-lg font-black tracking-wide text-gray-800"
      : "text-sm font-black text-gray-800";

  return (
    <div className="mt-2 space-y-1.5 text-center">
      {match.home_score !== null && match.away_score !== null && (
        <p className={scoreClass}>Final {formatScore(match)}</p>
      )}

      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Game ended
      </p>

      {pick ? (
        <>
          <p className="text-[10px] font-bold uppercase text-gray-600">
            Your pick: {formatPickSummary(match, pick)}
          </p>
          {(pick.is_scored || pick.points_earned > 0) && (
            <p
              className={`text-sm font-black ${
                pick.points_earned > 0 ? "text-[#32CD32]" : "text-gray-400"
              }`}
            >
              {pick.points_earned > 0
                ? `+${pick.points_earned} pts`
                : "0 pts"}
            </p>
          )}
        </>
      ) : (
        <p className="text-[10px] font-medium text-amber-800">
          No pick — locked at kickoff
        </p>
      )}
    </div>
  );
}
