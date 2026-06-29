import { format } from "date-fns";
import { EliminatedTeamName } from "@/components/EliminatedTeamName";
import { isVirtualMatchId } from "@/lib/bracket-slot-picks";
import {
  formatScore,
  getMatchBucket,
  getStatusLabel,
} from "@/lib/match-status";
import {
  formatPickSummary,
  getMatchLockMessage,
  isMatchFinished,
  isMatchLocked,
} from "@/lib/scoring";
import {
  isMatchSideEliminated,
  type TeamEliminationChecker,
} from "@/lib/team-elimination-display";
import type { Match, Pick } from "@/lib/types";

interface PickReadOnlyCardProps {
  match: Match;
  pick?: Pick;
  checkEliminated?: TeamEliminationChecker;
}

export function PickReadOnlyCard({
  match,
  pick,
  checkEliminated,
}: PickReadOnlyCardProps) {
  const locked = isMatchLocked(match);
  const missed = locked && !pick;
  const summary = pick ? formatPickSummary(match, pick) : null;
  const finished = isMatchFinished(match.status);
  const isLive = getMatchBucket(match) === "live";
  const lockMessage = getMatchLockMessage(match);
  const homeEliminated = isMatchSideEliminated(match, "home", checkEliminated);
  const awayEliminated = isMatchSideEliminated(match, "away", checkEliminated);

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm ${
        isLive
          ? "border-red-400 bg-red-50/80 ring-2 ring-red-200"
          : missed
            ? "border-amber-300 bg-amber-50/80"
            : locked
              ? "border-gray-300 bg-gray-50"
              : "border-gray-200 bg-white"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {match.group_name ? (
          <span className="rounded-full bg-[#0056b3] px-3 py-1 text-[10px] font-bold uppercase text-white">
            {match.group_name}
          </span>
        ) : (
          <span className="rounded-full bg-[#0056b3] px-3 py-1 text-[10px] font-bold uppercase text-white">
            {match.round}
          </span>
        )}
        <time className="text-[10px] font-medium uppercase text-gray-500">
          {isLive ? (
            <span className="flex items-center justify-end gap-1 font-bold text-red-600">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              Live · {getStatusLabel(match.status)}
            </span>
          ) : isVirtualMatchId(match.id) ? (
            "Bracket pick"
          ) : (
            format(new Date(match.kickoff_at), "EEE, MMM d, h:mm a")
          )}
        </time>
      </div>

      <p className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-black uppercase">
        <EliminatedTeamName
          name={match.home_team_name}
          eliminated={homeEliminated}
        />
        <span className="text-gray-400">vs</span>
        <EliminatedTeamName
          name={match.away_team_name}
          eliminated={awayEliminated}
        />
      </p>

      {isLive && match.home_score !== null && match.away_score !== null && (
        <p className="mb-2 text-center text-lg font-black text-red-700">
          {formatScore(match)}
        </p>
      )}

      {finished &&
        match.home_score !== null &&
        match.away_score !== null && (
          <p className="mb-2 text-center text-xs font-bold text-gray-500">
            Final: {match.home_score}-{match.away_score}
          </p>
        )}

      {missed ? (
        <div className="rounded-lg border border-amber-400/60 bg-amber-100/80 px-3 py-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-900">
            No pick made
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Locked — match started without a pick.
          </p>
        </div>
      ) : summary ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
              isLive ? "bg-red-600" : locked ? "bg-gray-500" : "bg-[#32CD32]"
            }`}
          >
            {isLive ? "Live pick" : locked ? "Locked pick" : "Pick"}
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
      ) : null}

      {pick?.is_scored && (
        <p
          className={`mt-3 text-center text-sm font-bold ${
            pick.points_earned > 0 ? "text-[#32CD32]" : "text-gray-400"
          }`}
        >
          +{pick.points_earned} pts
        </p>
      )}

      {locked && (
        <p className="mt-3 text-center text-[10px] font-medium text-gray-500">
          🔒 {lockMessage || "Locked"}
        </p>
      )}
    </article>
  );
}
