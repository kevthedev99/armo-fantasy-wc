import { format } from "date-fns";
import { formatPickSummary, isMatchFinished } from "@/lib/scoring";
import type { Match, Pick } from "@/lib/types";

interface PickReadOnlyCardProps {
  match: Match;
  pick: Pick;
}

export function PickReadOnlyCard({ match, pick }: PickReadOnlyCardProps) {
  const summary = formatPickSummary(match, pick);
  const finished = isMatchFinished(match.status);

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
          {format(new Date(match.kickoff_at), "EEE, MMM d, h:mm a")}
        </time>
      </div>

      <p className="mb-3 text-center text-sm font-black uppercase">
        {match.home_team_name} vs {match.away_team_name}
      </p>

      {finished &&
        match.home_score !== null &&
        match.away_score !== null && (
          <p className="mb-2 text-center text-xs font-bold text-gray-500">
            Final: {match.home_score}-{match.away_score}
          </p>
        )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-[#32CD32] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          Pick
        </span>
        {summary && (
          <span className="rounded-full bg-[#32CD32]/15 px-3 py-1 text-xs font-bold uppercase text-[#1a7a1a]">
            {summary}
          </span>
        )}
      </div>

      {pick.is_scored && (
        <p
          className={`mt-3 text-center text-sm font-bold ${
            pick.points_earned > 0 ? "text-[#32CD32]" : "text-gray-400"
          }`}
        >
          +{pick.points_earned} pts
        </p>
      )}

      {match.stage === "knockout" && pick.winning_goal_minute_pred !== null && (
        <p className="mt-2 text-center text-[10px] text-gray-500">
          Winning goal: {pick.winning_goal_minute_pred}&apos;
        </p>
      )}
    </article>
  );
}
