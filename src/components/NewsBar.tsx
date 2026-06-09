import { format } from "date-fns";
import type { Match } from "@/lib/types";

interface NewsBarProps {
  upcomingMatches: Match[];
}

function formatMatchLine(matches: Match[]): string {
  return matches
    .map((m) => {
      const date = format(new Date(m.kickoff_at), "EEE MMM d · h:mm a");
      return `${date} — ${m.home_team_name} vs ${m.away_team_name}`;
    })
    .join("   •   ");
}

export function NewsBar({ upcomingMatches }: NewsBarProps) {
  const hasMatches = upcomingMatches.length > 0;
  const tickerText = hasMatches
    ? formatMatchLine(upcomingMatches)
    : "No upcoming matches this week.";

  const duration = Math.max(25, upcomingMatches.length * 8);

  return (
    <div className="flex items-stretch bg-[#0056b3] text-white">
      <span className="relative z-10 flex shrink-0 items-center bg-[#FF007A] px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-[4px_0_12px_rgba(0,0,0,0.3)]">
        This Week
      </span>

      <div className="news-ticker-viewport relative min-w-0 flex-1 py-2.5">
        {hasMatches ? (
          <div
            className="news-ticker-track text-sm whitespace-nowrap"
            style={{ "--ticker-duration": `${duration}s` } as Record<string, string>}
          >
            <span className="px-4">{tickerText}</span>
            <span className="px-4" aria-hidden="true">
              {tickerText}
            </span>
          </div>
        ) : (
          <p className="px-4 text-sm text-white/80">{tickerText}</p>
        )}

        {/* Fade edges */}
        {hasMatches && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#0056b3] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0056b3] to-transparent" />
          </>
        )}
      </div>

      {hasMatches && (
        <span className="relative z-10 hidden shrink-0 items-center border-l border-white/10 bg-[#0056b3] px-4 text-xs text-white/70 md:flex">
          {upcomingMatches.length} match
          {upcomingMatches.length !== 1 ? "es" : ""}
        </span>
      )}
    </div>
  );
}
