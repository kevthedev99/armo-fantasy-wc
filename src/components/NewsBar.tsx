import { format } from "date-fns";
import type { Match } from "@/lib/types";

interface NewsBarProps {
  upcomingMatches: Match[];
}

export function NewsBar({ upcomingMatches }: NewsBarProps) {
  const message =
    upcomingMatches.length > 0
      ? upcomingMatches
          .map((m) => {
            const date = format(new Date(m.kickoff_at), "EEE MMM d · h:mm a");
            return `${date} — ${m.home_team_name} vs ${m.away_team_name}`;
          })
          .join("  •  ")
      : "No upcoming matches this week.";

  return (
    <div className="flex items-stretch bg-[#0056b3] text-white">
      <span className="flex shrink-0 items-center bg-[#FF007A] px-4 py-2 text-xs font-black uppercase tracking-wider">
        This Week
      </span>
      <p className="flex flex-1 items-center overflow-x-auto px-4 py-2 text-sm whitespace-nowrap">
        {message}
      </p>
      {upcomingMatches.length > 0 && (
        <span className="hidden shrink-0 items-center px-4 text-xs text-white/70 md:flex">
          {upcomingMatches.length} match
          {upcomingMatches.length !== 1 ? "es" : ""}
        </span>
      )}
    </div>
  );
}
